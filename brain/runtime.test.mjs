import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRuleConflict,
  shouldRunFiveWhys,
  evaluateFiveWhys,
  translateFounderIntent,
  bindFounderDecision,
  buildTaskContract,
  reviewOutcome,
  departmentCapabilityFit,
} from './runtime.mjs';

test('Founder command outranks operational rule', () => {
  const winner = resolveRuleConflict([
    { type: 'OPERATIONAL_RULES', id: 'retry-tony' },
    { type: 'FOUNDER_COMMAND', id: 'assign-tony-to-rio' },
  ]);
  assert.equal(winner.id, 'assign-tony-to-rio');
});

test('repeat without new evidence forces Five Whys', () => {
  assert.equal(shouldRunFiveWhys({ sameRecommendationCount: 2, hasNewEvidence: false }), true);
});

test('Five Whys escalates only when verified root cause is Founder boundary', () => {
  const technical = evaluateFiveWhys({
    why_chain: [{ cause: 'stale workflow test', status: 'VERIFIED' }],
    root_cause_status: 'VERIFIED',
  });
  assert.equal(technical.founder_escalation_allowed, false);
  assert.equal(technical.next_action, 'PLAN_ROOT_CAUSE_CORRECTIVE_ACTION');

  const credential = evaluateFiveWhys({
    why_chain: [{ cause: 'valid account credential must be replaced by Founder', status: 'VERIFIED' }],
    root_cause_status: 'VERIFIED',
  });
  assert.equal(credential.founder_escalation_allowed, true);
  assert.equal(credential.next_action, 'ESCALATE_EXACT_FOUNDER_BOUNDARY');
});

test('Founder instruction is translated into Tony-compatible RIO website work', () => {
  const task = translateFounderIntent('Tony ko RIO ka website plan banane me help par lagao');
  assert.equal(task.department, 'tony_stark');
  assert.equal(task.beneficiary, 'rio');
  assert.match(task.deliverable, /website technical architecture/i);
  assert.equal(task.commercial_owner, 'rio');
});

test('Founder approval binds to known prior blocker', () => {
  const bound = bindFounderDecision({
    decision: 'APPROVED',
    priorTask: 'rio-website-support',
    priorBlocker: 'TONY_SUPPORT_AUTHORITY',
    timestamp: '2026-08-30T14:30:00Z',
  });
  assert.equal(bound.status, 'BOUND');
  assert.equal(bound.resolves_blocker, 'TONY_SUPPORT_AUTHORITY');
});

test('task contract requires concrete delegation fields', () => {
  const contract = buildTaskContract({
    objective: 'Help RIO complete website technical plan',
    department: 'tony_stark',
    deliverable: 'Technical architecture and deployment readiness plan',
    authorityLevel: 'L2',
    evidenceRequired: ['PLAN_FILE', 'TEST_OR_REPO_EVIDENCE'],
    exitCriteria: 'RIO receives actionable verified plan',
    nextHandoff: 'rio',
  });
  assert.equal(contract.valid, true);
});

test('same action repeated without evidence is detected as executive loop', () => {
  const review = reviewOutcome({ expected: 'repair plan', actual: 'same audit', sameActionCount: 2, hasNewEvidence: false });
  assert.equal(review.repeat_loop_detected, true);
  assert.equal(review.required_next_mode, 'FIVE_WHYS_BEFORE_NEXT_DISPATCH');
});

test('department capability model recognizes Tony website technical work', () => {
  assert.equal(departmentCapabilityFit('tony_stark', 'website architecture and deployment workflow'), true);
  assert.equal(departmentCapabilityFit('tony_stark', 'affiliate commission strategy'), false);
});
