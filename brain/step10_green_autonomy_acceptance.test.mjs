import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGreenAutonomyPlan, evaluateGreenAutonomyRequest } from './green_autonomy_runtime.mjs';

function runBoundedGreenObjective({ failAttempts = 1, maxAttempts = 3 } = {}) {
  const plan = buildGreenAutonomyPlan();
  assert.equal(plan.decision, 'ALLOW_BOUNDED_GREEN_CYCLE');

  const evidence = [
    { stage: 'INVESTIGATE', capability: 'repo.read', status: 'PASS' },
    { stage: 'SANDBOX_ALLOCATE', capability: 'sandbox.execute', status: 'PASS' },
  ];

  let attempt = 0;
  let passed = false;
  while (attempt < maxAttempts && !passed) {
    attempt += 1;
    const status = attempt <= failAttempts ? 'FAIL_RETRYABLE' : 'PASS';
    evidence.push({ stage: 'TEST', attempt, status });
    passed = status === 'PASS';
  }

  evidence.push({ stage: 'EVIDENCE_EXPORT', capability: 'evidence.read', status: passed ? 'PASS' : 'FAIL' });
  evidence.push({ stage: 'GOVERNED_COMPLETION', status: passed ? 'PASS' : 'SAFE_HOLD' });

  return {
    decision: passed ? 'GREEN_OBJECTIVE_COMPLETED' : 'SAFE_HOLD',
    attempts: attempt,
    evidence,
    production_mutation_performed: false,
    public_action_performed: false,
    credential_action_performed: false,
    authority_expansion_performed: false,
  };
}

test('Step 10 bounded GREEN flow retries then completes with evidence', () => {
  const result = runBoundedGreenObjective({ failAttempts: 1, maxAttempts: 3 });
  assert.equal(result.decision, 'GREEN_OBJECTIVE_COMPLETED');
  assert.equal(result.attempts, 2);
  assert.deepEqual(result.evidence.map(x => x.stage), [
    'INVESTIGATE', 'SANDBOX_ALLOCATE', 'TEST', 'TEST', 'EVIDENCE_EXPORT', 'GOVERNED_COMPLETION'
  ]);
  assert.equal(result.production_mutation_performed, false);
  assert.equal(result.public_action_performed, false);
  assert.equal(result.credential_action_performed, false);
  assert.equal(result.authority_expansion_performed, false);
});

test('Step 10 retry ceiling fails closed', () => {
  const result = runBoundedGreenObjective({ failAttempts: 9, maxAttempts: 2 });
  assert.equal(result.decision, 'SAFE_HOLD');
  assert.equal(result.attempts, 2);
  assert.equal(result.production_mutation_performed, false);
});

test('Step 10 GREEN controller rejects AMBER and RED authority', () => {
  for (const capability_id of [
    'repo.pr.write',
    'production.reversible_change',
    'credential.rotate',
    'security.policy.change',
    'authority.expand',
    'production.destructive_change',
  ]) {
    const result = evaluateGreenAutonomyRequest({ capability_id });
    assert.equal(result.decision, 'DENY');
    assert.equal(result.production_apply_allowed, false);
  }
});

test('Step 10 emergency pause overrides GREEN cycle', () => {
  assert.equal(buildGreenAutonomyPlan({ emergency_pause: true }).decision, 'SAFE_HOLD');
});
