import { HERMES_RISK_CLASS, classifyHermesAction } from './hermes_command_plane.mjs';
import { hermesStoreCapability, putCommandState, putReceipt } from './hermes_command_store.mjs';
import { loadHermesContext } from './hermes_context_registry.mjs';
import { dispatchRioFlyerTask, rioFlyerBridgeCapability } from './hermes_rio_flyer_bridge.mjs';

export const HERMES_ROUTER_VERSION = 'HERMES_COMMAND_ROUTER_V2';
const configured = (v) => Boolean(String(v ?? '').trim());
const commandTokenConfigured=(env={})=>configured(env.HERMES_COMMAND_TOKEN||env.API_VICTOR);
const webhookSecretConfigured=(env={})=>configured(env.HERMES_WEBHOOK_SECRET||env.TELEGRAM_WEBHOOK_SECRET);
const productionRuntimeObserved=(env={})=>Boolean(env.CF_VERSION_METADATA || env.VICTOR_DEPLOY_GIT_SHA || env.VICTOR_BUILD_UUID);

function hermesEvidence(env={}) {
  const live=productionRuntimeObserved(env);
  return {
    credential_available: commandTokenConfigured(env),
    endpoint_config_present: live,
    source_implemented: true,
    test_passed: null,
    production_deployed: live,
    live_request_verified: live,
    real_output_verified: false,
    real_business_outcome_verified: false,
  };
}

function rioEvidence(env={},bridge={}) {
  return {
    credential_available: bridge.github_orchestration_token_configured===true,
    endpoint_config_present: bridge.transport_feature_flag_enabled===true,
    source_implemented: true,
    test_passed: null,
    production_deployed: false,
    live_request_verified: false,
    real_output_verified: false,
    real_business_outcome_verified: false,
  };
}

export function hermesRuntimeSnapshot(env={}) {
  return { service:'hermes-command-control-plane', router_version:HERMES_ROUTER_VERSION, command_store:hermesStoreCapability(env), command_token_configured:commandTokenConfigured(env), command_token_source:configured(env.HERMES_COMMAND_TOKEN)?'HERMES_COMMAND_TOKEN':configured(env.API_VICTOR)?'API_VICTOR_FALLBACK':'NONE', webhook_secret_configured:webhookSecretConfigured(env), webhook_secret_source:configured(env.HERMES_WEBHOOK_SECRET)?'HERMES_WEBHOOK_SECRET':configured(env.TELEGRAM_WEBHOOK_SECRET)?'TELEGRAM_WEBHOOK_SECRET_FALLBACK':'NONE', telegram_secret_configured:configured(env.TELEGRAM_WEBHOOK_SECRET), founder_chat_configured:configured(env.VICTOR_FOUNDER_CHAT_ID), github_orchestration_token_configured:configured(env.GITHUB_ORCHESTRATION_TOKEN), rio_flyer_bridge:rioFlyerBridgeCapability(env), evidence:hermesEvidence(env) };
}

export function rioRuntimeSnapshot(env={}) {
  const bridge=rioFlyerBridgeCapability(env);
  return { service:'rio', bridge_credential_configured:bridge.github_orchestration_token_configured, exact_flyer_transport_implemented:true, exact_flyer_workflow:bridge.workflow, exact_flyer_transport_enabled:bridge.transport_feature_flag_enabled, exact_flyer_transport_ready_for_dispatch:bridge.ready_for_dispatch, image_policy:{ monthly_provider_call_limit:Number(env.RIO_IMAGE_MONTHLY_PROVIDER_CALL_LIMIT||30), max_attempts_per_product:Number(env.RIO_IMAGE_MAX_ATTEMPTS||2), monthly_spend_limit_usd:Number(env.RIO_IMAGE_MONTHLY_SPEND_LIMIT_USD||1) }, evidence:rioEvidence(env,bridge) };
}

async function persistResult(env,command,result){
  const receiptId=`rcpt_${command.command_id}`;
  const receipt={ receipt_id:receiptId, command_id:command.command_id, source:command.source, actor:command.actor, target:command.target, action:command.action, status:result.status||'COMPLETED', validation:'PASS', execution:result.execution||'COMPLETED', result:result.result??null, error_code:result.error_code??null, live_request_verified:result.live_request_verified===true, real_output_verified:result.real_output_verified===true, business_outcome_verified:result.business_outcome_verified===true, router_version:HERMES_ROUTER_VERSION };
  await putReceipt(env,receipt);
  await putCommandState(env,command,{ status:receipt.status, validation:'PASS', execution:receipt.execution, error_code:receipt.error_code, result:receipt.result, receipt_id:receiptId });
}

export async function routeHermesCommandV2(env,command,options={}){
  const c=classifyHermesAction(command?.action);
  let r;
  if(!c.known) r={status:'SAFE_STOP',execution:'BLOCKED',error_code:'ACTION_NOT_REGISTERED',result:null};
  else if(c.risk===HERMES_RISK_CLASS.APPROVAL_REQUIRED && command?.execution_mode!=='approval_required') r={status:'AWAITING_APPROVAL',execution:'NOT_STARTED',error_code:'APPROVAL_REQUIRED',result:null};
  else if(command.action==='hermes.status') r={status:'COMPLETED',execution:'COMPLETED',result:hermesRuntimeSnapshot(env),live_request_verified:productionRuntimeObserved(env)};
  else if(command.action==='hermes.audit') r={status:'COMPLETED',execution:'COMPLETED',result:{hermes:hermesRuntimeSnapshot(env),rio:rioRuntimeSnapshot(env),note:'Fresh runtime evidence overrides source assumptions.'},live_request_verified:productionRuntimeObserved(env)};
  else if(command.action==='hermes.context') {
    const registry=await loadHermesContext(env);
    r={status:'COMPLETED',execution:'COMPLETED',result:{...registry,runtime:hermesRuntimeSnapshot(env)},live_request_verified:productionRuntimeObserved(env)};
  }
  else if(command.action==='rio.status') r={status:'COMPLETED',execution:'COMPLETED',result:rioRuntimeSnapshot(env)};
  else if(command.action==='rio.image_usage') r={status:'COMPLETED_WITH_LIMITATION',execution:'COMPLETED',error_code:'RIO_IMAGE_USAGE_LEDGER_NOT_CONNECTED_TO_HERMES_READ_PATH',result:{monthly_provider_call_limit:Number(env.RIO_IMAGE_MONTHLY_PROVIDER_CALL_LIMIT||30),actual_monthly_provider_calls:null,counter_live_read_verified:false}};
  else if(command.action==='rio.image_budget') r={status:'COMPLETED_WITH_LIMITATION',execution:'COMPLETED',error_code:'RIO_IMAGE_BUDGET_TELEMETRY_NOT_WIRED',result:{monthly_spend_limit_usd:Number(env.RIO_IMAGE_MONTHLY_SPEND_LIMIT_USD||1),actual_monthly_spend_usd:null,provider_budget_verified:false}};
  else if(command.action==='victor.status') r={status:'COMPLETED',execution:'COMPLETED',result:{service:'victor',deployment_git_sha:env.VICTOR_DEPLOY_GIT_SHA||null,deployment_build_uuid:env.VICTOR_BUILD_UUID||null,github_orchestration_token_configured:configured(env.GITHUB_ORCHESTRATION_TOKEN),production_identity_verified:productionRuntimeObserved(env)},live_request_verified:productionRuntimeObserved(env)};
  else if(command.action==='rio.generate_product_flyer'){
    const ref=String(command?.payload?.product_reference||'').trim();
    const image=String(command?.payload?.product_image_url||'').trim();
    if(!ref) r={status:'SAFE_STOP',execution:'BLOCKED',error_code:'PRODUCT_REFERENCE_REQUIRED',result:null};
    else if(!/^https:\/\//i.test(image)) r={status:'SAFE_STOP',execution:'BLOCKED',error_code:'VERIFIED_PRODUCT_IMAGE_URL_REQUIRED',result:{product_reference:ref}};
    else {
      const d=await dispatchRioFlyerTask(env,command);
      r=d.status==='DISPATCHED' ? {status:'DISPATCHED',execution:'DISPATCHED',error_code:null,result:{task_id:d.task_id,product_reference:d.product_reference,repository:d.repository,workflow:d.workflow,result_path:`integration/results/flyer_tasks/${d.task_id}.json`},live_request_verified:true,real_output_verified:false,business_outcome_verified:false} : {status:'SAFE_STOP',execution:'BLOCKED',error_code:d.error_code||'RIO_FLYER_DISPATCH_FAILED',result:d};
    }
  } else r={status:'SAFE_STOP',execution:'BLOCKED',error_code:'ACTION_ROUTE_NOT_IMPLEMENTED',result:null};
  if(options.persist!==false) await persistResult(env,command,r);
  return r;
}
