import { callVictorModel } from './model_router.mjs';
import { capabilitySummary, getCapability } from './capability_registry.mjs';
import { buildCapabilityGapPlan } from './capability_acquisition.mjs';

export const LLM_FIRST_BRAIN_VERSION = 'VICTOR_LLM_FIRST_BRAIN_V4';
const SAFE_MODES = new Set(['DIRECT_REPLY', 'READ_QUERY', 'ACTION', 'MULTI_AGENT', 'CAPABILITY_GAP']);
const SAFE_RISKS = new Set(['GREEN', 'AMBER', 'RED']);
function parseJson(content) { return JSON.parse(String(content || '').replace(/```json|```/gi, '').trim()); }
function normalizeDecision(candidate = {}) {
  const mode = String(candidate.mode || 'DIRECT_REPLY').toUpperCase(); const risk = String(candidate.risk || 'GREEN').toUpperCase(); const confidence = Number(candidate.confidence ?? 0);
  if (!SAFE_MODES.has(mode) || !SAFE_RISKS.has(risk) || !Number.isFinite(confidence)) return { mode:'DIRECT_REPLY', risk:'GREEN', confidence:0, direct_reply:null, capability_id:null, department:null, task:null, operation:null, arguments:{}, source:'llm-invalid' };
  return {
    mode, risk, confidence: Math.max(0,Math.min(1,confidence)), direct_reply:String(candidate.direct_reply||'').trim()||null,
    capability_id:String(candidate.capability_id||'').trim()||null,
    department:['victor','rio','aura3','aura2','tony_stark','hulk'].includes(candidate.department)?candidate.department:null,
    task:String(candidate.task||'').trim()||null,
    operation:String(candidate.operation||'').trim()||null,
    arguments:candidate.arguments && typeof candidate.arguments==='object' && !Array.isArray(candidate.arguments)?candidate.arguments:{},
    needs_evidence:candidate.needs_evidence===true, needs_memory:candidate.needs_memory===true,
    multi_agent_roles:Array.isArray(candidate.multi_agent_roles)?candidate.multi_agent_roles.map(String).slice(0,8):[], source:'llm-first',
  };
}

export async function decideFounderMessage(env,{text,conversation='',taskContext=null,now=new Date()}={}) {
  const nowIso=now instanceof Date?now.toISOString():new Date(now).toISOString(); const caps=capabilitySummary(env);
  const system=`You are the primary semantic decision brain for Dr. Victor. Understand the Founder's message BEFORE routing.
Hard rules:
- Normal conversation/general questions are DIRECT_REPLY unless fresh evidence is genuinely required.
- Date/time questions use CURRENT_TIME_UTC; never fetch department evidence for them.
- If the Founder asks whether Victor CAN read/search/access a repo or use a capability (for example "kya tum repo read kar sakte ho"), this is a capability question, not an execution request. Answer DIRECT_REPLY based on AVAILABLE_CAPABILITIES. Do not execute GitHub just to answer capability availability.
- If the Founder asks for Victor's own status, test report, health, runtime, production status, or "apna test report", use READ_QUERY with department "victor". Do not inherit RIO/AURA/Tony context for explicit self/Victor questions.
- READ_QUERY is read-only verified department/system information.
- ACTION is one executable task. Select the narrowest available capability.
- Context continuity is mandatory. RECENT_TASK_CONTEXT is the active semantic anchor for elliptical follow-ups unless the Founder explicitly switches topic/entity.
- If RECENT_TASK_CONTEXT.department exists and the Founder asks a short follow-up such as "last post kab", "uska status", "earning kitni", "kyu", "abhi kya pending", "dashboard dekho", or says "last conversation ke context me", inherit that same department instead of asking which entity they mean.
- Never resurrect an older unrelated topic from RECENT_CONVERSATION when a newer RECENT_TASK_CONTEXT exists.
- If the Founder asks to find/read/search a file, dashboard, link, path or repo content, use capability_id "github" with a read operation. Use operation "get_repo" for repo metadata, "get_file" for a known path, "list_repo" for browsing a repo, and "search_code" when the path is unknown. These read operations are GREEN.
- For GitHub mutations use operations such as "create_repo", "create_file" or "dispatch_workflow". Repo deletion, permission/security changes, secrets and destructive operations are RED.
- MULTI_AGENT only for genuinely complex work; choose only useful specialist roles.
- CAPABILITY_GAP only when current runtime capabilities cannot do the work.
- Never turn jokes/frustration/dismissive speech into actions.
- Never claim external completion in a direct reply.
- Never self-grant credentials, spend, destructive authority, security weakening or permission expansion.
Return JSON only: {"mode":"DIRECT_REPLY|READ_QUERY|ACTION|MULTI_AGENT|CAPABILITY_GAP","risk":"GREEN|AMBER|RED","confidence":0.0,"direct_reply":null,"capability_id":null,"department":null,"task":null,"operation":null,"arguments":{},"needs_evidence":false,"needs_memory":false,"multi_agent_roles":[]}
CURRENT_TIME_UTC: ${nowIso}
RECENT_CONVERSATION:\n${conversation||'(none)'}
RECENT_TASK_CONTEXT:\n${JSON.stringify(taskContext||null)}
AVAILABLE_CAPABILITIES:\n${JSON.stringify(caps)}`;
  try {
    const result=await callVictorModel(env,system,String(text||''),{task:'fast',maxTokens:450,temperature:0}); const decision=normalizeDecision(parseJson(result.content));
    if(decision.mode==='DIRECT_REPLY') return decision;
    if(decision.capability_id){ const capability=getCapability(decision.capability_id,env); if(!capability||!capability.available||capability.runtime_execute===false) return {...decision,mode:'CAPABILITY_GAP',acquisition_plan:buildCapabilityGapPlan({capability_id:decision.capability_id})}; }
    return decision;
  } catch(error) { return {mode:'DIRECT_REPLY',risk:'GREEN',confidence:0,direct_reply:null,capability_id:null,department:null,task:null,operation:null,arguments:{},needs_evidence:false,needs_memory:false,multi_agent_roles:[],source:'llm-first-failed',error:error?.name||'Error'}; }
}
