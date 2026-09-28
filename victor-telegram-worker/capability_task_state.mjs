export const CAPABILITY_TASK_STATE_VERSION = 'VICTOR_CAPABILITY_TASK_STATE_V1';

export const TASK_STATES = Object.freeze([
  'RECEIVED', 'PLANNED', 'CAPABILITY_GAP', 'ACQUIRING', 'WAITING_AUTH',
  'STAGED', 'VERIFIED', 'RESUMED', 'RESULT_RECEIVED', 'COMPLETED', 'FAILED', 'SAFE_HOLD',
]);

const ALLOWED = Object.freeze({
  RECEIVED: ['PLANNED', 'FAILED', 'SAFE_HOLD'],
  PLANNED: ['CAPABILITY_GAP', 'RESUMED', 'FAILED', 'SAFE_HOLD'],
  CAPABILITY_GAP: ['ACQUIRING', 'WAITING_AUTH', 'FAILED', 'SAFE_HOLD'],
  ACQUIRING: ['WAITING_AUTH', 'STAGED', 'FAILED', 'SAFE_HOLD'],
  WAITING_AUTH: ['ACQUIRING', 'FAILED', 'SAFE_HOLD'],
  STAGED: ['VERIFIED', 'FAILED', 'SAFE_HOLD'],
  VERIFIED: ['RESUMED', 'FAILED', 'SAFE_HOLD'],
  RESUMED: ['RESULT_RECEIVED', 'CAPABILITY_GAP', 'FAILED', 'SAFE_HOLD'],
  RESULT_RECEIVED: ['COMPLETED', 'FAILED', 'SAFE_HOLD'],
  COMPLETED: [], FAILED: [], SAFE_HOLD: ['ACQUIRING', 'RESUMED', 'FAILED'],
});

function kv(env) {
  return env?.VICTOR_CONVERSATION_STATE && typeof env.VICTOR_CONVERSATION_STATE.get === 'function'
    ? env.VICTOR_CONVERSATION_STATE : null;
}

export function taskStateKey(taskId) { return `victor:capability-task:${taskId}`; }

export async function readCapabilityTask(env, taskId) {
  const store = kv(env); if (!store || !taskId) return null;
  try { const raw = await store.get(taskStateKey(taskId)); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export async function createCapabilityTask(env, { taskId, text, capabilityId = null, risk = 'GREEN', metadata = {} } = {}) {
  const store = kv(env); if (!store) throw new Error('VICTOR_CONVERSATION_STATE_NOT_CONFIGURED');
  const now = new Date().toISOString();
  const record = { version: CAPABILITY_TASK_STATE_VERSION, task_id: taskId, original_task: String(text || ''), requested_capability: capabilityId, risk, state: 'RECEIVED', created_at: now, updated_at: now, metadata, history: [{ state: 'RECEIVED', at: now }] };
  await store.put(taskStateKey(taskId), JSON.stringify(record), { expirationTtl: 7 * 86400 });
  return record;
}

export async function transitionCapabilityTask(env, taskId, nextState, patch = {}) {
  if (!TASK_STATES.includes(nextState)) throw new Error(`INVALID_CAPABILITY_TASK_STATE:${nextState}`);
  const current = await readCapabilityTask(env, taskId);
  if (!current) throw new Error('CAPABILITY_TASK_NOT_FOUND');
  if (current.state !== nextState && !(ALLOWED[current.state] || []).includes(nextState)) throw new Error(`INVALID_CAPABILITY_TASK_TRANSITION:${current.state}->${nextState}`);
  const now = new Date().toISOString();
  const next = { ...current, ...patch, state: nextState, updated_at: now, history: [...(current.history || []), { state: nextState, at: now, note: patch.note || undefined }].slice(-30) };
  await kv(env).put(taskStateKey(taskId), JSON.stringify(next), { expirationTtl: 7 * 86400 });
  return next;
}

export function isTerminalCapabilityTask(state) { return ['COMPLETED', 'FAILED'].includes(String(state || '')); }
