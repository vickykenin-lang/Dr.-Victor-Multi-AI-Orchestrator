import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildStrategyFingerprint,
  evaluateProgressDelta,
  nextConvergenceState,
  validateStrategyChange,
} from './progress_contract.mjs';

function contract(overrides = {}) {
  return {
    contract_version: 1,
    objective_id: 'ORG-REVENUE-001',
    phase: 'CORRECTIVE_EXECUTE',
    target: 'tony_stark',
    requested_actions: ['READ_REPOSITORY', 'ANALYZE', 'PROPOSE_OR_APPLY_CODE_CHANGE_SUBJECT_TO_AUTHORITY', 'RUN_TESTS', 'RETURN_EVIDENCE'],
    authority_level: 'L2',
    mutation_allowed: true,
    production_allowed: false,
    public_action_allowed: false,
    spend_allowed: false,
    ...overrides,
  };
}

test('new audit artifact path alone is NO_PROGRESS during corrective execution', () => {
  const delta = evaluateProgressDelta({
    previousGoal: { evidence: ['old-audit.json'] },
    actionContract: contract(),
    outcome: {
      verified: true,
      assessment: {
        status: 'READ_ONLY_AUDIT_COMPLETED',
        evidence: ['new-audit-123.json'],
        nextAction: 'VICTOR_REVIEW_AUDIT_AND_AUTHORIZE_REPAIR_PLAN',
        goalAchieved: false,
      },
    },
    rawResult: { repair_executed: false },
  });
  assert.equal(delta.material, false);
  assert.equal(delta.reason, 'CORRECTIVE_EXECUTE_DEGRADED_TO_READ_ONLY_ACTIVITY');
});

test('corrective change plus tests is material progress', () => {
  const delta = evaluateProgressDelta({
    previousGoal: {},
    actionContract: contract(),
    outcome: {
      verified: true,
      assessment: {
        status: 'REPAIR_APPLIED',
        evidence: ['repair.json', 'tests.json'],
        nextAction: 'VERIFY_REPAIR',
        goalAchieved: false,
      },
    },
    rawResult: {
      repair_executed: true,
      changed_files: ['src/runtime.py'],
      test_results: { passed: 8, failed: 0 },
    },
  });
  assert.equal(delta.material, true);
  assert.ok(delta.types.includes('CORRECTIVE_CHANGE_APPLIED'));
  assert.ok(delta.types.includes('TEST_RESULT_CHANGED'));
});

test('Five-Whys with new verified root cause is material diagnostic progress', () => {
  const delta = evaluateProgressDelta({
    previousGoal: { last_root_cause: null },
    actionContract: contract({ phase: 'DIAGNOSE', mutation_allowed: false, requested_actions: ['READ_REPOSITORY', 'ANALYZE', 'RETURN_EVIDENCE'] }),
    outcome: {
      verified: true,
      assessment: {
        status: 'FIVE_WHYS_DIAGNOSIS_COMPLETED',
        rootCause: 'TONY_STATIC_AUDIT_PATH_DID_NOT_ADVANCE_AFTER_DIAGNOSIS',
        evidence: ['five-whys.json'],
      },
    },
    rawResult: {
      strict_supervision: {
        why_chain: [{ status: 'VERIFIED', cause: 'STATIC_AUDIT_PATH' }],
      },
    },
  });
  assert.equal(delta.material, true);
  assert.ok(delta.types.includes('ROOT_CAUSE_ADVANCED'));
});

test('diagnostic recovery preserves stalled fingerprint and forces a different next strategy', () => {
  const prior = {
    stalled_strategy_fingerprint: 'tony_stark|PLAN|L1|M0|P0|ANALYZE,READ_REPOSITORY,RETURN_EVIDENCE',
    recovery_generation: 2,
    must_change_strategy: true,
  };
  const next = nextConvergenceState({
    previousGoal: prior,
    progressDelta: { material: true },
    strategyFingerprint: 'tony_stark|DIAGNOSE|L1|M0|P0|ANALYZE,READ_REPOSITORY,RETURN_EVIDENCE',
    actionContract: contract({ phase: 'DIAGNOSE', mutation_allowed: false, authority_level: 'L1', requested_actions: ['READ_REPOSITORY', 'ANALYZE', 'RETURN_EVIDENCE'] }),
  });
  assert.equal(next.stalled_strategy_fingerprint, prior.stalled_strategy_fingerprint);
  assert.equal(next.recovery_generation, 3);
  assert.equal(next.must_change_strategy, true);
});

test('two semantic no-progress cycles force strategy change even with new artifact names', () => {
  const fp = buildStrategyFingerprint(contract());
  const first = nextConvergenceState({
    previousGoal: {},
    progressDelta: { material: false },
    strategyFingerprint: fp,
    actionContract: contract(),
  });
  assert.equal(first.no_progress_count, 1);
  assert.equal(first.must_change_strategy, false);
  const second = nextConvergenceState({
    previousGoal: first,
    progressDelta: { material: false },
    strategyFingerprint: fp,
    actionContract: contract(),
  });
  assert.equal(second.no_progress_count, 2);
  assert.equal(second.must_change_strategy, true);
});

test('stalled identical strategy is blocked once strategy change is mandatory', () => {
  const current = contract();
  const fp = buildStrategyFingerprint(current);
  const check = validateStrategyChange({
    previousGoal: { stalled_strategy_fingerprint: fp, must_change_strategy: true },
    actionContract: current,
  });
  assert.equal(check.ok, false);
  assert.equal(check.code, 'STALLED_STRATEGY_REUSE_BLOCKED');
});

test('material corrective progress clears no-progress and stalled route', () => {
  const next = nextConvergenceState({
    previousGoal: {
      no_progress_count: 5,
      stalled_strategy_fingerprint: 'old',
      recovery_generation: 3,
      must_change_strategy: true,
    },
    progressDelta: { material: true },
    strategyFingerprint: buildStrategyFingerprint(contract()),
    actionContract: contract(),
  });
  assert.equal(next.no_progress_count, 0);
  assert.equal(next.stalled_strategy_fingerprint, null);
  assert.equal(next.must_change_strategy, false);
  assert.equal(next.recovery_generation, 3);
});
