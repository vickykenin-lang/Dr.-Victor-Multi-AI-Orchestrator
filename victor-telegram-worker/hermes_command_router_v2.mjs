import { HERMES_RISK_CLASS, classifyHermesAction } from './hermes_command_plane.mjs';
import { hermesStoreCapability, putCommandState, putReceipt } from './hermes_command_store.mjs';
import { loadHermesContext } from './hermes_context_registry.mjs';
import { readRioFlyerResult, rioFlyerBridgeCapability } from './hermes_rio_flyer_bridge.mjs';
import { approveGulabo, gulaboBridgeCapability, readGulaboStatus, requestGulaboRevision } from './hermes_gulabo_bridge.mjs';
import { getRequesterDelivery } from './hermes_requester_delivery.mjs';
import {
  centralRioImageCapability,
  executeCentralRioFlyer,
  readCentralRioFlyerResult,
  readCentralRioImageUsage,
} from './hermes_rio_image_provider.mjs';

export const HERMES_ROUTER_VERSION = 'HERMES_COMMAND_ROUTER_V2';
const configured=(v)=>Boolean(String(v??'').trim());
const commandTokenConfigured=(env={})=>configured(env.HERMES_COMMAND_TOKEN||env.API_VICTOR);
const webhookSecretConfigured=(env={})=>configured(env.HERMES_WEBHOOK_SECRET||env.TELEGRAM_WEBHOOK_SECRET);
const productionRuntimeObserved=(env={})=>Boolean(env.CF_VERSION_METADATA||env.VICTOR_DEPLOY_GIT_SHA||env.VICTOR_BUILD_UUID);

function hermesEvidence(env={}){
  const live=productionRuntimeObserved(env);
  return{credential_available:commandTokenConfigured(env),endpoint_config_present:live,source_implemented:true,test_passed:null,production_deployed:live,live_request_verified:live,real_output_verified:false,real_business_outcome_verified:false};
}

function rioEvidence(env={},provider={}){
  const live=productionRuntimeObserved(env);
  return{credential_available:provider.workers_ai_binding_configured===true,endpoint_config_present:provider.ready_for_generation===true,source_implemented:true,test_passed:null,production_deployed:live,live_request_verified:false,real_output_verified:false,real_business_outcome_verified:false};
}

export function hermesRuntimeSnapshot(env={}){
  return{
    service:'hermes-command-control-plane',
    router_version:HERMES_ROUTER_VERSION,
    command_store:hermesStoreCapability(env),
    command_token_configured:commandTokenConfigured(env),
    command_token_source:configured(env.HERMES_COMMAND_TOKEN)?'HERMES_COMMAND_TOKEN':configured(env.API_VICTOR)?'API_VICTOR_FALLBACK':'NONE',
    webhook_secret_configured:webhookSecretConfigured(env),
    webhook_secret_source:configured(env.HERMES_WEBHOOK_SECRET)?'HERMES_WEBHOOK_SECRET':configured(env.TELEGRAM_WEBHOOK_SECRET)?'TELEGRAM_WEBHOOK_SECRET_FALLBACK':'NONE',
    telegram_secret_configured:configured(env.TELEGRAM_WEBHOOK_SECRET),
    founder_chat_configured:configured(env.VICTOR_FOUNDER_CHAT_ID),
    github_orchestration_token_configured:configured(env.GITHUB_ORCHESTRATION_TOKEN),
    workers_ai_binding_configured:Boolean(env.AI&&typeof env.AI.run==='function'),
    rio_flyer_bridge:rioFlyerBridgeCapability(env),
    rio_central_image_provider:centralRioImageCapability(env),
    gulabo_bridge:gulaboBridgeCapability(env),
    evidence:hermesEvidence(env),
  };
}

export function rioRuntimeSnapshot(env={}){
  const bridge=rioFlyerBridgeCapability(env),provider=centralRioImageCapability(env);
  return{
    service:'rio',generation_route:'HERMES_CENTRAL_WORKERS_AI',credential_transfer_required:false,central_image_provider:provider,
    legacy_flyer_transport:{bridge_credential_configured:bridge.github_orchestration_token_configured,workflow:bridge.workflow,enabled:bridge.transport_feature_flag_enabled,ready_for_dispatch:bridge.ready_for_dispatch,result_readback_implemented:bridge.result_readback_implemented===true},
    no_spend_preflight_action:'rio.flyer_preflight',result_readback_action:'rio.flyer_result',
    image_policy:{monthly_provider_call_limit:Number(env.RIO_IMAGE_MONTHLY_PROVIDER_CALL_LIMIT||30),max_attempts_per_product:Number(env.RIO_IMAGE_MAX_ATTEMPTS||2),monthly_spend_limit_usd:Number(env.RIO_IMAGE_MONTHLY_SPEND_LIMIT_USD||1)},
    evidence:rioEvidence(env,provider),
  };
}

async function persistResult(env,command,result){
  const receiptId=`rcpt_${command.command_id}`;
  const receipt={receipt_id:receiptId,command_id:command.command_id,source:command.source,actor:command.actor,target:command.target,action:command.action,status:result.status||'COMPLETED',validation:'PASS',execution:result.execution||'COMPLETED',result:result.result??null,error_code:result.error_code??null,live_request_verified:result.live_request_verified===true,real_output_verified:result.real_output_verified===true,business_outcome_verified:result.business_outcome_verified===true,router_version:HERMES_ROUTER_VERSION};
  await putReceipt(env,receipt);
  await putCommandState(env,command,{status:receipt.status,validation:'PASS',execution:receipt.execution,error_code:receipt.error_code,result:receipt.result,receipt_id:receiptId});
}

function reviewReadyResult(command={}){
  const p=command.payload&&typeof command.payload==='object'?command.payload:{};
  const imageId=String(p.image_id||'').trim(),revision=Number(p.revision||0);
  if(!imageId||!Number.isInteger(revision)||revision<1){
    return{status:'SAFE_STOP',execution:'BLOCKED',error_code:'GULABO_REVIEW_PACKET_INVALID',result:null,live_request_verified:false,real_output_verified:false,business_outcome_verified:false};
  }
  return{
    status:'COMPLETED',execution:'COMPLETED',error_code:null,
    result:{review_packet_received:true,image_id:imageId,revision,requester:p.requester||null,requester_ref:p.requester_ref||null,profile:p.profile||null,asset_url:p.asset_url||null,rating:p.rating||null,qa_approved:p.qa_approved===true,qa_reason_codes:Array.isArray(p.qa_reason_codes)?p.qa_reason_codes:[],qa_defects:Array.isArray(p.qa_defects)?p.qa_defects:[],qa_attempt_count:Number(p.qa_attempt_count||0),provider:p.provider||null,model:p.model||null},
    live_request_verified:true,real_output_verified:p.real_output_verified===true,business_outcome_verified:false,
  };
}

async function requesterDeliveryResult(env,requester,payload={}){
  const requesterRef=String(payload.requester_ref||'').trim();
  if(!requesterRef)return{status:'SAFE_STOP',execution:'BLOCKED',error_code:'GULABO_REQUESTER_REF_REQUIRED',result:null,live_request_verified:false,real_output_verified:false,business_outcome_verified:false};
  try{
    const read=await getRequesterDelivery(env,{requester,requester_ref:requesterRef});
    if(!read.found)return{status:'COMPLETED_WITH_LIMITATION',execution:'COMPLETED',error_code:'GULABO_REQUESTER_RESULT_NOT_FOUND',result:{requester,requester_ref:requesterRef,delivery:null},live_request_verified:true,real_output_verified:false,business_outcome_verified:false};
    return{status:'COMPLETED',execution:'COMPLETED',error_code:null,result:read.delivery,live_request_verified:true,real_output_verified:read.delivery.real_output_verified===true,business_outcome_verified:read.delivery.founder_approved===true&&Boolean(read.delivery.asset_url)};
  }catch(error){
    return{status:'SAFE_STOP',execution:'BLOCKED',error_code:error?.message||'GULABO_REQUESTER_RESULT_READ_FAILED',result:null,live_request_verified:false,real_output_verified:false,business_outcome_verified:false};
  }
}

export async function routeHermesCommandV2(env,command,options={}){
  const c=classifyHermesAction(command?.action);
  let r;
  if(!c.known)r={status:'SAFE_STOP',execution:'BLOCKED',error_code:'ACTION_NOT_REGISTERED',result:null};
  else if(c.risk===HERMES_RISK_CLASS.APPROVAL_REQUIRED&&command?.execution_mode!=='approval_required')r={status:'AWAITING_APPROVAL',execution:'NOT_STARTED',error_code:'APPROVAL_REQUIRED',result:null};
  else if(command.action==='hermes.status')r={status:'COMPLETED',execution:'COMPLETED',result:hermesRuntimeSnapshot(env),live_request_verified:productionRuntimeObserved(env)};
  else if(command.action==='hermes.audit')r={status:'COMPLETED',execution:'COMPLETED',result:{hermes:hermesRuntimeSnapshot(env),rio:rioRuntimeSnapshot(env),gulabo:gulaboBridgeCapability(env),note:'Fresh runtime evidence overrides source assumptions.'},live_request_verified:productionRuntimeObserved(env)};
  else if(command.action==='hermes.context'){
    const registry=await loadHermesContext(env);
    r={status:'COMPLETED',execution:'COMPLETED',result:{...registry,runtime:hermesRuntimeSnapshot(env)},live_request_verified:productionRuntimeObserved(env)};
  }
  else if(command.action==='hermes.gulabo_review_ready')r=reviewReadyResult(command);
  else if(command.action==='gulabo.status')r=await readGulaboStatus(env);
  else if(command.action==='gulabo.request_revision')r=await requestGulaboRevision(env,command.payload||{});
  else if(command.action==='gulabo.good_to_go')r=await approveGulabo(env,command.payload||{});
  else if(command.action==='rio.gulabo_result')r=await requesterDeliveryResult(env,'RIO',command.payload||{});
  else if(command.action==='aura3.gulabo_result')r=await requesterDeliveryResult(env,'AURA3',command.payload||{});
  else if(command.action==='rio.status')r={status:'COMPLETED',execution:'COMPLETED',result:rioRuntimeSnapshot(env)};
  else if(command.action==='rio.image_usage'){
    const usage=await readCentralRioImageUsage(env);
    r=usage.ok?{status:'COMPLETED',execution:'COMPLETED',error_code:null,result:{...usage.usage,monthly_provider_call_limit:usage.capability.monthly_provider_call_limit,counter_live_read_verified:usage.counter_live_read_verified,provider_mode:usage.capability.provider_mode}}:{status:'COMPLETED_WITH_LIMITATION',execution:'COMPLETED',error_code:usage.error_code,result:{monthly_provider_call_limit:usage.capability?.monthly_provider_call_limit??Number(env.RIO_IMAGE_MONTHLY_PROVIDER_CALL_LIMIT||30),actual_monthly_provider_calls:null,counter_live_read_verified:false}};
  }
  else if(command.action==='rio.image_budget')r={status:'COMPLETED_WITH_LIMITATION',execution:'COMPLETED',error_code:'PROVIDER_BUDGET_TELEMETRY_NOT_WIRED',result:{monthly_spend_limit_usd:Number(env.RIO_IMAGE_MONTHLY_SPEND_LIMIT_USD||1),actual_monthly_spend_usd:null,provider_budget_verified:false,monthly_provider_call_limit:Number(env.RIO_IMAGE_MONTHLY_PROVIDER_CALL_LIMIT||30),central_provider:true}};
  else if(command.action==='rio.flyer_result'){
    const taskId=String(command?.payload?.task_id||'').trim();
    if(!taskId)r={status:'SAFE_STOP',execution:'BLOCKED',error_code:'RIO_FLYER_TASK_ID_REQUIRED',result:null};
    else{
      const central=await readCentralRioFlyerResult(env,taskId);
      if(central.status==='FOUND')r={status:'COMPLETED',execution:'COMPLETED',error_code:null,result:{task_id:central.task_id,source:'HERMES_CENTRAL_WORKERS_AI',downstream:central.result},live_request_verified:central.live_request_verified===true,real_output_verified:central.real_output_verified===true,business_outcome_verified:central.business_outcome_verified===true};
      else{
        const read=await readRioFlyerResult(env,taskId);
        if(read.status==='FOUND')r={status:'COMPLETED',execution:'COMPLETED',error_code:null,result:{task_id:read.task_id,source:'LEGACY_RIO_GITHUB_TRANSPORT',result_path:read.result_path,blob_sha:read.blob_sha,downstream:read.result},live_request_verified:read.live_request_verified===true,real_output_verified:read.real_output_verified===true,business_outcome_verified:read.business_outcome_verified===true};
        else if(read.status==='NOT_FOUND')r={status:'COMPLETED_WITH_LIMITATION',execution:'COMPLETED',error_code:'RIO_RESULT_NOT_FOUND',result:{task_id:read.task_id,result_path:read.result_path,downstream:null},live_request_verified:read.live_request_verified===true,real_output_verified:false,business_outcome_verified:false};
        else r={status:'SAFE_STOP',execution:'BLOCKED',error_code:read.error_code||'RIO_RESULT_READ_FAILED',result:read,live_request_verified:read.live_request_verified===true,real_output_verified:false,business_outcome_verified:false};
      }
    }
  }
  else if(command.action==='victor.status')r={status:'COMPLETED',execution:'COMPLETED',result:{service:'victor',deployment_git_sha:env.VICTOR_DEPLOY_GIT_SHA||null,deployment_build_uuid:env.VICTOR_BUILD_UUID||null,github_orchestration_token_configured:configured(env.GITHUB_ORCHESTRATION_TOKEN),workers_ai_binding_configured:Boolean(env.AI&&typeof env.AI.run==='function'),production_identity_verified:productionRuntimeObserved(env)},live_request_verified:productionRuntimeObserved(env)};
  else if(command.action==='rio.generate_product_flyer'||command.action==='rio.flyer_preflight'){
    const generated=await executeCentralRioFlyer(env,command,{preflightOnly:command.action==='rio.flyer_preflight'});
    r=generated.status==='SAFE_STOP'?{status:'SAFE_STOP',execution:generated.execution_status||'BLOCKED',error_code:generated.error_code||'CENTRAL_IMAGE_PROVIDER_FAILED',result:generated,live_request_verified:generated.live_request_verified===true,real_output_verified:false,business_outcome_verified:false}:{status:generated.status,execution:generated.execution_status||'COMPLETED',error_code:generated.error_code||null,result:generated,live_request_verified:generated.live_request_verified===true,real_output_verified:generated.real_output_verified===true,business_outcome_verified:generated.business_outcome_verified===true};
  }
  else r={status:'SAFE_STOP',execution:'BLOCKED',error_code:'ACTION_ROUTE_NOT_IMPLEMENTED',result:null};
  if(options.persist!==false)await persistResult(env,command,r);
  return r;
}
