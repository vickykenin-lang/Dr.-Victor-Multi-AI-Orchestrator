const ADVISORY_SOURCES = new Set(['EXPERIENCE_LEDGER', 'COGNEE', 'LLM_INFERENCE']);
const MUTABLE_TARGETS = new Set(['SYSTEM_PROMPT', 'PROCEDURE_REGISTRY', 'RUNTIME_SOURCE', 'PRODUCTION_DEPLOYMENT']);

export function assessLearningPromotion({
  source,
  target,
  stagingVerified = false,
  rollbackReady = false,
  founderApproved = false,
} = {}) {
  const normalizedSource = String(source || '').toUpperCase();
  const normalizedTarget = String(target || '').toUpperCase();

  if (!ADVISORY_SOURCES.has(normalizedSource)) {
    return { allowed: false, reason: 'UNTRUSTED_LEARNING_SOURCE', advisory_only: true };
  }

  if (!MUTABLE_TARGETS.has(normalizedTarget)) {
    return { allowed: false, reason: 'UNKNOWN_PROMOTION_TARGET', advisory_only: true };
  }

  if (!stagingVerified) return { allowed: false, reason: 'STAGING_VERIFICATION_REQUIRED', advisory_only: true };
  if (!rollbackReady) return { allowed: false, reason: 'ROLLBACK_REQUIRED', advisory_only: true };
  if (!founderApproved) return { allowed: false, reason: 'FOUNDER_APPROVAL_REQUIRED', advisory_only: true };

  return {
    allowed: true,
    reason: 'FOUNDER_APPROVED_STAGED_PROMOTION',
    advisory_only: false,
    source: normalizedSource,
    target: normalizedTarget,
  };
}

export function learningMayDirectlyMutateRuntime() {
  return false;
}
