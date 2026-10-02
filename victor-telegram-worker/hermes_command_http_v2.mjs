import { authenticateHermesRequest } from './hermes_command_auth.mjs';
import { buildHermesReceipt, parseHermesTelegramCommand, validateHermesCommandEnvelope } from './hermes_command_plane.mjs';
import { getCommandState, hermesStoreCapability, persistCommandAcceptance } from './hermes_command_store.mjs';
import { routeHermesCommandV2 } from './hermes_command_router_v2.mjs';
import { centralRioImageCapability, getCentralRioFlyerAsset } from './hermes_rio_image_provider.mjs';

export const HERMES_HTTP_VERSION = 'HERMES_COMMAND_HTTP_V2';

function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
function clean(value,max=256){return typeof value==='string'?value.trim().slice(0,max):'';}
function commandId(){return `cmd_${Date.now()}_${crypto.randomUUID().slice(0,8)}`;}
function idemTelegram(message={},route={}){return `telegram:${clean(String(message?.chat?.id??''),64)}:${clean(String(message?.message_id??''),64)}:${route.action||'unknown'}`.slice(0,160);}
function commandToken(env={}){return env.HERMES_COMMAND_TOKEN||env.API_VICTOR||'';}
function webhookSecret(env={}){return env.HERMES_WEBHOOK_SECRET||env.TELEGRAM_WEBHOOK_SECRET||'';}
function bearerAuthorized(request,env={}){const token=commandToken(env);return Boolean(token&&request.headers.get('Authorization')===`Bearer ${token}`);}

async function auth(request,env,rawBody,idempotencyKey){return authenticateHermesRequest({authorizationHeader:request.headers.get('Authorization')||'',expectedBearerToken:commandToken(env),timestamp:request.headers.get('X-Hermes-Timestamp')||'',rawBody,signature:request.headers.get('X-Hermes-Signature')||'',idempotencyKey,webhookSecret:webhookSecret(env),replayStore:env.HERMES_COMMAND_STORE});}
export function hermesHttpCapabilityV2(env={}){const store=hermesStoreCapability(env);const token=commandToken(env),secret=webhookSecret(env);const imageProvider=centralRioImageCapability(env);return{http_version:HERMES_HTTP_VERSION,command_token_configured:Boolean(token),webhook_secret_configured:Boolean(secret),command_token_source:env.HERMES_COMMAND_TOKEN?'HERMES_COMMAND_TOKEN':env.API_VICTOR?'API_VICTOR_FALLBACK':'NONE',webhook_secret_source:env.HERMES_WEBHOOK_SECRET?'HERMES_WEBHOOK_SECRET':env.TELEGRAM_WEBHOOK_SECRET?'TELEGRAM_WEBHOOK_SECRET_FALLBACK':'NONE',durable_store:store.durable,store,rio_central_image_provider:imageProvider,ready_for_authenticated_commands:Boolean(token&&secret&&store.durable)};}

async function acceptAndRoute(env,validation,receipt){
  const persisted=await persistCommandAcceptance(env,{command:validation.command,receipt});
  if(!persisted.accepted)return{http_status:409,body:{accepted:false,duplicate:true,existing_command_id:persisted.existing_command_id}};
  const execution=await routeHermesCommandV2(env,validation.command);
  return{http_status:execution.execution==='COMPLETED'?200:202,body:{accepted:true,duplicate:false,command_id:persisted.command_id,receipt_id:persisted.receipt_id,status:execution.status,execution:execution.execution,error_code:execution.error_code||null,result:execution.result??null,governed_router:true,router_version:'V2',blocked:execution.execution==='BLOCKED'}};
}

function telegramSummary(action,body={}){
  if(body.duplicate)return `Hermes • ${action}\nDuplicate command ignored safely.\nExisting command: ${body.existing_command_id||'unknown'}`;
  const lines=[`Hermes • ${action}`,`Status: ${body.status||'UNKNOWN'}`,`Execution: ${body.execution||'UNKNOWN'}`];
  if(body.error_code)lines.push(`Code: ${body.error_code}`);
  const r=body.result||{};
  if(action==='hermes.status'){
    lines.push(`Command store: ${r?.command_store?.durable?'READY':'NOT READY'}`);
    lines.push(`RIO flyer bridge: ${r?.rio_flyer_bridge?.ready_for_dispatch?'READY':'NOT READY'}`);
    lines.push(`Central image provider: ${r?.rio_central_image_provider?.ready_for_generation?'READY':'NOT READY'}`);
  }else if(action==='rio.status'){
    const centralReady=r?.central_image_provider?.ready_for_generation===true;
    lines.push(`Flyer transport: ${centralReady?'READY':'NOT READY'}`);
    lines.push(`Generation route: ${r?.generation_route||'unknown'}`);
    lines.push(`Central provider: ${centralReady?'READY':'NOT READY'}`);
    lines.push(`Credential transfer: ${r?.credential_transfer_required?'REQUIRED':'NOT REQUIRED'}`);
  }else if(action==='rio.image_usage'){
    lines.push(`Monthly provider-call limit: ${r?.monthly_provider_call_limit??'unknown'}`);
    lines.push(`Provider calls: ${r?.provider_calls??'not connected'}`);
    lines.push(`Generated assets: ${r?.generated_assets??'not connected'}`);
  }else if(action==='rio.image_budget'){
    lines.push(`Monthly AI spend limit: $${r?.monthly_spend_limit_usd??'unknown'}`);
    lines.push(`Actual spend: ${r?.actual_monthly_spend_usd==null?'not connected':`$${r.actual_monthly_spend_usd}`}`);
  }else if(action==='victor.status'){
    lines.push(`Deploy SHA: ${r?.deployment_git_sha||'not verified'}`);
    lines.push(`Workers AI: ${r?.workers_ai_binding_configured?'READY':'NOT READY'}`);
  }else if((action==='rio.generate_product_flyer'||action==='rio.flyer_preflight')&&r?.task_id){
    lines.push(`Task: ${r.task_id}`);
    if(r.asset_id)lines.push(`Asset: ${r.asset_id}`);
    if(r.provider_calls_this_month!=null)lines.push(`Calls this month: ${r.provider_calls_this_month}/${r.monthly_provider_call_limit??'?'}`);
  }else if(action==='rio.flyer_result'&&r?.task_id){
    lines.push(`Task: ${r.task_id}`);
    if(r?.downstream?.asset_id)lines.push(`Asset: ${r.downstream.asset_id}`);
  }
  if(body.receipt_id)lines.push(`Receipt: ${body.receipt_id}`);
  return lines.join('\n').slice(0,3500);
}

function sanitizeMirrorValue(value,depth=0){
  if(depth>4)return '[TRUNCATED]';
  if(Array.isArray(value))return value.slice(0,12).map((item)=>sanitizeMirrorValue(item,depth+1));
  if(value&&typeof value==='object'){
    const out={};
    for(const [key,item] of Object.entries(value).slice(0,40)){
      if(/token|secret|authorization|credential|password|cookie|signature/i.test(key))out[key]='[REDACTED]';
      else out[key]=sanitizeMirrorValue(item,depth+1);
    }
    return out;
  }
  if(typeof value==='string')return value.slice(0,600);
  return value;
}

function compactMirrorJson(value,max=1400){
  let text='{}';
  try{text=JSON.stringify(sanitizeMirrorValue(value));}catch{}
  return text.length>max?`${text.slice(0,max-12)}…[truncated]`:text;
}

export function chatgptTelegramMirrorText(command={},body={}){
  const safeCommand={
    command_id:command.command_id||null,
    source:command.source||null,
    actor:command.actor||null,
    target:command.target||null,
    action:command.action||null,
    payload:command.payload||{},
    execution_mode:command.execution_mode||null,
    idempotency_key:command.idempotency_key||null,
  };
  const lines=[
    'ChatGPT → Hermes',
    `Action: ${command.action||'unknown'}`,
    `Target: ${command.target||'unknown'}`,
    `Command: ${compactMirrorJson(safeCommand,1600)}`,
    '— Hermes receipt —',
    `Status: ${body.status|| (body.duplicate?'DUPLICATE':'UNKNOWN')}`,
    `Execution: ${body.execution||'UNKNOWN'}`,
  ];
  if(body.error_code)lines.push(`Code: ${body.error_code}`);
  if(body.receipt_id)lines.push(`Receipt: ${body.receipt_id}`);
  if(body.existing_command_id)lines.push(`Existing command: ${body.existing_command_id}`);
  if(body.result!=null)lines.push(`Result: ${compactMirrorJson(body.result,1100)}`);
  lines.push('Secrets/credentials are redacted before Telegram delivery.');
  return lines.join('\n').slice(0,3900);
}

async function sendFounderTelegramMirror(env,command,body){
  const token=clean(env.TELEGRAM_BOT_TOKEN_VICTOR,512),chatId=clean(String(env.VICTOR_FOUNDER_CHAT_ID??''),64);
  if(!token||!chatId)return{sent:false,reason:'TELEGRAM_MIRROR_BINDING_MISSING'};
  try{
    const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'content-type':'application/json','user-agent':'Hermes-ChatGPT-Telegram-Mirror/1.0'},body:JSON.stringify({chat_id:chatId,text:chatgptTelegramMirrorText(command,body),disable_web_page_preview:true})});
    return{sent:response.ok,status:response.status,reason:response.ok?null:'TELEGRAM_MIRROR_SEND_FAILED'};
  }catch(error){return{sent:false,reason:'TELEGRAM_MIRROR_SEND_EXCEPTION',error_type:error?.name||'Error'};}
}

async function sendTelegramSummary(env,message,action,body){
  const token=clean(env.TELEGRAM_BOT_TOKEN_VICTOR,512),chatId=clean(String(message?.chat?.id??''),64);
  if(!token||!chatId)return{sent:false,reason:'TELEGRAM_REPLY_BINDING_MISSING'};
  try{
    const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'content-type':'application/json','user-agent':'Hermes-Command-Control-Plane/1.0'},body:JSON.stringify({chat_id:chatId,text:telegramSummary(action,body),reply_to_message_id:message?.message_id||undefined,allow_sending_without_reply:true})});
    return{sent:response.ok,status:response.status,reason:response.ok?null:'TELEGRAM_SEND_FAILED'};
  }catch(error){return{sent:false,reason:'TELEGRAM_SEND_EXCEPTION',error_type:error?.name||'Error'};}
}

async function processTelegramUpdate(request,env,{passthroughOnNoMatch=false}={}){
  let update;
  try{update=await request.clone().json();}catch{return passthroughOnNoMatch?null:json({error:'invalid_json'},400);}
  const message=update?.message,route=parseHermesTelegramCommand(message?.text||'');
  if(!route)return passthroughOnNoMatch?null:json({ok:true,ignored:true,reason:'no_hermes_command_match'});
  if(!env.TELEGRAM_WEBHOOK_SECRET)return json({error:'telegram_secret_not_configured'},503);
  if((request.headers.get('X-Telegram-Bot-Api-Secret-Token')||'')!==env.TELEGRAM_WEBHOOK_SECRET)return json({error:'unauthorized'},401);
  const chatId=clean(String(message?.chat?.id??''),64),founderChat=clean(String(env.VICTOR_FOUNDER_CHAT_ID??''),64);
  if(!chatId||!founderChat||chatId!==founderChat)return json({ok:true,ignored:true,reason:'chat_not_authorized'});
  const command={command_id:commandId(),source:'telegram',actor:'founder',target:route.target,action:route.action,payload:route.payload||{},execution_mode:'manual',idempotency_key:idemTelegram(message,route)};
  const validation=validateHermesCommandEnvelope(command);
  if(!validation.ok)return json({ok:false,error:'command_validation_failed',reasons:validation.errors},400);
  const receipt=buildHermesReceipt({command:validation.command,status:'ACCEPTED',validation:'PASS',execution:'NOT_STARTED',receiptId:`rcpt_${validation.command.command_id}`});
  try{
    const routed=await acceptAndRoute(env,validation,receipt);
    const reply=await sendTelegramSummary(env,message,route.action,routed.body);
    return json({ok:true,...routed.body,telegram_reply_sent:reply.sent,telegram_reply_reason:reply.reason||null},200);
  }catch(error){return json({ok:false,error:String(error?.message||'command_persistence_or_routing_failed')},503);}
}

export async function handleHermesHttpRequestV2(request,env={}){
  const url=new URL(request.url);
  if(request.method==='GET'&&url.pathname==='/v1/health'){
    const capability=hermesHttpCapabilityV2(env);
    return json({service:'hermes-command-control-plane',status:capability.ready_for_authenticated_commands?'READY_FOR_COMMAND_ACCEPTANCE':'PENDING_CONFIGURATION',...capability,deployment_evidence:'NOT_ASSERTED_BY_HEALTH_ROUTE',live_request_verified:false,real_output_verified:false,secrets_exposed:false},capability.ready_for_authenticated_commands?200:503);
  }
  const assetMatch=/^\/v1\/assets\/([^/]+)$/.exec(url.pathname);
  if(request.method==='GET'&&assetMatch){
    if(!bearerAuthorized(request,env))return json({error:'unauthorized'},401);
    try{
      const asset=await getCentralRioFlyerAsset(env,decodeURIComponent(assetMatch[1]));
      if(!asset.found)return json({error:'asset_not_found'},404);
      const type=clean(asset?.metadata?.content_type,100)||'application/octet-stream';
      return new Response(asset.bytes,{status:200,headers:{'content-type':type,'cache-control':'private, no-store','x-hermes-asset-id':asset.asset_id}});
    }catch(error){return json({error:String(error?.message||'asset_read_failed')},503);}
  }
  const m=/^\/v1\/commands\/([^/]+)$/.exec(url.pathname);
  if(request.method==='GET'&&m){
    if(!bearerAuthorized(request,env))return json({error:'unauthorized'},401);
    try{const record=await getCommandState(env,decodeURIComponent(m[1]));if(!record.found)return json({error:'command_not_found'},404);return json({command:record.state,store:record.capability});}catch(error){return json({error:String(error?.message||'command_state_read_failed')},503);}
  }
  if(request.method==='POST'&&url.pathname==='/v1/commands'){
    const rawBody=await request.text();let input;try{input=JSON.parse(rawBody);}catch{return json({error:'invalid_json'},400);}
    const idempotencyKey=clean(request.headers.get('X-Idempotency-Key')||input?.idempotency_key,160);
    const a=await auth(request,env,rawBody,idempotencyKey);if(!a.ok)return json({error:'unauthorized',reasons:a.reasons,auth_version:a.auth_version},401);
    const validation=validateHermesCommandEnvelope({...input,idempotency_key:idempotencyKey});if(!validation.ok)return json({error:'command_validation_failed',reasons:validation.errors,classification:validation.classification,policy_version:validation.policy_version},400);
    const receipt=buildHermesReceipt({command:validation.command,status:'ACCEPTED',validation:'PASS',execution:'NOT_STARTED',receiptId:`rcpt_${validation.command.command_id}`});
    try{
      const routed=await acceptAndRoute(env,validation,receipt);
      let mirror={sent:false,reason:'NOT_CHATGPT_SOURCE'};
      if(validation.command.source==='chatgpt')mirror=await sendFounderTelegramMirror(env,validation.command,routed.body);
      return json({...routed.body,telegram_mirror_sent:mirror.sent,telegram_mirror_reason:mirror.reason||null},routed.http_status);
    }catch(error){return json({error:String(error?.message||'command_persistence_or_routing_failed')},503);}
  }
  if(request.method==='POST'&&url.pathname==='/integrations/telegram/webhook')return processTelegramUpdate(request,env,{passthroughOnNoMatch:false});
  if(request.method==='POST'&&url.pathname==='/telegram')return processTelegramUpdate(request,env,{passthroughOnNoMatch:true});
  return null;
}
