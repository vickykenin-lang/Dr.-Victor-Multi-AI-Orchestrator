import { evaluateSecurityRequest, SECURITY_ZONE } from './security_kernel.mjs';

export const GREEN_AUTONOMY_VERSION = 'victor-green-autonomy-v1';
export const GREEN_AUTONOMY_CAPABILITIES = Object.freeze([
  'repo.read',
  'evidence.read',
  'sandbox.execute',
]);

export function evaluateGreenAutonomyRequest({ capability_id, emergency_pause = false } = {}) {
  if (!GREEN_AUTONOMY_CAPABILITIES.includes(capability_id)) {
    return {
      version: GREEN_AUTONOMY_VERSION,
      decision: 'DENY',
      reason: 'CAPABILITY_OUTSIDE_GREEN_AUTONOMY_SCOPE',
      production_apply_allowed: false,
    };
  }

  const security = evaluateSecurityRequest({
    actor: 'victor',
    capability_id,
    founder_approved: false,
    action_contract_authorized: false,
    emergency_pause,
  });

  if (security.decision !== 'ALLOW' || security.zone !== SECURITY_ZONE.GREEN) {
    return {
      version: GREEN_AUTONOMY_VERSION,
      decision: 'DENY',
      reason: security.reason || 'SECURITY_KERNEL_DENIED',
      zone: security.zone || null,
      production_apply_allowed: false,
    };
  }

  return {
    version: GREEN_AUTONOMY_VERSION,
    decision: 'ALLOW_GREEN_AUTONOMY',
    reason: 'BOUNDED_GREEN_CAPABILITY',
    zone: SECURITY_ZONE.GREEN,
    production_apply_allowed: false,
  };
}

export function buildGreenAutonomyPlan({ emergency_pause = false } = {}) {
  const steps = GREEN_AUTONOMY_CAPABILITIES.map(capability_id => ({
    capability_id,
    ...evaluateGreenAutonomyRequest({ capability_id, emergency_pause }),
  }));
  const allowed = steps.every(step => step.decision === 'ALLOW_GREEN_AUTONOMY');
  return {
    version: GREEN_AUTONOMY_VERSION,
    mode: 'BOUNDED_GREEN_AUTONOMY',
    scheduler_scope: 'READ_EVIDENCE_SANDBOX_ONLY',
    production_mutation_allowed: false,
    amber_allowed: false,
    red_allowed: false,
    public_action_allowed: false,
    credential_action_allowed: false,
    authority_expansion_allowed: false,
    decision: allowed ? 'ALLOW_BOUNDED_GREEN_CYCLE' : 'SAFE_HOLD',
    steps,
  };
}
