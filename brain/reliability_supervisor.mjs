import { evaluateSecurityRequest } from './security_kernel.mjs';

export const RELIABILITY_SUPERVISOR_VERSION = 'victor-reliability-supervisor-v1';
export const SUPERVISION_INTERVAL_MINUTES = 15;
export const MAX_SIGNAL_AGE_MINUTES = 20;

const GREEN_RECOVERY_CAPABILITIES = Object.freeze(['repo.read', 'evidence.read', 'sandbox.execute']);

export function evaluateSupervisionSignal({
  observed_at_ms = Date.now(),
  signal_at_ms,
  health_ok = false,
  v2_ready = false,
  endgame_ready = false,
  production_autonomy_enabled = false,
  consequential_trigger = 'founder-command',
} = {}) {
  const ageMs = Number(observed_at_ms) - Number(signal_at_ms);
  const ageMinutes = Number.isFinite(ageMs) ? ageMs / 60000 : Number.POSITIVE_INFINITY;
  const stale = !Number.isFinite(ageMinutes) || ageMinutes < 0 || ageMinutes > MAX_SIGNAL_AGE_MINUTES;

  const blockers = [];
  if (stale) blockers.push('SUPERVISION_SIGNAL_STALE_OR_INVALID');
  if (health_ok !== true) blockers.push('LIVE_HEALTH_NOT_OK');
  if (v2_ready !== true) blockers.push('V2_RUNTIME_NOT_READY');
  if (endgame_ready !== true) blockers.push('ENDGAME_RUNTIME_NOT_READY');
  if (production_autonomy_enabled === true) blockers.push('PRODUCTION_AUTONOMY_MUST_REMAIN_DISABLED');
  if (consequential_trigger !== 'founder-command') blockers.push('CONSEQUENTIAL_TRIGGER_BOUNDARY_CHANGED');

  if (blockers.length) {
    return {
      supervisor_version: RELIABILITY_SUPERVISOR_VERSION,
      decision: 'SAFE_HOLD',
      state: 'SUPERVISION_DEGRADED',
      blockers,
      recovery_capabilities: [],
      production_action_allowed: false,
    };
  }

  const recovery_capabilities = GREEN_RECOVERY_CAPABILITIES.filter(capability_id => {
    const result = evaluateSecurityRequest({ actor: 'victor', capability_id, founder_approved: false });
    return result.decision === 'ALLOW' && result.zone === 'GREEN';
  });

  return {
    supervisor_version: RELIABILITY_SUPERVISOR_VERSION,
    decision: 'CONTINUE_BOUNDED',
    state: 'GREEN_SUPERVISION_HEALTHY',
    blockers: [],
    recovery_capabilities,
    production_action_allowed: false,
  };
}

export function recoveryBoundary() {
  return {
    interval_minutes: SUPERVISION_INTERVAL_MINUTES,
    max_signal_age_minutes: MAX_SIGNAL_AGE_MINUTES,
    allowed_recovery_capabilities: [...GREEN_RECOVERY_CAPABILITIES],
    consequential_execution_trigger: 'founder-command',
    production_autonomy_enabled: false,
    amber_unattended_allowed: false,
    red_unattended_allowed: false,
  };
}
