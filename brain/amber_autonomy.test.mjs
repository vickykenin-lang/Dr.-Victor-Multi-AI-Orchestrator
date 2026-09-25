import assert from 'node:assert/strict';
import {
  amberCapabilityEligible,
  buildAmberExecutionLease,
  buildDefaultAmberRollback,
  evaluateAmberAction,
  verifyAmberPostPromotion,
} from './amber_autonomy.mjs';

const now = Date.parse('2026-09-25T18:00:00Z');
const lease = buildAmberExecutionLease({ leaseId: 'amber-test-1', expiresAtUtc: '2026-09-25T19:00:00Z' });
const rollback = buildDefaultAmberRollback({ previousVersion: 'v1', targetVersion: 'v2', probe: '/health' });
const sandboxReceipt = { status: 'TEST_PASSED', evidence_refs: ['sandbox:test:1'], production_applied: false, promotion_required: true };
const deploymentIdentity = { source_sha: 'abc123', build_id: 'build-1' };

assert.equal(amberCapabilityEligible('repo.branch.write'), true);
assert.equal(amberCapabilityEligible('repo.pr.write'), true);
assert.equal(amberCapabilityEligible('production.reversible_change'), true);
assert.equal(amberCapabilityEligible('credential.rotate'), false);
assert.equal(amberCapabilityEligible('production.destructive_change'), false);

for (const capabilityId of ['repo.branch.write', 'repo.pr.write', 'production.reversible_change']) {
  const allowed = evaluateAmberAction({
    capabilityId,
    actionContractAuthorized: true,
    lease,
    rollback,
    sandboxReceipt,
    deploymentIdentity,
    nowMs: now,
  });
  assert.equal(allowed.decision, 'ALLOW_REVERSIBLE_AMBER');
  assert.equal(allowed.automatic_rollback_required_on_verification_failure, true);
}

assert.equal(evaluateAmberAction({
  capabilityId: 'repo.branch.write', actionContractAuthorized: false, lease, rollback, sandboxReceipt, deploymentIdentity, nowMs: now,
}).decision, 'DENY');

assert.equal(evaluateAmberAction({
  capabilityId: 'repo.branch.write', actionContractAuthorized: true,
  lease: { ...lease, expires_at_utc: '2026-09-25T17:00:00Z' }, rollback, sandboxReceipt, deploymentIdentity, nowMs: now,
}).reason, 'ACTIVE_EXECUTION_LEASE_REQUIRED');

assert.equal(evaluateAmberAction({
  capabilityId: 'repo.branch.write', actionContractAuthorized: true, lease,
  rollback: null, sandboxReceipt, deploymentIdentity, nowMs: now,
}).decision, 'DENY');

assert.equal(evaluateAmberAction({
  capabilityId: 'credential.rotate', actionContractAuthorized: true, lease, rollback, sandboxReceipt, deploymentIdentity, nowMs: now,
}).reason, 'CAPABILITY_NOT_ELIGIBLE_FOR_AMBER_AUTONOMY');

assert.equal(evaluateAmberAction({
  capabilityId: 'repo.branch.write', actionContractAuthorized: true, lease, rollback, sandboxReceipt, deploymentIdentity, emergencyPause: true, nowMs: now,
}).reason, 'EMERGENCY_PAUSE_ACTIVE');

const postOk = verifyAmberPostPromotion({ healthOk: true, identityMatches: true, evidenceOk: true });
assert.equal(postOk.decision, 'PROMOTION_VERIFIED');

const postBad = verifyAmberPostPromotion({ healthOk: false, identityMatches: true, evidenceOk: true });
assert.equal(postBad.decision, 'ROLLBACK_REQUIRED');
assert.ok(postBad.failed.includes('POST_PROMOTION_HEALTH_FAILED'));

console.log('AMBER_AUTONOMY_TESTS_PASS');
