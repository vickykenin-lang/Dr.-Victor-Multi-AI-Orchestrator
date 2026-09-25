import { evaluateSecurityRequest } from './security_kernel.mjs';
import { createRollbackContract, validateRollbackContract } from './rollback_contract.mjs';
import { evaluatePromotion, evaluatePostPromotionVerification } from './promotion_gate.mjs';

export const AMBER_AUTONOMY_VERSION = 'victor-amber-autonomy-v1';

const ALLOWED_AMBER = new Set([
  'repo.branch.write',
  'repo.pr.write',
  'production.reversible_change',
]);

export function amberCapabilityEligible(capabilityId) {
  return ALLOWED_AMBER.has(String(capabilityId || ''));
}

export function buildAmberExecutionLease({ leaseId, expiresAtUtc } = {}) {
  if (!leaseId || !expiresAtUtc) throw new Error('leaseId and expiresAtUtc are required');
  return {
    lease_id: String(leaseId),
    status: 'ACTIVE',
    expires_at_utc: String(expiresAtUtc),
    scope: [...ALLOWED_AMBER],
    non_transferable: true,
  };
}

export function evaluateAmberAction({
  capabilityId,
  actionContractAuthorized = false,
  lease = null,
  rollback = null,
  sandboxReceipt = null,
  deploymentIdentity = null,
  emergencyPause = false,
  nowMs = Date.now(),
} = {}) {
  if (!amberCapabilityEligible(capabilityId)) {
    return { decision: 'DENY', reason: 'CAPABILITY_NOT_ELIGIBLE_FOR_AMBER_AUTONOMY', zone: 'AMBER' };
  }

  const security = evaluateSecurityRequest({
    actor: 'victor',
    capability_id: capabilityId,
    founder_approved: false,
    action_contract_authorized: actionContractAuthorized,
    lease,
    emergency_pause: emergencyPause,
    now_ms: nowMs,
  });

  if (security.decision !== 'ALLOW') {
    return { decision: 'DENY', reason: security.reason, zone: security.zone || 'AMBER', security };
  }

  const rollbackValidation = validateRollbackContract(rollback || {});
  if (!rollbackValidation.valid) {
    return { decision: 'DENY', reason: rollbackValidation.reason, zone: 'AMBER', security };
  }

  const promotion = evaluatePromotion({
    sandbox_receipt: sandboxReceipt,
    security_decision: security,
    action_contract_authorized: actionContractAuthorized,
    rollback_contract: rollback,
    deployment_identity: deploymentIdentity,
    founder_approved: false,
    zone: 'AMBER',
  });

  if (promotion.decision !== 'ALLOW_PROMOTION') {
    return { decision: 'DENY', reason: 'PROMOTION_GATE_BLOCKED', blockers: promotion.blockers, zone: 'AMBER', security, promotion };
  }

  return {
    decision: 'ALLOW_REVERSIBLE_AMBER',
    reason: 'AMBER_GOVERNED_REVERSIBLE',
    zone: 'AMBER',
    security,
    rollback,
    promotion,
    automatic_rollback_required_on_verification_failure: true,
  };
}

export function buildDefaultAmberRollback({ previousVersion, targetVersion, probe = 'health' } = {}) {
  return createRollbackContract({
    previous_version: previousVersion,
    target_version: targetVersion,
    rollback_action: `restore:${previousVersion}`,
    verification_probes: [probe],
    reversible: true,
  });
}

export function verifyAmberPostPromotion({ healthOk, identityMatches, evidenceOk } = {}) {
  return evaluatePostPromotionVerification({
    health_ok: healthOk,
    identity_matches: identityMatches,
    evidence_ok: evidenceOk,
  });
}
