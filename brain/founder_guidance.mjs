const ACTIVE_KEY = 'victor:founder-guidance:active:v1';
const KEY_PREFIX = 'victor:founder-guidance:v1:';

function norm(value) {
  return String(value || '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

function binding(env = {}) {
  const store = env.VICTOR_CONVERSATION_STATE;
  return store && typeof store.get === 'function' && typeof store.put === 'function' ? store : null;
}

function guidanceKey(goalId) {
  return `${KEY_PREFIX}${encodeURIComponent(norm(goalId))}`;
}

async function readJson(store, key) {
  if (!store) return null;
  try {
    const raw = await store.get(key, { type: 'json' });
    if (raw && typeof raw === 'object') return raw;
  } catch (_) {}
  try {
    const raw = await store.get(key);
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (_) {
    return null;
  }
}

async function writeJson(store, key, value) {
  await store.put(key, JSON.stringify(value));
  return value;
}

export function founderGuidanceCapability(env = {}) {
  return binding(env)
    ? { available: true, durable: true, binding: 'VICTOR_CONVERSATION_STATE' }
    : { available: false, durable: false, binding: null, reason: 'DURABLE_GUIDANCE_STORE_UNAVAILABLE' };
}

export function buildFounderGuidanceRequest({ goal = {}, reasonedPlan = {}, runtimeGoal = {} } = {}) {
  const goalId = norm(goal.goal_id);
  const question = norm(reasonedPlan.founder_question);
  if (!goalId) throw Object.assign(new Error('Founder guidance goal_id required'), { code: 'FOUNDER_GUIDANCE_GOAL_REQUIRED' });
  if (reasonedPlan.needs_founder_guidance !== true || !question) {
    throw Object.assign(new Error('Founder guidance requires an explicit precise question'), { code: 'FOUNDER_GUIDANCE_QUESTION_REQUIRED' });
  }

  const checked = [];
  if (runtimeGoal.last_status) checked.push(`Last verified status: ${runtimeGoal.last_status}`);
  if (runtimeGoal.last_root_cause) checked.push(`Root cause/evidence: ${runtimeGoal.last_root_cause}`);
  if (runtimeGoal.last_progress_delta?.reason) checked.push(`No-progress reason: ${runtimeGoal.last_progress_delta.reason}`);
  if (Array.isArray(runtimeGoal.evidence) && runtimeGoal.evidence.length) {
    checked.push(`Evidence refs checked: ${runtimeGoal.evidence.slice(-5).join(', ')}`);
  }

  return {
    schema_version: 1,
    guidance_id: `${goalId}:${Number(runtimeGoal.recovery_generation || 0) + 1}`,
    goal_id: goalId,
    objective: norm(goal.objective || goal.title),
    strategy_summary: norm(reasonedPlan.strategy_summary),
    checked,
    unknowns: Array.isArray(reasonedPlan.unknowns) ? reasonedPlan.unknowns.map(norm).filter(Boolean) : [],
    evidence_needed: Array.isArray(reasonedPlan.evidence_needed) ? reasonedPlan.evidence_needed.map(norm).filter(Boolean) : [],
    exact_question: question,
    status: 'PENDING',
    scope: 'GOAL',
    provenance: 'INFERRED_REQUEST',
    requested_at_utc: nowIso(),
    answered_at_utc: null,
    consumed_at_utc: null,
    answer: null,
    telegram_message_id: null,
    founder_answer_message_id: null,
    generation: Number(runtimeGoal.recovery_generation || 0) + 1,
  };
}

export async function readFounderGuidance(env = {}, goalId) {
  const store = binding(env);
  if (!store || !norm(goalId)) return null;
  return readJson(store, guidanceKey(goalId));
}

export async function readActiveFounderGuidance(env = {}) {
  const store = binding(env);
  if (!store) return null;
  const pointer = await readJson(store, ACTIVE_KEY);
  if (!pointer?.goal_id) return null;
  return readJson(store, guidanceKey(pointer.goal_id));
}

export async function persistFounderGuidanceRequest(env = {}, request = {}) {
  const store = binding(env);
  if (!store) {
    return { status: 'PENDING_CONFIGURATION', reason: 'DURABLE_GUIDANCE_STORE_UNAVAILABLE', record: null };
  }
  if (!request?.goal_id || request?.status !== 'PENDING') {
    throw Object.assign(new Error('Invalid Founder guidance request'), { code: 'FOUNDER_GUIDANCE_REQUEST_INVALID' });
  }

  const existing = await readJson(store, guidanceKey(request.goal_id));
  if (existing?.status === 'PENDING' && existing?.exact_question === request.exact_question) {
    await writeJson(store, ACTIVE_KEY, { goal_id: request.goal_id, guidance_id: existing.guidance_id, updated_at_utc: nowIso() });
    return { status: 'ALREADY_PENDING', record: existing };
  }

  const record = {
    ...request,
    prior_guidance_id: existing?.guidance_id || null,
    persisted_at_utc: nowIso(),
  };
  await writeJson(store, guidanceKey(request.goal_id), record);
  await writeJson(store, ACTIVE_KEY, { goal_id: request.goal_id, guidance_id: record.guidance_id, updated_at_utc: nowIso() });
  return { status: 'PERSISTED', record };
}

export async function attachFounderGuidanceMessage(env = {}, goalId, telegramMessageId) {
  const store = binding(env);
  if (!store) return { status: 'PENDING_CONFIGURATION', record: null };
  const current = await readJson(store, guidanceKey(goalId));
  if (!current) return { status: 'NOT_FOUND', record: null };
  const next = {
    ...current,
    telegram_message_id: telegramMessageId == null ? current.telegram_message_id : Number(telegramMessageId),
    message_bound_at_utc: nowIso(),
  };
  await writeJson(store, guidanceKey(goalId), next);
  return { status: 'UPDATED', record: next };
}

export function shouldTreatAsFounderGuidanceAnswer(text, message = {}, pending = null) {
  if (!pending || pending.status !== 'PENDING') return false;
  const value = norm(text);
  if (!value) return false;
  if (/^(guidance|decision|answer)\s*:/i.test(value)) return true;
  const repliedTo = Number(message?.reply_to_message?.message_id || 0);
  const expected = Number(pending.telegram_message_id || 0);
  return Boolean(expected && repliedTo && expected === repliedTo);
}

export function normalizeFounderGuidanceAnswer(text) {
  return norm(text).replace(/^(guidance|decision|answer)\s*:\s*/i, '').trim();
}

export async function recordFounderGuidanceAnswer(env = {}, pending = {}, answer, metadata = {}) {
  const store = binding(env);
  if (!store) return { status: 'PENDING_CONFIGURATION', record: null };
  const goalId = norm(pending.goal_id);
  const value = normalizeFounderGuidanceAnswer(answer);
  if (!goalId || !value) throw Object.assign(new Error('Founder guidance answer required'), { code: 'FOUNDER_GUIDANCE_ANSWER_REQUIRED' });

  const current = await readJson(store, guidanceKey(goalId));
  if (!current || current.status !== 'PENDING') {
    return { status: 'NO_PENDING_GUIDANCE', record: current || null };
  }

  const next = {
    ...current,
    status: 'ANSWERED',
    answer: value,
    provenance: 'FOUNDER_CONFIRMED',
    answer_scope: 'GOAL',
    answered_at_utc: nowIso(),
    founder_answer_message_id: metadata.messageId == null ? null : Number(metadata.messageId),
    founder_chat_id: metadata.chatId == null ? null : String(metadata.chatId),
  };
  await writeJson(store, guidanceKey(goalId), next);
  await writeJson(store, ACTIVE_KEY, { goal_id: goalId, guidance_id: next.guidance_id, updated_at_utc: nowIso() });
  return { status: 'ANSWERED', record: next };
}

export async function consumeFounderGuidance(env = {}, goalId, metadata = {}) {
  const store = binding(env);
  if (!store) return { status: 'PENDING_CONFIGURATION', record: null };
  const current = await readJson(store, guidanceKey(goalId));
  if (!current) return { status: 'NOT_FOUND', record: null };
  if (current.status !== 'ANSWERED') return { status: current.status, record: current };
  const next = {
    ...current,
    status: 'CONSUMED',
    consumed_at_utc: nowIso(),
    consumed_by_action_id: metadata.actionId || null,
    consumed_by_strategy: metadata.strategySummary || null,
  };
  await writeJson(store, guidanceKey(goalId), next);
  await writeJson(store, ACTIVE_KEY, { goal_id: goalId, guidance_id: next.guidance_id, updated_at_utc: nowIso() });
  return { status: 'CONSUMED', record: next };
}

export function founderGuidanceContext(record = null) {
  if (!record || !['ANSWERED', 'CONSUMED'].includes(record.status) || !norm(record.answer)) return null;
  return {
    guidance_id: record.guidance_id,
    scope: record.answer_scope || record.scope || 'GOAL',
    answer: record.answer,
    provenance: 'FOUNDER_CONFIRMED',
    answered_at_utc: record.answered_at_utc || null,
    exact_question: record.exact_question || null,
  };
}

export function formatFounderGuidanceQuestion(record = {}) {
  const checked = Array.isArray(record.checked) && record.checked.length
    ? record.checked.slice(0, 4).map(item => `- ${item}`).join('\n')
    : '- Bounded investigation/replan completed; no sufficient policy rule found.';
  const unknowns = Array.isArray(record.unknowns) && record.unknowns.length
    ? record.unknowns.slice(0, 3).join(' | ')
    : 'A policy/priority ambiguity remains.';
  return [
    `Victor needs one Founder decision for ${record.goal_id || 'active objective'}.`,
    `Checked:\n${checked}`,
    `Unresolved: ${unknowns}`,
    `Question: ${record.exact_question || 'Please provide the missing scoped decision.'}`,
    'Reply to this message, or send: Guidance: <your decision>',
  ].join('\n\n');
}
