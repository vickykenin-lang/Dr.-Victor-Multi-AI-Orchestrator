const INDEX_PREFIX = 'victor:experience:index:v1:';
const EPISODE_PREFIX = 'victor:experience:episode:v1:';
const ALLOWED_PROVENANCE = new Set(['OBSERVED', 'VERIFIED', 'FOUNDER_CONFIRMED', 'INFERRED', 'UNVERIFIED']);
const SECRET_KEY_PATTERN = /(?:secret|token|password|credential|authorization|api[_-]?key|private[_-]?key)/i;
const SECRET_TEXT_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bBedrockAPIKey-[A-Za-z0-9_-]{8,}\b/g,
];

function norm(value) {
  return String(value ?? '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

function store(env = {}) {
  const binding = env.VICTOR_CONVERSATION_STATE;
  return binding && typeof binding.get === 'function' && typeof binding.put === 'function' ? binding : null;
}

async function readJson(binding, key) {
  if (!binding) return null;
  try {
    const value = await binding.get(key, { type: 'json' });
    if (value && typeof value === 'object') return value;
  } catch (_) {}
  try {
    const raw = await binding.get(key);
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (_) {
    return null;
  }
}

async function writeJson(binding, key, value) {
  await binding.put(key, JSON.stringify(value));
  return value;
}

function episodeKey(episodeId) {
  return `${EPISODE_PREFIX}${encodeURIComponent(norm(episodeId))}`;
}

function indexKey(goalId) {
  return `${INDEX_PREFIX}${encodeURIComponent(norm(goalId))}`;
}

function sanitizeText(value) {
  let text = norm(value);
  for (const pattern of SECRET_TEXT_PATTERNS) text = text.replace(pattern, '[REDACTED]');
  return text;
}

export function sanitizeExperienceValue(value, key = '') {
  if (SECRET_KEY_PATTERN.test(String(key))) return '[REDACTED]';
  if (value == null) return value;
  if (typeof value === 'string') return sanitizeText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(item => sanitizeExperienceValue(item));
  if (typeof value === 'object') {
    const out = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      out[childKey] = sanitizeExperienceValue(childValue, childKey);
    }
    return out;
  }
  return sanitizeText(value);
}

export function experienceLedgerCapability(env = {}) {
  return store(env)
    ? { available: true, durable: true, binding: 'VICTOR_CONVERSATION_STATE' }
    : { available: false, durable: false, binding: null, reason: 'DURABLE_EXPERIENCE_STORE_UNAVAILABLE' };
}

export function buildExperienceEpisode({
  goal = {},
  actionContract = {},
  outcome = {},
  runtimeGoal = {},
  founderGuidance = null,
  episodeId = null,
  observedAt = null,
} = {}) {
  const assessment = outcome?.assessment || {};
  const progressDelta = outcome?.progressDelta || runtimeGoal?.last_progress_delta || null;
  const verified = outcome?.verified === true;
  const id = episodeId || `${goal.goal_id || 'objective'}:${actionContract.action_id || Date.now()}`;
  const evidence = Array.isArray(assessment.evidence) ? assessment.evidence.filter(Boolean) : [];
  const failureModes = [];
  if (!verified) failureModes.push('EXECUTION_UNVERIFIED');
  if (progressDelta?.material === false) failureModes.push(progressDelta.reason || 'NO_PROGRESS');
  if (assessment.hasBlocker === true) failureModes.push(assessment.status || 'BLOCKED');

  const founderCorrection = founderGuidance?.provenance === 'FOUNDER_CONFIRMED'
    ? {
        guidance_id: founderGuidance.guidance_id || null,
        scope: founderGuidance.scope || 'GOAL',
        answer: founderGuidance.answer || null,
        provenance: 'FOUNDER_CONFIRMED',
        answered_at_utc: founderGuidance.answered_at_utc || null,
      }
    : null;

  const episode = {
    schema_version: 1,
    episode_id: id,
    objective_id: goal.goal_id || null,
    observed_at_utc: observedAt || nowIso(),
    context_fingerprint: [
      actionContract.target || 'unknown',
      actionContract.phase || 'unknown',
      runtimeGoal.recovery_generation || 0,
    ].join('|'),
    plan: outcome?.executiveReasoning?.plan || null,
    action_contract: actionContract || null,
    expected_progress_delta: Array.isArray(actionContract.expected_progress_delta) ? actionContract.expected_progress_delta : [],
    actual_progress_delta: progressDelta,
    observations: {
      department_status: assessment.status || null,
      root_cause: assessment.rootCause || null,
      next_action: assessment.nextAction || null,
      outcome_progress: assessment.outcomeProgress || null,
    },
    evidence,
    outcome: {
      verified,
      goal_achieved: assessment.goalAchieved === true,
      founder_gate: assessment.founderGate === true,
      material_progress: progressDelta?.material === true,
    },
    failure_modes: failureModes,
    founder_correction: founderCorrection,
    lesson_candidate: progressDelta?.material === true
      ? 'SUCCESS_PATTERN_CANDIDATE'
      : (failureModes.length ? 'FAILURE_PATTERN_CANDIDATE' : null),
    provenance: verified ? 'VERIFIED' : 'OBSERVED',
    confidence: verified ? 1 : 0.5,
    immutable: true,
  };
  return sanitizeExperienceValue(episode);
}

export function validateExperienceEpisode(episode = {}) {
  const errors = [];
  if (Number(episode.schema_version) !== 1) errors.push('SCHEMA_VERSION_UNSUPPORTED');
  if (!norm(episode.episode_id)) errors.push('EPISODE_ID_REQUIRED');
  if (!norm(episode.objective_id)) errors.push('OBJECTIVE_ID_REQUIRED');
  if (!norm(episode.observed_at_utc)) errors.push('OBSERVED_AT_REQUIRED');
  if (!ALLOWED_PROVENANCE.has(norm(episode.provenance).toUpperCase())) errors.push('PROVENANCE_INVALID');
  if (!episode.action_contract || typeof episode.action_contract !== 'object') errors.push('ACTION_CONTRACT_REQUIRED');
  if (!episode.outcome || typeof episode.outcome !== 'object') errors.push('OUTCOME_REQUIRED');
  if (episode.immutable !== true) errors.push('IMMUTABLE_FLAG_REQUIRED');
  const serialized = JSON.stringify(episode);
  if (/Bearer\s+[A-Za-z0-9._~+\/-]{8,}/i.test(serialized)) errors.push('RAW_BEARER_SECRET_DETECTED');
  if (/gh[pousr]_[A-Za-z0-9_]{20,}/i.test(serialized)) errors.push('RAW_GITHUB_SECRET_DETECTED');
  if (/BedrockAPIKey-[A-Za-z0-9_-]{8,}/i.test(serialized)) errors.push('RAW_BEDROCK_SECRET_DETECTED');
  return { ok: errors.length === 0, errors, episode };
}

export async function appendExperienceEpisode(env = {}, episode = {}) {
  const binding = store(env);
  if (!binding) return { status: 'PENDING_CONFIGURATION', reason: 'DURABLE_EXPERIENCE_STORE_UNAVAILABLE', episode: null };
  const validation = validateExperienceEpisode(episode);
  if (!validation.ok) {
    const error = new Error(`Experience episode invalid: ${validation.errors.join('; ')}`);
    error.code = 'EXPERIENCE_EPISODE_INVALID';
    error.validationErrors = validation.errors;
    throw error;
  }

  const key = episodeKey(episode.episode_id);
  const existing = await readJson(binding, key);
  if (existing) return { status: 'ALREADY_EXISTS', episode: existing };

  await writeJson(binding, key, episode);
  const idxKey = indexKey(episode.objective_id);
  const index = await readJson(binding, idxKey) || { schema_version: 1, objective_id: episode.objective_id, episode_ids: [] };
  const nextIds = [...new Set([...(Array.isArray(index.episode_ids) ? index.episode_ids : []), episode.episode_id])].slice(-100);
  await writeJson(binding, idxKey, {
    ...index,
    episode_ids: nextIds,
    updated_at_utc: nowIso(),
  });
  return { status: 'APPENDED', episode };
}

export async function readExperienceEpisode(env = {}, episodeId) {
  const binding = store(env);
  if (!binding || !norm(episodeId)) return null;
  return readJson(binding, episodeKey(episodeId));
}

export async function retrieveRecentExperience(env = {}, goalId, options = {}) {
  const binding = store(env);
  if (!binding || !norm(goalId)) return [];
  const limit = Math.max(1, Math.min(Number(options.limit || 5), 12));
  const index = await readJson(binding, indexKey(goalId));
  const ids = Array.isArray(index?.episode_ids) ? index.episode_ids.slice(-limit).reverse() : [];
  const episodes = [];
  for (const id of ids) {
    const episode = await readJson(binding, episodeKey(id));
    if (episode) episodes.push(episode);
  }
  return episodes;
}

export function buildExperienceAdvisoryContext(episodes = []) {
  return (Array.isArray(episodes) ? episodes : []).slice(0, 8).map(episode => ({
    episode_id: episode.episode_id,
    objective_id: episode.objective_id,
    context_fingerprint: episode.context_fingerprint,
    action_phase: episode.action_contract?.phase || null,
    target: episode.action_contract?.target || null,
    actual_progress_delta: episode.actual_progress_delta || null,
    outcome: episode.outcome || null,
    failure_modes: episode.failure_modes || [],
    founder_correction: episode.founder_correction || null,
    provenance: episode.provenance || 'UNVERIFIED',
    advisory_only: true,
  }));
}
