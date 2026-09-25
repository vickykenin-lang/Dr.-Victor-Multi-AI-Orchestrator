import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGreenAutonomyPlan, evaluateGreenAutonomyRequest } from './green_autonomy_runtime.mjs';

test('GREEN capabilities are allowed without Founder approval but cannot mutate production', () => {
  for (const capability_id of ['repo.read', 'evidence.read', 'sandbox.execute']) {
    const result = evaluateGreenAutonomyRequest({ capability_id });
    assert.equal(result.decision, 'ALLOW_GREEN_AUTONOMY');
    assert.equal(result.zone, 'GREEN');
    assert.equal(result.production_apply_allowed, false);
  }
});

test('AMBER and RED capabilities are denied by GREEN autonomy controller', () => {
  for (const capability_id of ['repo.branch.write', 'repo.pr.write', 'production.reversible_change', 'credential.rotate', 'security.policy.change', 'authority.expand', 'production.destructive_change']) {
    const result = evaluateGreenAutonomyRequest({ capability_id });
    assert.equal(result.decision, 'DENY');
    assert.equal(result.reason, 'CAPABILITY_OUTSIDE_GREEN_AUTONOMY_SCOPE');
    assert.equal(result.production_apply_allowed, false);
  }
});

test('emergency pause forces SAFE_HOLD', () => {
  const plan = buildGreenAutonomyPlan({ emergency_pause: true });
  assert.equal(plan.decision, 'SAFE_HOLD');
  assert.equal(plan.production_mutation_allowed, false);
  assert.equal(plan.amber_allowed, false);
  assert.equal(plan.red_allowed, false);
});

test('normal GREEN plan is bounded and non-mutating', () => {
  const plan = buildGreenAutonomyPlan();
  assert.equal(plan.decision, 'ALLOW_BOUNDED_GREEN_CYCLE');
  assert.equal(plan.scheduler_scope, 'READ_EVIDENCE_SANDBOX_ONLY');
  assert.equal(plan.production_mutation_allowed, false);
  assert.equal(plan.public_action_allowed, false);
  assert.equal(plan.credential_action_allowed, false);
  assert.equal(plan.authority_expansion_allowed, false);
});
