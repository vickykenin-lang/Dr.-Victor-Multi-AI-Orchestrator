import { callVictorModel } from './model_router.mjs';

export const MULTI_AGENT_ORCHESTRATOR_VERSION = 'VICTOR_MULTI_AGENT_ORCHESTRATOR_V1';
const ROLES = new Set(['dev', 'infra', 'research', 'ops', 'qa', 'creative', 'business']);

function cleanRoles(roles = []) {
  return [...new Set(roles.map(r => String(r).toLowerCase()).filter(r => ROLES.has(r)))].slice(0, 6);
}

async function runSpecialist(env, role, task) {
  const system = `You are Victor's ${role.toUpperCase()} specialist. Work only as an advisory specialist. Do not claim external actions, deployments, purchases, publications or tool results that you did not actually receive. Analyze the task, identify executable steps, dependencies, risks and verification. Be concise. Return JSON only: {"role":"${role}","analysis":"...","recommended_steps":["..."],"capability_needs":["..."],"risks":["..."],"verification":["..."]}`;
  const out = await callVictorModel(env, system, String(task || ''), { task: 'fast', maxTokens: 700, temperature: 0 });
  try { return JSON.parse(String(out.content || '').replace(/```json|```/gi, '').trim()); }
  catch { return { role, analysis: String(out.content || '').slice(0, 1800), recommended_steps: [], capability_needs: [], risks: [], verification: [] }; }
}

export async function runMultiAgentPlan(env, { task, roles = [] } = {}) {
  const selected = cleanRoles(roles);
  if (!selected.length) return { ok: false, state: 'NO_SPECIALIST_ROLES', roles: [], specialists: [] };
  const specialists = await Promise.all(selected.map(role => runSpecialist(env, role, task)));
  const synthesisSystem = `You are Victor's lead orchestrator. Merge specialist advice into one execution plan. Do not invent completed work. Separate parallel and sequential work, capability gaps, approval requirements and acceptance evidence. Return JSON only: {"plan":[{"step":1,"owner":"role","action":"...","depends_on":[],"parallel_group":null}],"capability_needs":["..."],"approval_needs":["..."],"acceptance":["..."]}`;
  const synthesisInput = JSON.stringify({ task, specialists });
  const out = await callVictorModel(env, synthesisSystem, synthesisInput, { task: 'fast', maxTokens: 1000, temperature: 0 });
  let plan;
  try { plan = JSON.parse(String(out.content || '').replace(/```json|```/gi, '').trim()); }
  catch { plan = { plan: [], capability_needs: [], approval_needs: [], acceptance: [], raw: String(out.content || '').slice(0, 2500) }; }
  return { ok: true, state: 'PLANNED', version: MULTI_AGENT_ORCHESTRATOR_VERSION, roles: selected, specialists, ...plan, external_execution_claimed: false };
}
