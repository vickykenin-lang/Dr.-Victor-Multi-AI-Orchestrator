import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OUTCOME_STAGE,
  createOwnedOutcomeState,
  assessVerifiedDepartmentResult,
  shouldContinueOwnedRecovery,
  buildOwnedRecoveryDirective,
} from './outcome_state.mjs';

test('owned outcome starts at TASK_SENT and increments attempt lineage', () => {
  const first = createOwnedOutcomeState({ target: 'rio', founderRequest: 'post publish karo', taskId: 't1' });
  assert.equal(first.stage, OUTCOME_STAGE.TASK_SENT);
  assert.equal(first.attempts, 1);
  const second = createOwnedOutcomeState({ target: 'rio', founderRequest: 'post publish karo', taskId: 't2', previous: first });
  assert.equal(second.attempts, 2);
});

test('verified work remains RESULT_VERIFIED and does not become objective achieved', () => {
  const prior = createOwnedOutcomeState({ target: 'rio', founderRequest: 'post publish karo', taskId: 't1' });
  const state = assessVerifiedDepartmentResult({
    __victor_verified: true,
    governed_business_cycle_performed: true,
    execution_status: 'GOVERNED_GOAL_CYCLE_EXECUTED',
    strict_supervision: {
      status: 'GOAL_PROGRESS_VERIFIED',
      evidence: ['data/content_publish_state.json'],
      requires_follow_up: true,
      next_action: 'publish next',
    },
  }, prior);
  assert.equal(state.stage, OUTCOME_STAGE.RESULT_VERIFIED);
  assert.equal(state.work_performed, true);
  assert.equal(state.objective_achieved, false);
  assert.equal(shouldContinueOwnedRecovery(state), true);
});

test('objective achievement requires verified final outcome evidence', () => {
  const prior = createOwnedOutcomeState({ target: 'rio', founderRequest: 'post publish karo', taskId: 't1' });
  const state = assessVerifiedDepartmentResult({
    __victor_verified: true,
    strict_supervision: { status: 'GOAL_ACHIEVED_VERIFIED', evidence: ['meta:media:123'], requires_follow_up: false },
    final_outcome: { verified: true, objective_met: true, evidence: ['https://instagram.com/p/example'] },
  }, prior);
  assert.equal(state.stage, OUTCOME_STAGE.OBJECTIVE_ACHIEVED);
  assert.equal(shouldContinueOwnedRecovery(state), false);
});

test('genuine credential boundary stops automatic recovery', () => {
  const prior = createOwnedOutcomeState({ target: 'rio', founderRequest: 'publish karo', taskId: 't1' });
  const state = assessVerifiedDepartmentResult({
    __victor_verified: true,
    strict_supervision: {
      status: 'BLOCKED',
      error_or_blocker: 'Missing credential; Founder must replace credential',
      evidence: ['credential-check'],
      requires_follow_up: true,
      next_action: 'REPLACE CREDENTIAL',
    },
  }, prior);
  assert.equal(state.stage, OUTCOME_STAGE.FOUNDER_ONLY_BLOCKER);
  assert.equal(state.founder_boundary, true);
  assert.equal(shouldContinueOwnedRecovery(state), false);
});

test('repeated failure forces Five Whys/change-route directive', () => {
  const prior = {
    ...createOwnedOutcomeState({ target: 'rio', founderRequest: 'publish karo', taskId: 't1' }),
    last_failure_fingerprint: 'rio|BLOCKED|same blocker|retry publish',
    repeated_failure_count: 1,
  };
  const state = assessVerifiedDepartmentResult({
    __victor_verified: true,
    execution_status: 'BLOCKED',
    strict_supervision: {
      status: 'BLOCKED',
      error_or_blocker: 'same blocker',
      next_action: 'retry publish',
      evidence: ['run:1'],
      requires_follow_up: true,
    },
  }, prior);
  assert.equal(state.repeated_failure_count, 2);
  assert.match(buildOwnedRecoveryDirective(state), /Five Whys/i);
  assert.match(buildOwnedRecoveryDirective(state), /change the route\/strategy/i);
});
