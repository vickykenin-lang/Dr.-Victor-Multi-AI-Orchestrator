export const UNATTENDED_RELIABILITY_VERSION = 'victor-unattended-reliability-v1';
export const DEFAULT_MAX_RETRY_ATTEMPTS = 3;

const TRANSIENT_ERRORS = new Set(['TIMEOUT', 'RATE_LIMIT', 'TEMPORARY_UNAVAILABLE', 'UPSTREAM_5XX']);

export function evaluateRetry({ attempt = 0, error_code, max_attempts = DEFAULT_MAX_RETRY_ATTEMPTS } = {}) {
  const current = Number(attempt);
  const max = Number(max_attempts);
  if (!Number.isInteger(current) || current < 0 || !Number.isInteger(max) || max < 1) {
    return { decision: 'SAFE_HOLD', reason: 'INVALID_RETRY_STATE', production_action_allowed: false };
  }
  if (!TRANSIENT_ERRORS.has(String(error_code || ''))) {
    return { decision: 'DEAD_LETTER', reason: 'NON_TRANSIENT_FAILURE', attempt: current, production_action_allowed: false };
  }
  if (current >= max) {
    return { decision: 'DEAD_LETTER', reason: 'RETRY_BUDGET_EXHAUSTED', attempt: current, production_action_allowed: false };
  }
  return {
    decision: 'RETRY',
    reason: 'TRANSIENT_FAILURE',
    attempt: current + 1,
    backoff_seconds: Math.min(300, (2 ** current) * 5),
    production_action_allowed: false,
  };
}

export function createDeadLetterRecord({ task_id, error_code, attempt, observed_at_ms = Date.now() } = {}) {
  if (!task_id) throw new Error('TASK_ID_REQUIRED');
  return Object.freeze({
    schema_version: 1,
    record_type: 'DEAD_LETTER',
    task_id: String(task_id),
    error_code: String(error_code || 'UNKNOWN'),
    attempt: Number(attempt || 0),
    observed_at_ms: Number(observed_at_ms),
    recovery_state: 'GOVERNED_REVIEW_REQUIRED',
    automatic_production_replay_allowed: false,
  });
}

export function evaluateLease({ owner, now_ms = Date.now(), lease_expires_at_ms, candidate_owner } = {}) {
  const now = Number(now_ms);
  const expiry = Number(lease_expires_at_ms);
  if (!owner || !Number.isFinite(now) || !Number.isFinite(expiry)) {
    return { decision: 'SAFE_HOLD', reason: 'INVALID_LEASE_STATE', production_action_allowed: false };
  }
  if (now < expiry) {
    return { decision: 'KEEP_OWNER', owner: String(owner), production_action_allowed: false };
  }
  if (!candidate_owner || String(candidate_owner) === String(owner)) {
    return { decision: 'SAFE_HOLD', reason: 'LEASE_EXPIRED_NO_DISTINCT_CANDIDATE', previous_owner: String(owner), production_action_allowed: false };
  }
  return {
    decision: 'REASSIGN_BOUNDED',
    previous_owner: String(owner),
    new_owner: String(candidate_owner),
    reason: 'LEASE_EXPIRED',
    production_action_allowed: false,
  };
}

export function evaluateRestartRecovery({ checkpoint_present = false, checkpoint_valid = false, checkpoint_age_ms = Infinity, max_checkpoint_age_ms = 30 * 60 * 1000 } = {}) {
  if (checkpoint_present !== true) {
    return { decision: 'SAFE_HOLD', reason: 'CHECKPOINT_MISSING', production_action_allowed: false };
  }
  if (checkpoint_valid !== true) {
    return { decision: 'SAFE_HOLD', reason: 'CHECKPOINT_INVALID', production_action_allowed: false };
  }
  const age = Number(checkpoint_age_ms);
  const maxAge = Number(max_checkpoint_age_ms);
  if (!Number.isFinite(age) || age < 0 || !Number.isFinite(maxAge) || age > maxAge) {
    return { decision: 'SAFE_HOLD', reason: 'CHECKPOINT_STALE', production_action_allowed: false };
  }
  return { decision: 'RESTORE_BOUNDED_STATE', reason: 'VALID_RECENT_CHECKPOINT', production_action_allowed: false };
}

export function evaluateIncidentResponse({ health_ok = true, watchdog_ok = true, security_ok = true } = {}) {
  const blockers = [];
  if (health_ok !== true) blockers.push('HEALTH_FAILURE');
  if (watchdog_ok !== true) blockers.push('WATCHDOG_FAILURE');
  if (security_ok !== true) blockers.push('SECURITY_FAILURE');
  if (blockers.length) {
    return {
      decision: 'SAFE_HOLD',
      incident: true,
      blockers,
      automatic_production_recovery_allowed: false,
      consequential_execution_trigger: 'founder-command',
    };
  }
  return {
    decision: 'CONTINUE_BOUNDED',
    incident: false,
    blockers: [],
    automatic_production_recovery_allowed: false,
    consequential_execution_trigger: 'founder-command',
  };
}
