export const WATCHDOG_VERSION = 'victor-watchdog-v1';

export function evaluateWatchdog(input = {}) {
  const {
    watchdog_available,
    watchdog_healthy,
    heartbeat_age_seconds,
    semantic_no_progress_count = 0,
    transient_retry_count = 0,
    unexpected_external_side_effect = false,
    verification_failed_after_change = false,
    authority_ambiguity = false,
    credential_or_security_anomaly = false,
    material_environment_mismatch = false,
    budget_result = null,
    limits = {},
  } = input || {};
  const maxHeartbeat = Number(limits.max_heartbeat_age_seconds ?? 180);
  const maxNoProgress = Number(limits.max_semantic_no_progress ?? 2);
  const maxTransient = Number(limits.max_transient_retries ?? 2);
  const triggers = [];

  if (watchdog_available !== true) triggers.push('WATCHDOG_UNAVAILABLE');
  if (watchdog_available === true && watchdog_healthy !== true) triggers.push('WATCHDOG_UNHEALTHY');
  if (watchdog_available === true && watchdog_healthy === true) {
    if (!Number.isFinite(Number(heartbeat_age_seconds))) triggers.push('WATCHDOG_HEARTBEAT_MISSING');
    else if (Number(heartbeat_age_seconds) > maxHeartbeat) triggers.push('WATCHDOG_HEARTBEAT_STALE');
  }
  if (Number(semantic_no_progress_count) > maxNoProgress) triggers.push('SEMANTIC_NO_PROGRESS_LIMIT');
  if (Number(transient_retry_count) > maxTransient) triggers.push('TRANSIENT_RETRY_LIMIT');
  if (unexpected_external_side_effect) triggers.push('UNEXPECTED_EXTERNAL_SIDE_EFFECT');
  if (verification_failed_after_change) triggers.push('POST_CHANGE_VERIFICATION_FAILED');
  if (authority_ambiguity) triggers.push('AUTHORITY_AMBIGUITY');
  if (credential_or_security_anomaly) triggers.push('CREDENTIAL_SECURITY_ANOMALY');
  if (material_environment_mismatch) triggers.push('ENVIRONMENT_MISMATCH');
  if (budget_result?.safe_hold === true || budget_result?.allowed === false) triggers.push('RESOURCE_BUDGET_BLOCK');

  return triggers.length
    ? {
        watchdog_version: WATCHDOG_VERSION,
        decision: 'SAFE_HOLD',
        allow_new_execution: false,
        allow_evidence_collection: true,
        allow_sandbox_diagnosis: true,
        watchdog_available: watchdog_available === true,
        watchdog_healthy: watchdog_healthy === true,
        triggers,
      }
    : {
        watchdog_version: WATCHDOG_VERSION,
        decision: 'CONTINUE_BOUNDED',
        allow_new_execution: true,
        allow_evidence_collection: true,
        allow_sandbox_diagnosis: true,
        watchdog_available: true,
        watchdog_healthy: true,
        triggers: [],
      };
}

export function watchdogOverridesVictor(victorDecision, watchdogDecision) {
  const validWatchdogDecision = watchdogDecision
    && typeof watchdogDecision === 'object'
    && ['SAFE_HOLD', 'CONTINUE_BOUNDED'].includes(watchdogDecision.decision);

  if (!validWatchdogDecision) {
    return {
      effective_decision: 'SAFE_HOLD',
      victor_decision: victorDecision || null,
      overridden: victorDecision !== 'SAFE_HOLD',
      authority: 'INDEPENDENT_WATCHDOG',
      triggers: ['WATCHDOG_DECISION_UNAVAILABLE'],
    };
  }

  if (watchdogDecision.decision === 'SAFE_HOLD') {
    return {
      effective_decision: 'SAFE_HOLD',
      victor_decision: victorDecision || null,
      overridden: victorDecision !== 'SAFE_HOLD',
      authority: 'INDEPENDENT_WATCHDOG',
      triggers: watchdogDecision.triggers || [],
    };
  }
  return {
    effective_decision: victorDecision || 'CONTINUE_BOUNDED',
    victor_decision: victorDecision || null,
    overridden: false,
    authority: 'NORMAL_EXECUTION',
    triggers: [],
  };
}
