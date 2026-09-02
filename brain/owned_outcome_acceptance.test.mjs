import test from 'node:test';
import assert from 'node:assert/strict';
import { OUTCOME_STAGE } from './outcome_state.mjs';
import { runOwnedOutcomeAcceptanceTrace } from './owned_outcome_acceptance.mjs';

function rioProgress({ blocker = null, nextAction = 'retry publish', evidence = ['run:progress'] } = {}) {
  return {
    __victor_verified: true,
    execution_status: blocker ? 'BLOCKED' : 'GOVERNED_GOAL_CYCLE_EXECUTED',
    governed_business_cycle_performed: true,
    strict_supervision: {
      status: blocker ? 'BLOCKED' : 'GOAL_PROGRESS_VERIFIED',
      error_or_blocker: blocker,
      next_action: nextAction,
      evidence,
      requires_follow_up: true,
    },
  };
}

test('owned publish problem progresses through recovery to externally verified objective', () => {
  const trace = runOwnedOutcomeAcceptanceTrace({
    target: 'rio',
    founderRequest: 'RIO ka Instagram post publish karvao aur actual result verify karo',
    results: [
      rioProgress({ blocker: 'public social card unreachable', nextAction: 'repair public card path', evidence: ['workflow:publish:failed'] }),
      rioProgress({ nextAction: 'retry Instagram publish', evidence: ['card-preflight:200'] }),
      {
        __victor_verified: true,
        public_action_performed: true,
        strict_supervision: {
          status: 'GOAL_ACHIEVED_VERIFIED',
          evidence: ['meta-media-id:181234567890'],
          requires_follow_up: false,
        },
        final_outcome: {
          verified: true,
          objective_met: true,
          evidence: ['https://instagram.com/p/verified-example'],
        },
        external_verification: {
          verified: true,
          objective_met: true,
          platform: 'instagram',
          external_id: '181234567890',
          permalink: 'https://instagram.com/p/verified-example',
          evidence: ['Meta media ID 181234567890', 'permalink verified'],
        },
      },
    ],
  });

  assert.equal(trace.achieved, true);
  assert.equal(trace.final_state.stage, OUTCOME_STAGE.OBJECTIVE_ACHIEVED);
  assert.equal(trace.attempts, 3);
  assert.equal(trace.trace.filter(item => item.event === 'RECOVERY_REPLAN').length, 2);
  assert.equal(trace.trace.some(item => item.external_proof_required === true), true);
});

test('repeated identical failure triggers Five Whys and change-route before max attempt', () => {
  const repeated = rioProgress({ blocker: 'same publish transport failure', nextAction: 'retry publish', evidence: ['transport:error'] });
  const trace = runOwnedOutcomeAcceptanceTrace({
    target: 'rio',
    founderRequest: 'Instagram publish complete karo',
    results: [repeated, repeated, repeated],
  });

  const replans = trace.trace.filter(item => item.event === 'RECOVERY_REPLAN');
  assert.equal(replans.length, 2);
  assert.equal(replans[0].five_whys, false);
  assert.equal(replans[1].five_whys, true);
  assert.equal(replans[1].change_route, true);
  assert.equal(trace.achieved, false);
  assert.equal(trace.final_state.stage, OUTCOME_STAGE.RESULT_VERIFIED);
  assert.equal(trace.attempts, 3);
});

test('routine internal blocker continues automatically instead of escalating Founder', () => {
  const trace = runOwnedOutcomeAcceptanceTrace({
    target: 'rio',
    founderRequest: 'post publish karvao',
    results: [rioProgress({ blocker: 'validator failed on stale local state', nextAction: 'refresh state and rerun validator' })],
  });
  assert.equal(trace.founder_only_blocker, false);
  assert.equal(trace.trace.some(item => item.event === 'RECOVERY_REPLAN'), true);
  assert.equal(trace.attempts, 2);
});

test('genuine credential administration boundary stops recovery and escalates only that boundary', () => {
  const trace = runOwnedOutcomeAcceptanceTrace({
    target: 'rio',
    founderRequest: 'post publish karvao',
    results: [{
      __victor_verified: true,
      strict_supervision: {
        status: 'BLOCKED',
        error_or_blocker: 'Instagram credential must be replaced',
        next_action: 'REPLACE CREDENTIAL',
        evidence: ['credential-check:expired'],
        requires_follow_up: true,
      },
    }],
  });
  assert.equal(trace.final_state.stage, OUTCOME_STAGE.FOUNDER_ONLY_BLOCKER);
  assert.equal(trace.founder_only_blocker, true);
  assert.equal(trace.trace.some(item => item.event === 'RECOVERY_REPLAN'), false);
  assert.equal(trace.attempts, 1);
});
