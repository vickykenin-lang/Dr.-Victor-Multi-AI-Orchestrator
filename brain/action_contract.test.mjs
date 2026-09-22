import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildActionContract,
  resolveActionPhase,
  validateActionContract,
} from './action_contract.mjs';

const revenueGoal = {
  goal_id: 'ORG-REVENUE-001',
  allowed_departments: ['rio', 'tony_stark', 'aura3', 'hulk'],
  hard_boundaries: ['NO_RAW_SECRET_DISCLOSURE', 'CONFIGURED_COST_LIMITS'],
  founder_gate: [
    'CREDENTIAL_OR_ACCOUNT_IDENTITY_ADMINISTRATION',
    'SPEND_ABOVE_EXPLICIT_CONFIGURED_BUDGET_CEILING',
  ],
};

test('Tony first execution is planning/read-only, not mutation by prompt wording', () => {
  const contract = buildActionContract({ goal: revenueGoal, target: 'tony_stark', runtimePhase: 'EXECUTE' });
  assert.equal(contract.phase, 'PLAN');
  assert.equal(contract.mutation_allowed, false);
  assert.equal(contract.production_allowed, false);
  assert.equal(validateActionContract(contract, revenueGoal).ok, true);
});

test('Tony REPLAN_EXECUTE becomes explicit corrective execution regardless of natural-language wording', () => {
  const contract = buildActionContract({ goal: revenueGoal, target: 'tony_stark', runtimePhase: 'REPLAN_EXECUTE' });
  assert.equal(contract.phase, 'CORRECTIVE_EXECUTE');
  assert.equal(contract.mutation_allowed, true);
  assert.equal(contract.production_allowed, false);
  assert.ok(contract.requested_actions.includes('PROPOSE_OR_APPLY_CODE_CHANGE_SUBJECT_TO_AUTHORITY'));
  assert.ok(contract.requested_actions.includes('RUN_TESTS'));
  assert.equal(validateActionContract(contract, revenueGoal).ok, true);
});

test('Five-Whys diagnosis remains read-only but the next persisted Tony cycle resolves to corrective execution', () => {
  assert.equal(resolveActionPhase({ target: 'tony_stark', runtimePhase: 'FIVE_WHYS_DIAGNOSIS' }), 'DIAGNOSE');
  const contract = buildActionContract({
    goal: revenueGoal,
    target: 'tony_stark',
    runtimePhase: 'EXECUTE',
    runtimeGoal: {
      last_status: 'FIVE_WHYS_DIAGNOSIS_COMPLETED',
      brain_required_mode: 'NORMAL_EXECUTION',
      brain_review: { required_next_mode: 'NORMAL_REPLAN' },
    },
  });
  assert.equal(contract.phase, 'CORRECTIVE_EXECUTE');
  assert.equal(contract.mutation_allowed, true);
});

test('RIO goal execution is explicitly governed commercial execution with no unlocked spend', () => {
  const contract = buildActionContract({ goal: revenueGoal, target: 'rio', runtimePhase: 'EXECUTE' });
  assert.equal(contract.phase, 'COMMERCIAL_EXECUTE');
  assert.equal(contract.production_allowed, true);
  assert.equal(contract.public_action_allowed, true);
  assert.equal(contract.spend_allowed, false);
  assert.equal(validateActionContract(contract, revenueGoal).ok, true);
});

test('invalid contract cannot grant production or public authority to Tony corrective execution', () => {
  const contract = buildActionContract({ goal: revenueGoal, target: 'tony_stark', runtimePhase: 'REPLAN_EXECUTE' });
  contract.production_allowed = true;
  contract.public_action_allowed = true;
  const result = validateActionContract(contract, revenueGoal);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('CORRECTIVE_EXECUTE_PRODUCTION_MUST_BE_FALSE'));
  assert.ok(result.errors.includes('CORRECTIVE_EXECUTE_PUBLIC_ACTION_MUST_BE_FALSE'));
});

test('contract target must be allowed by active goal', () => {
  const contract = buildActionContract({ goal: revenueGoal, target: 'internal', runtimePhase: 'EXECUTE' });
  const result = validateActionContract(contract, revenueGoal);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('TARGET_NOT_ALLOWED_BY_GOAL'));
});
