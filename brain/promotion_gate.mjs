import { validateRollbackContract } from './rollback_contract.mjs';

export const PROMOTION_GATE_VERSION = 'victor-promotion-gate-v1';

export function evaluatePromotion({
  sandbox_receipt,
  security_decision,
  action_contract_authorized = false,
  rollback_contract = null,
  deployment_identity = null,
  founder_approved = false,
  zone = null,
} = {}) {
  const blockers = [];

  if (!sandbox_receipt || sandbox_receipt.status !== 'TEST_PASSED') blockers.push('SANDBOX_TEST_NOT_PASSED');
  if (!Array.isArray(sandbox_receipt?.evidence_refs) || sandbox_receipt.evidence_refs.length === 0) blockers.push('SANDBOX_EVIDENCE_REQUIRED');
  if (sandbox_receipt?.production_applied !== false || sandbox_receipt?.promotion_required !== true) blockers.push('INVALID_SANDBOX_RECEIPT_BOUNDARY');
  if (security_decision?.decision !== 'ALLOW') blockers.push('SECURITY_KERNEL_DENIED');
  if (action_contract_authorized !== true) blockers.push('ACTION_CONTRACT_REQUIRED');

  const effectiveZone = zone || security_decision?.zone || null;
  if (effectiveZone === 'AMBER') {
    const rollback = validateRollbackContract(rollback_contract || {});
    if (!rollback.valid) blockers.push(rollback.reason);
  }
  if (effectiveZone === 'RED' && founder_approved !== true) blockers.push('FOUNDER_APPROVAL_REQUIRED');

  if (!deployment_identity?.source_sha) blockers.push('DEPLOYMENT_SOURCE_SHA_REQUIRED');
  if (!deployment_identity?.build_id) blockers.push('DEPLOYMENT_BUILD_ID_REQUIRED');

  return blockers.length
    ? {
        gate_version: PROMOTION_GATE_VERSION,
        decision: 'BLOCK',
        production_apply_allowed: false,
        blockers,
      }
    : {
        gate_version: PROMOTION_GATE_VERSION,
        decision: 'ALLOW_PROMOTION',
        production_apply_allowed: true,
        blockers: [],
      };
}

export function evaluatePostPromotionVerification({ health_ok, identity_matches, evidence_ok } = {}) {
  const failed = [];
  if (health_ok !== true) failed.push('POST_PROMOTION_HEALTH_FAILED');
  if (identity_matches !== true) failed.push('DEPLOYMENT_IDENTITY_MISMATCH');
  if (evidence_ok !== true) failed.push('POST_PROMOTION_EVIDENCE_FAILED');
  return failed.length
    ? { decision: 'ROLLBACK_REQUIRED', failed }
    : { decision: 'PROMOTION_VERIFIED', failed: [] };
}
