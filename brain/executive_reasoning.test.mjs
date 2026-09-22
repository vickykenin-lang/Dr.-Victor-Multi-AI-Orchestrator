import test from 'node:test';
import assert from 'node:assert/strict';

import {
  shouldInvokeExecutiveReasoner,
  buildExecutiveReasoningPrompt,
  parseExecutivePlan,
  validateExecutivePlan,
  requestExecutivePlan,
} from './executive_reasoning.mjs';
import { buildActionContract, validateActionContract } from './action_contract.mjs';
import { buildStrategyFingerprint, validateStrategyChange } from './progress_contract.mjs';

const goal = {
  goal_id: 'ORG-REVENUE-001',
  title: 'Generate verified RIO commercial revenue',
  objective: 'Generate verified real affiliate commercial revenue through RIO.',
  success_conditions: ['Verified external conversion'],
  required_evidence_level: 'E5_BUSINESS_OUTCOME',
  primary_department: 'rio',
  allowed_departments: ['rio', 'tony_stark', 'aura3', 'hulk'],
  hard_boundaries: ['NO_RAW_SECRET_DISCLOSURE', 'CONFIGURED_COST_LIMITS'],
  founder_gate: ['CREDENTIAL_OR_ACCOUNT_IDENTITY_ADMINISTRATION'],
};

test('reasoner is invoked for semantic no-progress or mandatory strategy change', () => {
  assert.equal(shouldInvokeExecutiveReasoner({ state: 'NO_PROGRESS' }), true);
  assert.equal(shouldInvokeExecutiveReasoner({ must_change_strategy: true }), true);
  assert.equal(shouldInvokeExecutiveReasoner({ no_progress_count: 2 }), true);
  assert.equal(shouldInvokeExecutiveReasoner({ state: 'WORKING', no_progress_count: 0 }), false);
});

test('reasoning prompt contains evidence and explicitly denies authority', () => {
  const prompt = buildExecutiveReasoningPrompt({
    goal,
    runtimeGoal: {
      state: 'NO_PROGRESS',
      last_status: 'READ_ONLY_AUDIT_COMPLETED',
      last_root_cause: 'STATIC_AUDIT_PATH',
      evidence: ['audit.json'],
    },
    availableDepartments: ['rio', 'tony_stark'],
  });
  assert.match(prompt.system, /bounded planner\/advisor/i);
  assert.match(prompt.system, /Do not grant permissions/i);
  assert.match(prompt.user, /READ_ONLY_AUDIT_COMPLETED/);
  assert.match(prompt.user, /audit\.json/);
});

test('parser accepts strict JSON and fenced JSON', () => {
  const plan = parseExecutivePlan(JSON.stringify({ plan_version: 1, strategy_summary: 'x' }));
  assert.equal(plan.plan_version, 1);
  const fenced = parseExecutivePlan('```json\n{"plan_version":1,"strategy_summary":"x"}\n```');
  assert.equal(fenced.strategy_summary, 'x');
});

test('deterministic validator rejects LLM authority fields', () => {
  const result = validateExecutivePlan({
    plan_version: 1,
    strategy_summary: 'Repair the verified static audit route.',
    target: 'tony_stark',
    phase: 'CORRECTIVE_EXECUTE',
    hypotheses: [],
    unknowns: [],
    evidence_needed: ['test result'],
    expected_progress_delta: ['CORRECTIVE_CHANGE_APPLIED'],
    confidence: 0.8,
    needs_founder_guidance: false,
    founder_question: null,
    mutation_allowed: true,
  }, { goal, availableDepartments: ['rio', 'tony_stark'] });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.startsWith('AUTHORITY_FIELDS_PROHIBITED:')));
});

test('validator rejects unavailable department and incompatible phase', () => {
  const unavailable = validateExecutivePlan({
    plan_version: 1,
    strategy_summary: 'Research externally.',
    target: 'hulk',
    phase: 'DIAGNOSE',
    hypotheses: [],
    unknowns: [],
    evidence_needed: ['market evidence'],
    expected_progress_delta: ['ROOT_CAUSE_ADVANCED'],
    confidence: 0.6,
    needs_founder_guidance: false,
    founder_question: null,
  }, { goal, availableDepartments: ['rio', 'tony_stark'] });
  assert.equal(unavailable.ok, false);
  assert.ok(unavailable.errors.includes('TARGET_NOT_CURRENTLY_AVAILABLE'));

  const incompatible = validateExecutivePlan({
    plan_version: 1,
    strategy_summary: 'Run commercial action through Tony.',
    target: 'tony_stark',
    phase: 'COMMERCIAL_EXECUTE',
    hypotheses: [],
    unknowns: [],
    evidence_needed: ['commercial evidence'],
    expected_progress_delta: ['COMMERCIAL_ACTION_COMPLETED'],
    confidence: 0.7,
    needs_founder_guidance: false,
    founder_question: null,
  }, { goal, availableDepartments: ['rio', 'tony_stark'] });
  assert.equal(incompatible.ok, false);
  assert.ok(incompatible.errors.includes('COMMERCIAL_EXECUTE_TARGET_MUST_BE_RIO'));
});

test('validated model proposal becomes a safe materially different Action Contract', async () => {
  const stalledContract = buildActionContract({ goal, target: 'tony_stark', runtimePhase: 'PLAN' });
  const stalledFingerprint = buildStrategyFingerprint(stalledContract);
  const runtimeGoal = {
    state: 'NO_PROGRESS',
    must_change_strategy: true,
    no_progress_count: 2,
    stalled_strategy_fingerprint: stalledFingerprint,
    last_status: 'READ_ONLY_AUDIT_COMPLETED',
    last_next_action: 'VICTOR_REVIEW_AUDIT_AND_AUTHORIZE_REPAIR_PLAN',
  };
  const fakeModel = async (_env, _system, _user, options) => {
    assert.equal(options.task, 'executive');
    return {
      model: 'test-executive-model',
      discovery_status: 'TEST_STUB',
      content: JSON.stringify({
        plan_version: 1,
        strategy_summary: 'Stop re-auditing; execute the already diagnosed reversible technical correction and verify tests.',
        target: 'tony_stark',
        phase: 'CORRECTIVE_EXECUTE',
        hypotheses: ['The static audit route is the controllable blocker.'],
        unknowns: [],
        evidence_needed: ['changed files', 'test results'],
        expected_progress_delta: ['CORRECTIVE_CHANGE_APPLIED', 'TEST_RESULT_CHANGED'],
        confidence: 0.88,
        needs_founder_guidance: false,
        founder_question: null,
      }),
    };
  };

  const reasoned = await requestExecutivePlan({
    env: { ENABLE_AI_INFERENCE: 'true', API_VICTOR: 'configured-test-handle' },
    goal,
    runtimeGoal,
    availableDepartments: ['rio', 'tony_stark', 'aura3'],
    callModel: fakeModel,
  });
  assert.equal(reasoned.status, 'PLAN_VALIDATED');
  assert.equal(reasoned.plan.phase, 'CORRECTIVE_EXECUTE');

  const contract = buildActionContract({
    goal,
    target: reasoned.plan.target,
    runtimePhase: reasoned.plan.phase,
    runtimeGoal,
  });
  assert.equal(validateActionContract(contract, goal).ok, true);
  const strategy = validateStrategyChange({ previousGoal: runtimeGoal, actionContract: contract });
  assert.equal(strategy.ok, true);
  assert.notEqual(strategy.current_fingerprint, stalledFingerprint);
  assert.equal(contract.mutation_allowed, true);
  assert.equal(contract.production_allowed, false);
  assert.equal(contract.spend_allowed, false);
});

test('reasoner fails closed when AI is disabled or credential is absent', async () => {
  const fakeModel = async () => ({ content: '{}' });
  await assert.rejects(
    requestExecutivePlan({ env: { ENABLE_AI_INFERENCE: 'false', API_VICTOR: 'x' }, goal, runtimeGoal: {}, availableDepartments: ['rio'], callModel: fakeModel }),
    error => error.code === 'EXECUTIVE_REASONER_DISABLED',
  );
  await assert.rejects(
    requestExecutivePlan({ env: { ENABLE_AI_INFERENCE: 'true' }, goal, runtimeGoal: {}, availableDepartments: ['rio'], callModel: fakeModel }),
    error => error.code === 'EXECUTIVE_REASONER_CREDENTIAL_MISSING',
  );
});
