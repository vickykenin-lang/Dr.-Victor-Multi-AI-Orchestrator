import legacyRuntime, { processQueuedMessage as legacyProcessQueuedMessage, runChat } from './runtime_entry.js';
import { isAuthorizedFounderMessage } from './worker.js';
import { routeDeterministically } from './single_router.mjs';
import { decideFounderMessage } from './llm_first_brain.mjs';
import { executeTask } from './task_runtime.mjs';
import { answerDepartmentQuestion } from './department_query_runtime.mjs';
import { acquireCapability } from './capability_acquisition.mjs';
import { executeProviderCapability } from './capability_provider_runtime.mjs';
import { executeNativeCapability } from './native_tool_runtime.mjs';
import { transitionCapabilityTask } from './capability_task_state.mjs';
import { runMultiAgentPlan } from './multi_agent_orchestrator.mjs';
import { parseEdgeProxyControlCommand } from './edge_proxy_control.mjs';

const TELEGRAM_API='https://api.telegram.org';
const RESULT_TTL_SECONDS=86400,TASK_CONTEXT_TTL_SECONDS=6*3600,DIALOGUE_CONTEXT_TTL_SECONDS=30*86400,COURTESY_DELAY_MS=4000,COURTESY_TTL_SECONDS=3600;
function store(env){return env?.VICTOR_CONVERSATION_STATE&&typeof env.VICTOR_CONVERSATION_STATE.get==='function'?env.VICTOR_CONVERSATION_STATE:null;}
async function getJson(env,key){const kv=store(env);if(!kv)return null;try{const raw=await kv.get(key);return raw?JSON.parse(raw):null;}catch{return null;}}
async function putJson(env,key,value,ttl=RESULT_TTL_SECONDS){const kv=store(env);if(!kv)throw new Error('VICTOR_CONVERSATION_STATE_NOT_CONFIGURED');await kv.put(key,JSON.stringify(value),{expirationTtl:ttl});}
async function sendTelegram(env,chatId,text,replyToMessageId){const response=await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN_VICTOR}/sendMessage`,{method:'POST',headers:{'content-type':'application/json','user-agent':'Victor-LLM-First-Runtime/3.1'},body:JSON.stringify({chat_id:chatId,text:String(text||'').slice(0,4000),reply_to_message_id:replyToMessageId||undefined,allow_sending_without_reply:true})});if(!response.ok)throw new Error(`TELEGRAM_SEND_HTTP_${response.status}`);}
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function withCourtesy(env,ctx,meta,work){let finished=false;const key=`victor:courtesy:${meta.updateId}`;const courtesy=(async()=>{await delay(COURTESY_DELAY_MS);if(finished||await getJson(env,key))return;await putJson(env,key,{state:'RESERVED',at:new Date().toISOString()},COURTESY_TTL_SECONDS);try{await sendTelegram(env,meta.chatId,'Iske answer me thoda time lagega, main check kar raha hoon.',meta.messageId);await putJson(env,key,{state:'SENT',at:new Date().toISOString()},COURTESY_TTL_SECONDS);}catch{}})();if(ctx?.waitUntil)ctx.waitUntil(courtesy);else void courtesy;try{return await work();}finally{finished=true;}}
async function readConversation(env,chatId){const items=await getJson(env,`victor:dialogue-context:${chatId}`);return Array.isArray(items)?items.slice(-12).map(i=>`${i.role==='founder'?'Founder':i.role==='victor'?'Victor':'Context'}: ${i.text}`).join('\n'):'';}
async function appendDialogueTurn(env,chatId,founderText,victorText,decision){const key=`victor:dialogue-context:${chatId}`;const existing=await getJson(env,key);const items=Array.isArray(existing)?existing.slice(-10):[];items.push({role:'founder',text:String(founderText||'').slice(0,1200),at:new Date().toISOString()});if(decision?.mode==='DIRECT_REPLY'){items.push({role:'victor',text:String(victorText||'').slice(0,1200),at:new Date().toISOString()});}else{const parts=[`Previous turn mode=${decision?.mode||'UNKNOWN'}`];if(decision?.department)parts.push(`department=${decision.department}`);if(decision?.capability_id)parts.push(`capability=${decision.capability_id}`);if(decision?.task)parts.push(`task=${String(decision.task).slice(0,240)}`);items.push({role:'context',text:parts.join('; '),at:new Date().toISOString()});}await putJson(env,key,items.slice(-12),DIALOGUE_CONTEXT_TTL_SECONDS);}
async function readTaskContext(env,chatId){return getJson(env,`victor:task-context:${chatId}`);}
async function writeTaskContext(env,chatId,decision){if(!decision?.department)return;await putJson(env,`victor:task-context:${chatId}`,{department:decision.department,type:decision.mode,action:decision.task||decision.capability_id||null,updated_at:new Date().toISOString()},TASK_CONTEXT_TTL_SECONDS);}
function actionRoute(decision){return{type:'ACTION',department:decision.department||null,action:decision.risk==='RED'?'sensitive_action':'department_action',risk:decision.risk||'AMBER',confidence:decision.confidence||.9,source:'llm-first'};}
function renderAcquisitionState(acq){const cap=acq?.task?.requested_capability||acq?.provider?.capability_id||'required capability';if(acq?.state==='WAITING_AUTH'){const req=acq.task?.required_founder_input;return `Capability solution identified for ${cap}, but external authority/configuration is required before execution.${req?.endpoint_binding?`\nRequired adapter binding: ${req.endpoint_binding}${req.optional_secret_binding?`\nCredential binding (if provider requires it): ${req.optional_secret_binding}`:''}`:''}\nOriginal task is saved in WAITING_AUTH and is not marked completed.`;}if(acq?.state==='FAILED')return`Capability ${cap} staging/health verification failed. Original task is preserved and completion is not claimed.`;return`Capability ${cap} is not yet executable. Original task is preserved for governed resume.`;}
function renderResult(result){const output=result?.result?.output??result?.result?.result??result?.result?.message??result?.result;return typeof output==='string'?output:JSON.stringify(output,null,2).slice(0,3800);}

async function executeAcquiredCapability(env,decision,text,updateId){
  const capabilityId=decision.capability_id;const acq=await acquireCapability(env,{taskId:updateId,text,capabilityId,risk:decision.risk||'GREEN'});
  if(!acq.resume)return{reply:renderAcquisitionState(acq),verified:false,acquisition:acq};
  let result;
  if(acq.native) result=await executeNativeCapability(env,capabilityId,decision.operation,decision.arguments||{});
  else result=await executeProviderCapability(env,capabilityId,{task:decision.task||text,operation:decision.operation||null,arguments:decision.arguments||{},original_text:text});
  if(!result.ok||!result.verified){await transitionCapabilityTask(env,updateId,'SAFE_HOLD',{provider_result:{state:result.state,verified:false},note:'CAPABILITY_RESULT_NOT_VERIFIED'});return{reply:`Capability ${capabilityId} responded, but the result was not verified. Task is in SAFE_HOLD; completion is not claimed.`,verified:false,acquisition:acq,provider_result:result};}
  if(result.state==='DISPATCHED'){await transitionCapabilityTask(env,updateId,'DISPATCHED',{provider_result:{state:'DISPATCHED',verified:true},note:'ACTION_DISPATCHED_AWAITING_RESULT'});return{reply:`GitHub action dispatched successfully. ${renderResult(result)}\nCompletion is not claimed until downstream result evidence is received.`,verified:true,completed:false,acquisition:acq,provider_result:result};}
  await transitionCapabilityTask(env,updateId,'RESULT_RECEIVED',{provider_result:{state:result.state,verified:true}});await transitionCapabilityTask(env,updateId,'COMPLETED',{note:'VERIFIED_CAPABILITY_RESULT'});
  return{reply:renderResult(result),verified:true,completed:true,acquisition:acq,provider_result:result};
}

async function processLlmFirstMessage(env,ctx,envelope){
  const update=envelope?.update||{},message=update?.message;if(!message?.chat?.id||!message?.from?.id)return;
  const chatId=String(message.chat.id),senderId=String(message.from.id);if(!isAuthorizedFounderMessage(env,chatId,senderId))return;
  const text=String(message.text||'').trim();if(!text)return;const updateId=String(update.update_id??message.message_id??'unknown'),resultKey=`victor:telegram-result:${updateId}`;
  const cached=await getJson(env,resultKey);if(cached?.reply){await sendTelegram(env,chatId,cached.reply,message.message_id);return;}
  const hard=routeDeterministically(text,{});if(hard.type==='APPROVAL'||hard.type==='STOP'||parseEdgeProxyControlCommand(text))return legacyProcessQueuedMessage(env,ctx,envelope);
  const meta={updateId,chatId,messageId:message.message_id},conversation=await readConversation(env,chatId),taskContext=await readTaskContext(env,chatId);
  const decision=await withCourtesy(env,ctx,meta,()=>decideFounderMessage(env,{text,conversation,taskContext,now:new Date()}));let reply,verified=false,completed=false;
  if(decision.mode==='DIRECT_REPLY') reply=decision.direct_reply||await withCourtesy(env,ctx,meta,()=>runChat(env,chatId,text));
  else if(decision.mode==='READ_QUERY'&&decision.department){const result=await withCourtesy(env,ctx,meta,()=>answerDepartmentQuestion(env,decision.department,text));reply=result.reply;verified=result.verified===true;completed=verified;await writeTaskContext(env,chatId,decision);}
  else if(decision.mode==='CAPABILITY_GAP'){const result=await withCourtesy(env,ctx,meta,()=>executeAcquiredCapability(env,decision,text,updateId));reply=result.reply;verified=result.verified;completed=result.completed===true;}
  else if(decision.mode==='MULTI_AGENT'){const plan=await withCourtesy(env,ctx,meta,()=>runMultiAgentPlan(env,{task:decision.task||text,roles:decision.multi_agent_roles}));const needs=[...new Set(plan.capability_needs||[])];reply=`Complex task planned by specialists: ${(plan.roles||[]).join(', ')||'none'}.\nExecution plan:\n${(plan.plan||[]).slice(0,8).map(s=>`${s.step||'-'}: ${s.owner||'Victor'} — ${s.action||''}`).join('\n')||'No executable specialist plan returned.'}${needs.length?`\nCapability needs: ${needs.join(', ')}`:''}\nNo external execution is claimed until the required capability/action path returns verified evidence.`;}
  else if(decision.mode==='ACTION'){
    const route=actionRoute(decision);if(route.risk==='RED')return legacyProcessQueuedMessage(env,ctx,envelope);
    if(!decision.department&&decision.capability_id){const result=await withCourtesy(env,ctx,meta,()=>executeAcquiredCapability(env,decision,text,updateId));reply=result.reply;verified=result.verified;completed=result.completed===true;}
    else{const result=await withCourtesy(env,ctx,meta,()=>executeTask(env,route,decision.task||text,message.message_id,updateId));if(result.delegate_legacy)return legacyProcessQueuedMessage(env,ctx,envelope);reply=result.reply;verified=result.verified===true;completed=verified;await writeTaskContext(env,chatId,decision);}
  } else reply=await withCourtesy(env,ctx,meta,()=>runChat(env,chatId,text));
  await appendDialogueTurn(env,chatId,text,reply,decision);
  await putJson(env,resultKey,{reply,type:decision.mode,llm_first:true,verified,completed,completed_at:completed?new Date().toISOString():null,processed_at:new Date().toISOString()},RESULT_TTL_SECONDS);await sendTelegram(env,chatId,reply,message.message_id);
}

export default{fetch(request,env,ctx){return legacyRuntime.fetch(request,env,ctx);},scheduled(controller,env,ctx){return legacyRuntime.scheduled(controller,env,ctx);},async queue(batch,env,ctx){for(const message of batch.messages){try{await processLlmFirstMessage(env,ctx,message.body);message.ack();}catch(error){console.error(JSON.stringify({event:'VICTOR_LLM_FIRST_QUEUE_FAILED',error:error?.message||error?.name||'Error',secrets_exposed:false}));message.retry({delaySeconds:10});}}}};
export{processLlmFirstMessage};
