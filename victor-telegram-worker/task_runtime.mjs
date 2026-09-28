import {
  aura3BridgeConfigured, dispatchAura3Task, waitForAura3Result, verifyAura3Result, formatAura3ResultForFounder,
  rioBridgeConfigured, dispatchRioTask, waitForRioResult, verifyRioResult, formatRioResultForFounder,
  tonyBridgeConfigured, dispatchTonyTask, waitForTonyResult, verifyTonyResult, formatTonyResultForFounder,
} from './department_bridge.mjs';
import { getDepartmentFactSource, extractDepartmentFact, formatDepartmentFact } from './department_fact_registry.mjs';
import { resolveProcedureRoute } from '../brain/procedure_registry.mjs';

const REGISTRY_URL = 'https://raw.githubusercontent.com/vickykenin-lang/Dr.-Victor-Multi-AI-Orchestrator/main/data/department_registry.json';
const TASK_STATE_TTL_SECONDS = 86400;

function stateStore(env) {
  return env?.VICTOR_CONVERSATION_STATE && typeof env.VICTOR_CONVERSATION_STATE.get === 'function' ? env.VICTOR_CONVERSATION_STATE : null;
}

async function readTaskState(env, key) {
  const store = stateStore(env);
  if (!store || !key) return null;
  try {
    const raw = await store.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function writeTaskState(env, key, value) {
  const store = stateStore(env);
  if (!store || !key) return;
  await store.put(key, JSON.stringify(value), { expirationTtl: TASK_STATE_TTL_SECONDS });
}

async function fetchJson(url, userAgent) {
  const response = await fetch(`${url}?t=${Date.now()}`, {
    headers: { 'User-Agent': userAgent, 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) throw new Error(`EVIDENCE_HTTP_${response.status}`);
  return response.json();
}

async function fetchRegistry() {
  return fetchJson(REGISTRY_URL, 'Victor-Deterministic-Status/1.0');
}

function departmentName(id) {
  return ({ rio: 'RIO', aura3: 'AURA3', aura2: 'AURA2', tony_stark: 'Tony Stark', hulk: 'HULK' })[id] || id || 'Unknown';
}

export async function renderDepartmentStatus(department) {
  const registry = await fetchRegistry();
  const item = Array.isArray(registry?.departments) ? registry.departments.find(d => d.id === department) : null;
  const fetchedAt = new Date().toISOString();
  if (!item) {
    return `Canonical status snapshot\nDepartment: ${departmentName(department)}\nStatus: NOT_REGISTERED\nFetched at: ${fetchedAt}`;
  }
  const lines = [
    'Canonical status snapshot',
    `Department: ${item.name || departmentName(department)}`,
    `Status: ${item.status || 'UNKNOWN'}`,
    `Victor connection: ${item.victor_connection || 'NOT_RECORDED'}`,
    `Live certification: ${item.live_certification || 'NOT_RECORDED'}`,
    `Business execution: ${item.business_execution || 'NOT_RECORDED'}`,
  ];
  if (item.objective) lines.push(`Objective: ${item.objective}`);
  const verifiedAt = item.post_v2_certification_verified_at || item.post_v2_recertification_checked_at || item.connection_verified_at || null;
  if (verifiedAt) lines.push(`Last recorded verification: ${verifiedAt}`);
  lines.push(`Fetched at: ${fetchedAt}`);
  lines.push('Source: canonical department registry; no LLM-generated status facts.');
  return lines.join('\n');
}

export async function renderDepartmentFact(department, factType) {
  const source = getDepartmentFactSource(department, factType);
  const fetchedAt = new Date().toISOString();
  if (!source) {
    return {
      reply: `${departmentName(department)} fact\nRequested fact: ${factType}\nVerified source: NOT_REGISTERED\nNo department action was dispatched.\nFetched at: ${fetchedAt}`,
      verified: false,
      capability_gap: 'DEPARTMENT_FACT_SOURCE_NOT_REGISTERED',
    };
  }
  const payload = await fetchJson(source.url, 'Victor-Department-Fact-Query/1.0');
  const fact = extractDepartmentFact(source, payload);
  return {
    reply: formatDepartmentFact({ departmentName: departmentName(department), fact, sourceLabel: source.source_label, fetchedAt }),
    verified: Boolean(fact),
    capability_gap: fact ? null : 'VERIFIED_FACT_NOT_AVAILABLE',
  };
}

async function resolveOrDispatch(env, target, text, messageId, operationKey) {
  const stateKey = operationKey ? `victor:department-task:${operationKey}` : null;
  const existing = await readTaskState(env, stateKey);
  if (existing?.taskId && existing?.target === target) return existing;

  let dispatch;
  if (target === 'aura3') dispatch = await dispatchAura3Task(env, text, { messageId });
  else if (target === 'rio') dispatch = await dispatchRioTask(env, text, { messageId });
  else if (target === 'tony_stark') dispatch = await dispatchTonyTask(env, text, { messageId });
  else return null;

  const state = { target, taskId: dispatch.taskId, taskType: dispatch.taskType, dispatched_at: new Date().toISOString() };
  await writeTaskState(env, stateKey, state);
  return state;
}

async function executeDepartmentAction(env, route, text, messageId, operationKey = null) {
  const target = route.department;
  const routePolicy = resolveProcedureRoute({ type: 'ACTION', department: target, action: route.action, risk: route.risk });
  if (!routePolicy.ok) return { reply: `Task route blocked: ${routePolicy.reason}.`, verified: false, routePolicy };

  if (target === 'aura3') {
    if (!aura3BridgeConfigured(env)) return { reply: 'AURA3 bridge configured nahi hai. Koi task dispatch nahi hua.', verified: false, routePolicy };
    const dispatch = await resolveOrDispatch(env, target, text, messageId, operationKey);
    const received = await waitForAura3Result(dispatch.taskId, { attempts: 18, delayMs: 4000 });
    if (received.status !== 'RESULT_RECEIVED') return { reply: `AURA3 task ${dispatch.taskId} dispatch hua, lekin verified result abhi receive nahi hua. Completion claim nahi ki gayi.`, verified: false, taskId: dispatch.taskId, routePolicy };
    const verification = verifyAura3Result(received.result, dispatch.taskId);
    if (!verification.ok) return { reply: `AURA3 result receive hua lekin evidence verification fail hui. Completion claim nahi ki gayi. Task: ${dispatch.taskId}`, verified: false, taskId: dispatch.taskId, routePolicy };
    return { reply: formatAura3ResultForFounder(received.result), verified: true, taskId: dispatch.taskId, routePolicy };
  }

  if (target === 'rio') {
    if (!rioBridgeConfigured(env)) return { reply: 'RIO bridge configured nahi hai. Koi task dispatch nahi hua.', verified: false, routePolicy };
    const dispatch = await resolveOrDispatch(env, target, text, messageId, operationKey);
    const received = await waitForRioResult(dispatch.taskId, { attempts: 18, delayMs: 4000 });
    if (received.status !== 'RESULT_RECEIVED') return { reply: `RIO task ${dispatch.taskId} dispatch hua, lekin verified result abhi receive nahi hua. Completion claim nahi ki gayi.`, verified: false, taskId: dispatch.taskId, routePolicy };
    const verification = verifyRioResult(received.result, dispatch.taskId);
    if (!verification.ok) return { reply: `RIO result receive hua lekin evidence verification fail hui. Completion claim nahi ki gayi. Task: ${dispatch.taskId}`, verified: false, taskId: dispatch.taskId, routePolicy };
    return { reply: formatRioResultForFounder(received.result), verified: true, taskId: dispatch.taskId, routePolicy };
  }

  if (target === 'tony_stark') {
    if (!tonyBridgeConfigured(env)) return { reply: 'Tony Stark bridge configured nahi hai. Koi task dispatch nahi hua.', verified: false, routePolicy };
    const dispatch = await resolveOrDispatch(env, target, text, messageId, operationKey);
    const received = await waitForTonyResult(dispatch.taskId, env, { attempts: 18, delayMs: 4000 });
    if (received.status !== 'RESULT_RECEIVED') return { reply: `Tony Stark task ${dispatch.taskId} dispatch hua, lekin verified result abhi receive nahi hua. Completion claim nahi ki gayi.`, verified: false, taskId: dispatch.taskId, routePolicy };
    const verification = verifyTonyResult(received.result, dispatch.taskId);
    if (!verification.ok) return { reply: `Tony Stark result receive hua lekin evidence verification fail hui. Completion claim nahi ki gayi. Task: ${dispatch.taskId}`, verified: false, taskId: dispatch.taskId, routePolicy };
    return { reply: formatTonyResultForFounder(received.result), verified: true, taskId: dispatch.taskId, routePolicy };
  }

  return { delegate_legacy: true, routePolicy };
}

export async function executeTask(env, route, text, messageId, operationKey = null) {
  if (route.type === 'STATUS') {
    const routePolicy = resolveProcedureRoute({ type: 'STATUS', department: route.department, action: 'status', risk: 'GREEN' });
    return { reply: await renderDepartmentStatus(route.department), verified: true, routePolicy };
  }
  if (route.type === 'FACT_QUERY') {
    const routePolicy = resolveProcedureRoute({ type: 'FACT_QUERY', department: route.department, action: route.action, risk: 'GREEN' });
    if (!routePolicy.ok) return { reply: `Fact route blocked: ${routePolicy.reason}.`, verified: false, routePolicy };
    const result = await renderDepartmentFact(route.department, route.action);
    return { ...result, routePolicy };
  }
  if (route.type === 'ACTION') return executeDepartmentAction(env, route, text, messageId, operationKey);
  if (route.type === 'REMINDER') {
    const routePolicy = resolveProcedureRoute({ type: 'REMINDER', action: 'create_reminder', risk: 'GREEN' });
    return {
      reply: 'Reminder intent correctly identify hua hai, lekin durable reminder scheduler abhi verified capability nahi hai. Main fake scheduling claim nahi karunga.',
      verified: false,
      routePolicy,
      capability_gap: 'DURABLE_REMINDER_SCHEDULER_NOT_VERIFIED',
    };
  }
  return { delegate_legacy: true };
}
