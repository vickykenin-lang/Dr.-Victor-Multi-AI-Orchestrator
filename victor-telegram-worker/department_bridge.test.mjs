import test from 'node:test';
import assert from 'node:assert/strict';

import {
  selectTonyTaskType,
  buildTonyTaskPayload,
  dispatchTonyTask,
  dispatchAura3Task,
  shouldContactTony,
  shouldContactRio,
  verifyTonyResult,
} from './department_bridge.mjs';

const entity = { entity_id: 'tony_stark' };

test('routes Tony strict onboarding probe to status check', () => {
  assert.equal(selectTonyTaskType('Tony onboarding strict supervision check karo'), 'STATUS_CHECK');
  assert.equal(shouldContactTony('Tony onboarding status check karo', entity), true);
});

test('routes evidence-based diagnostic and repair requests', () => {
  assert.equal(selectTonyTaskType('Tony error ka root cause diagnose karo'), 'DIAGNOSTIC');
  assert.equal(selectTonyTaskType('Tony repair plan do'), 'REPAIR_PLAN');
  assert.equal(selectTonyTaskType('post-repair recovery verify karo'), 'POST_REPAIR_VERIFY');
});

test('routes governed engineering tasks with fail-closed metadata', () => {
  const text = 'Tony RIO repository inspect karke bridge upgrade implement karo';
  assert.equal(selectTonyTaskType(text), 'TASK_REQUEST');
  assert.equal(shouldContactTony(text, { entity_id: 'rio' }), true);
  assert.equal(shouldContactRio(text, { entity_id: 'rio' }), false);
  const payload = buildTonyTaskPayload(text);
  assert.equal(payload.target_repository, 'vickykenin-lang/rio-affiliate-engine');
  assert.equal(payload.authority.maximum_level, 'L2');
  const l0Payload = buildTonyTaskPayload('Tony task karo. Target repository: vickykenin-lang/rio-affiliate-engine. Authority L0 only.');
  assert.equal(l0Payload.authority.maximum_level, 'L0');
  assert.equal(l0Payload.target_repository, 'vickykenin-lang/rio-affiliate-engine');
  assert.equal(payload.authority.production_activation_authorized, false);
  assert.ok(payload.prohibited_actions.includes('PRODUCTION_DEPLOYMENT'));
  assert.ok(payload.evidence_requirements.includes('TEST_RESULTS'));
});

test('explicit Action Contract overrides prompt-derived Tony permissions', () => {
  const contract = {
    contract_version: 1,
    objective_id: 'ORG-REVENUE-001',
    phase: 'CORRECTIVE_EXECUTE',
    target: 'tony_stark',
    requested_actions: [
      'READ_REPOSITORY',
      'ANALYZE',
      'PROPOSE_OR_APPLY_CODE_CHANGE_SUBJECT_TO_AUTHORITY',
      'RUN_TESTS',
      'RETURN_EVIDENCE',
    ],
    authority_level: 'L2',
    mutation_allowed: true,
    production_allowed: false,
    public_action_allowed: false,
    spend_allowed: false,
    expected_progress_delta: ['CORRECTIVE_CHANGE_APPLIED'],
    exit_criteria: ['TEST_OR_VERIFICATION_EVIDENCE_RETURNED'],
    founder_gate_if: ['CREDENTIAL_OR_ACCOUNT_IDENTITY_ADMINISTRATION'],
  };
  const payload = buildTonyTaskPayload('Tony review next action', contract);
  assert.deepEqual(payload.requested_actions, contract.requested_actions);
  assert.equal(payload.authority.maximum_level, 'L2');
  assert.equal(payload.authority.production_activation_authorized, false);
  assert.deepEqual(payload.action_contract, contract);
});

test('dispatches structured Tony payload and preserves Aura payload', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return { status: 204, text: async () => '' };
  };
  try {
    const contract = {
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
      expected_progress_delta: ['CORRECTIVE_CHANGE_APPLIED'],
      exit_criteria: ['TEST_OR_VERIFICATION_EVIDENCE_RETURNED'],
      founder_gate_if: ['CREDENTIAL_OR_ACCOUNT_IDENTITY_ADMINISTRATION'],
    };
    await dispatchTonyTask(
      { GITHUB_ORCHESTRATION_TOKEN: 'test-token' },
      'Tony review next action',
      { messageId: 9, actionContract: contract },
    );
    const tonyPayload = JSON.parse(calls[0].inputs.payload);
    assert.equal(calls[0].inputs.task_type, 'TASK_REQUEST');
    assert.equal(tonyPayload.schema_version, 1);
    assert.equal(tonyPayload.target_repository, null);
    assert.equal(tonyPayload.authority.production_activation_authorized, false);
    assert.deepEqual(tonyPayload.requested_actions, contract.requested_actions);
    assert.equal(tonyPayload.action_contract.phase, 'CORRECTIVE_EXECUTE');

    await dispatchAura3Task(
      { GITHUB_ORCHESTRATION_TOKEN: 'test-token' },
      'AURA3 status check karo',
      { messageId: 10 },
    );
    const auraPayload = JSON.parse(calls[1].inputs.payload);
    assert.equal(auraPayload.requested_by, 'victor');
  } finally {
    global.fetch = originalFetch;
  }
});

test('accepts only a complete strict Tony revert envelope', () => {
  const taskId = 'victor-tony-test-1';
  const result = {
    message_type: 'TASK_RESULT',
    sender: 'tony_stark',
    recipient: 'victor',
    task_id: taskId,
    destructive_action_performed: false,
    paid_action_performed: false,
    production_action_performed: false,
    strict_supervision: {
      status: 'ONBOARDING_STRICT',
      objective_alignment: 'CHECKED',
      solution: 'No unauthorized repair.',
      next_action: 'VICTOR_REVIEW',
      evidence: ['data/tony_results/victor-tony-test-1.json'],
      revert_to_victor: true,
      requires_follow_up: true,
    },
  };
  assert.equal(verifyTonyResult(result, taskId).ok, true);
  result.strict_supervision.evidence = [];
  assert.equal(verifyTonyResult(result, taskId).ok, false);
});
