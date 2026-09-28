import { callVictorModel } from './model_router.mjs';
import { capabilitySummary, getCapability } from './capability_registry.mjs';
import { buildCapabilityGapPlan } from './capability_acquisition.mjs';

export const LLM_FIRST_BRAIN_VERSION = 'VICTOR_LLM_FIRST_BRAIN_V1';

const SAFE_MODES = new Set(['DIRECT_REPLY', 'READ_QUERY', 'ACTION', 'MULTI_AGENT', 'CAPABILITY_GAP']);
const SAFE_RISKS = new Set(['GREEN', 'AMBER', 'RED']);

function parseJson(content) {
  const raw = String(content || '').replace(/```json|```/gi, '').trim();
  return JSON.parse(raw);
}

function normalizeDecision(candidate = {}) {
  const mode = String(candidate.mode || 'DIRECT_REPLY').toUpperCase();
  const risk = String(candidate.risk || 'GREEN').toUpperCase();
  const capabilityId = String(candidate.capability_id || '').trim() || null;
  const department = ['rio', 'aura3', 'aura2', 'tony_stark', 'hulk'].includes(candidate.department) ? candidate.department : null;
  const confidence = Number(candidate.confidence ?? 0);
  const directReply = String(candidate.direct_reply || '').trim() || null;
  const task = String(candidate.task || '').trim() || null;

  if (!SAFE_MODES.has(mode) || !SAFE_RISKS.has(risk) || !Number.isFinite(confidence)) {
    return { mode: 'DIRECT_REPLY', risk: 'GREEN', confidence: 0, direct_reply: null, capability_id: null, department: null, task: null, source: 'llm-invalid' };
  }

  return {
    mode,
    risk,
    confidence: Math.max(0, Math.min(1, confidence)),
    direct_reply: directReply,
    capability_id: capabilityId,
    department,
    task,
    needs_evidence: candidate.needs_evidence === true,
    needs_memory: candidate.needs_memory === true,
    multi_agent_roles: Array.isArray(candidate.multi_agent_roles) ? candidate.multi_agent_roles.map(String).slice(0, 8) : [],
    source: 'llm-first',
  };
}

export async function decideFounderMessage(env, { text, conversation = '', taskContext = null, now = new Date() } = {}) {
  const nowIso = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const caps = capabilitySummary();
  const system = `You are the primary semantic decision brain for Dr. Victor. Understand the Founder's message BEFORE routing.\n\nHard rules:\n- Normal conversation, jokes, frustration, general knowledge and ordinary questions should be DIRECT_REPLY unless fresh external/system evidence is genuinely required.\n- Current date/time questions use CURRENT_TIME_UTC supplied below. Do not fetch department evidence for them.\n- READ_QUERY is for read-only questions about a department/system/tool where verified data is needed.\n- ACTION is for one executable task.\n- MULTI_AGENT is only for genuinely complex work requiring multiple specialist capabilities.\n- CAPABILITY_GAP is for tasks that cannot be completed by currently available capabilities.\n- Never turn dismissive speech such as 'bhag jao' into an action.\n- Never claim an external action is completed in a direct reply.\n- Never self-grant credentials, spend, destructive authority, security weakening or permission expansion.\n\nReturn JSON only with schema:\n{"mode":"DIRECT_REPLY|READ_QUERY|ACTION|MULTI_AGENT|CAPABILITY_GAP","risk":"GREEN|AMBER|RED","confidence":0.0,"direct_reply":null,"capability_id":null,"department":null,"task":null,"needs_evidence":false,"needs_memory":false,"multi_agent_roles":[]}\n\nCURRENT_TIME_UTC: ${nowIso}\nRECENT_CONVERSATION:\n${conversation || '(none)'}\nRECENT_TASK_CONTEXT:\n${JSON.stringify(taskContext || null)}\nAVAILABLE_CAPABILITIES:\n${JSON.stringify(caps)}`;

  try {
    const result = await callVictorModel(env, system, String(text || ''), { task: 'fast', maxTokens: 300, temperature: 0 });
    const decision = normalizeDecision(parseJson(result.content));

    if (decision.mode === 'DIRECT_REPLY') return decision;

    if (decision.capability_id) {
      const capability = getCapability(decision.capability_id);
      if (!capability || !capability.available) {
        return {
          ...decision,
          mode: 'CAPABILITY_GAP',
          acquisition_plan: buildCapabilityGapPlan({ capability_id: decision.capability_id }),
        };
      }
    }

    return decision;
  } catch (error) {
    return {
      mode: 'DIRECT_REPLY',
      risk: 'GREEN',
      confidence: 0,
      direct_reply: null,
      capability_id: null,
      department: null,
      task: null,
      needs_evidence: false,
      needs_memory: false,
      multi_agent_roles: [],
      source: 'llm-first-failed',
      error: error?.name || 'Error',
    };
  }
}
