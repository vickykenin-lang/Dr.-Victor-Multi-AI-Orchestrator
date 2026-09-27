import assert from 'node:assert/strict';
import {
  amberCapabilityCandidate,
  amberCapabilityEligible,
  amberCapabilityRegistry,
  buildAmberExecutionLease,
  buildDefaultAmberRollback,
  evaluateAmberAction,
  verifyAmberPostPromotion,
} from './amber_autonomy.mjs';

const now = Date.parse('2026-09-27T00:20:00Z');
const lease = buildAmberExecutionLease({ leaseId: 'amber-step11-branch', expiresAtUtc: '2026-09-27T01:20:00Z' });
const rollback = buildDefaultAmberRollback({ previousVersion: 'branch-absent', targetVersion: 'branch-canary', probe: 'git-ls-remote' });
const actionContract = {
  contract_id: 'step11-repo-branch-write',
  capability_id: 'repo.branch.write',
  blast_radius: 'one ephemeral non-main branch only',
  reversible: true,
  rollback_ref: rollback.target_version,
};
const sandboxReceipt = { status: 'TEST_PASSED', evidence_refs: ['step11:branch-canary:preflight'], production_applied: false, promotion_required: true };
const deploymentIdentity = { source_sha: 'step11-test', build_id: 'step11-test' };

assert.equal(amberCapabilityCandidate('repo.branch.write'), true);
assert.equal(amberCapabilityCandidate('repo.pr.write'), true);
assert.equal(amberCapabilityCandidate('production.reversible_change'), true);

assert.equal(amberCapabilityEligible('repo.branch.write'), true);
assert.equal(amberCapabilityEligible('repo.pr.write'), false);
assert.equal(amberCapabilityEligible('production.reversible_change'), false);

assert.deepEqual(amberCapabilityRegistry().map(x => [x.capability_id, x.enabled]), [
  ['repo.branch.write', true],
  ['repo.pr.write', false],
  ['production.reversible_change', false],
]);

const allowed = evaluateAmberAction({
  capabilityId: 'repo.branch.write',
  actionContract,
  lease,
  rollback,
  sandboxReceipt,
  deploymentIdentity,
  nowMs: now,
});
assert.equal(allowed.decision, 'ALLOW_REVERSIBLE_AMBER');
assert.equal(allowed.automatic_rollback_required_on_verification_failure, true);

for (const capabilityId of ['repo.pr.write', 'production.reversible_change']) {
  const denied = evaluateAmberAction({
    capabilityId,
    actionContract: { ...actionContract, capability_id: capabilityId },
    lease,
    rollback,
    sandboxReceipt,
    deploymentIdentity,
    nowMs: now,
  });
  assert.equal(denied.decision, 'DENY');
  assert.equal(denied.reason, 'AMBER_CAPABILITY_NOT_INDIVIDUALLY_CERTIFIED');
}

assert.equal(evaluateAmberAction({
  capabilityId: 'repo.branch.write', actionContract: null, lease, rollback, sandboxReceipt, deploymentIdentity, nowMs: now,
}).reason, 'EXPLICIT_ACTION_CONTRACT_REQUIRED');

assert.equal(evaluateAmberAction({
  capabilityId: 'repo.branch.write', actionContract: { ...actionContract, blast_radius: '' }, lease, rollback, sandboxReceipt, deploymentIdentity, nowMs: now,
}).reason, 'BOUNDED_BLAST_RADIUS_REQUIRED');

assert.equal(evaluateAmberAction({
  capabilityId: 'repo.branch.write', actionContract, lease: { ...lease, expires_at_utc: '2026-09-26T23:00:00Z' }, rollback, sandboxReceipt, deploymentIdentity, nowMs: now,
}).reason, 'ACTIVE_EXECUTION_LEASE_REQUIRED');

assert.equal(evaluateAmberAction({
  capabilityId: 'repo.branch.write', actionContract, lease, rollback: null, sandboxReceipt, deploymentIdentity, nowMs: now,
}).decision, 'DENY');

assert.equal(evaluateAmberAction({
  capabilityId: 'repo.branch.write', actionContract: { ...actionContract, rollback_ref: 'wrong' }, lease, rollback, sandboxReceipt, deploymentIdentity, nowMs: now,
}).reason, 'ACTION_CONTRACT_ROLLBACK_REF_MISMATCH');

assert.equal(evaluateAmberAction({
  capabilityId: 'repo.branch.write', actionContract, lease, rollback, sandboxReceipt, deploymentIdentity, emergencyPause: true, nowMs: now,
}).reason, 'EMERGENCY_PAUSE_ACTIVE');

assert.throws(() => buildAmberExecutionLease({
  leaseId: 'bad-scope', expiresAtUtc: '2026-09-27T01:20:00Z', scope: ['repo.pr.write']
}), /uncertified AMBER capability/);

const postOk = verifyAmberPostPromotion({ healthOk: true, identityMatches: true, evidenceOk: true });
assert.equal(postOk.decision, 'PROMOTION_VERIFIED');

const postBad = verifyAmberPostPromotion({ healthOk: false, identityMatches: true, evidenceOk: true });
assert.equal(postBad.decision, 'ROLLBACK_REQUIRED');
assert.ok(postBad.failed.includes('POST_PROMOTION_HEALTH_FAILED'));

console.log('STEP11_ELIGIBLE_AMBER_TESTS_PASS');
