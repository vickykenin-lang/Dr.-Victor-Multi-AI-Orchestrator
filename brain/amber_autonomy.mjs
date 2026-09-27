import { evaluateSecurityRequest } from './security_kernel.mjs';
import { createRollbackContract, validateRollbackContract } from './rollback_contract.mjs';
import { evaluatePromotion, evaluatePostPromotionVerification } from './promotion_gate.mjs';

export const AMBER_AUTONOMY_VERSION = 'victor-amber-autonomy-v2-step11';

const CANDIDATE_AMBER = new Set([
  'repo.branch.write',
  'repo.pr.write',
  'production.reversible_change',
]);

// Step-11 rollout is incremental. A capability is autonomous only after its
// own live reversible certification. Start with the branch canary capability;
// later candidates remain fail-closed until separately certified.
const ENABLED_AMBER = new Set([
  'repo.branch.write',
]);

export function amberCapabilityCandidate(capabilityId) {
  return CANDIDATE_AMBER.has(String(capabilityId || ''));
}

export function amberCapabilityEligible(capabilityId) {
  return ENABLED_AMBER.has(String(capabilityId || ''));
}

export function amberCapabilityRegistry() {
  return [...CANDIDATE_AMBER].map(capability_id => ({
    capability_id,
    zone: 'AMBER',
    enabled: ENABLED_AMBER.has(capability_id),
    certification_required: !ENABLED_AMBER.has(capability_id),
  }));
}

export function buildAmberExecutionLease({ leaseId, expiresAtUtc, scope = [...ENABLED_AMBER] } = {}) {
  if (!leaseId || !expiresAtUtc) throw new Error('leaseId and expiresAtUtc are required');
  const normalizedScope = [...new Set((scope || []).map(String))];
  if (!normalizedScope.length) throw new Error('non-empty scope is required');
  if (normalizedScope.some(capabilityId => !amberCapabilityEligible(capabilityId))) {
    throw new Error('lease scope contains uncertified AMBER capability');
  }
  return {
    lease_id: String(leaseId),
    status: 'ACTIVE',
    expires_at_utc: String(expiresAtUtc),
    scope: normalizedScope,
    non_transferable: true,
  };
}

function validateExplicitActionContract(actionContract, capabilityId) {
  if (!actionContract || typeof actionContract !== 'object') {
    return { ok: false, reason: 'EXPLICIT_ACTION_CONTRACT_REQUIRED' };
  }
  if (!String(actionContract.contract_id || '').trim()) {
    return { ok: false, reason: 'ACTION_CONTRACT_ID_REQUIRED' };
  }
  if (String(actionContract.capability_id || '') !== String(capabilityId || '')) {
    return { ok: false, reason: 'ACTION_CONTRACT_CAPABILITY_MISMATCH' };
  }
  if (!String(actionContract.blast_radius || '').trim()) {
    return { ok: false, reason: 'BOUNDED_BLAST_RADIUS_REQUIRED' };
  }
  if (actionContract.reversible !== true) {
    return { ok: false, reason: 'ACTION_CONTRACT_REVERSIBILITY_REQUIRED' };
  }
  if (!String(actionContract.rollback_ref || '').trim()) {
    return { ok: false, reason: 'ACTION_CONTRACT_ROLLBACK_REF_REQUIRED' };
  }
  return { ok: true, reason: 'EXPLICIT_ACTION_CONTRACT_VALID' };
}

export function evaluateAmberAction({
  capabilityId,
  actionContract = null,
  lease = null,
  rollback = null,
  sandboxReceipt = null,
  deploymentIdentity = null,
  emergencyPause = false,
  nowMs = Date.now(),
} = {}) {
  if (!amberCapabilityCandidate(capabilityId)) {
    return { decision: 'DENY', reason: 'CAPABILITY_NOT_AMBER_CANDIDATE', zone: 'AMBER' };
  }
  if (!amberCapabilityEligible(capabilityId)) {
    return { decision: 'DENY', reason: 'AMBER_CAPABILITY_NOT_INDIVIDUALLY_CERTIFIED', zone: 'AMBER' };
  }

  const actionContractValidation = validateExplicitActionContract(actionContract, capabilityId);
  if (!actionContractValidation.ok) {
    return { decision: 'DENY', reason: actionContractValidation.reason, zone: 'AMBER' };
  }

  if (!Array.isArray(lease?.scope) || !lease.scope.includes(String(capabilityId))) {
    return { decision: 'DENY', reason: 'LEASE_SCOPE_MISMATCH', zone: 'AMBER' };
  }

  const security = evaluateSecurityRequest({
    actor: 'victor',
    capability_id: capabilityId,
    founder_approved: false,
    action_contract_authorized: true,
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

  if (String(actionContract.rollback_ref) !== String(rollback.rollback_id || rollback.target_version || rollback.rollback_action || '')) {
    return { decision: 'DENY', reason: 'ACTION_CONTRACT_ROLLBACK_REF_MISMATCH', zone: 'AMBER', security };
  }

  const promotion = evaluatePromotion({
    sandbox_receipt: sandboxReceipt,
    security_decision: security,
    action_contract_authorized: true,
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
    action_contract: actionContract,
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
