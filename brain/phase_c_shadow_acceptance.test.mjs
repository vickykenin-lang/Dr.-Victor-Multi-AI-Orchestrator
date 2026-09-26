import test from 'node:test';
import assert from 'node:assert/strict';

import { buildActionContract, validateActionContract } from './action_contract.mjs';
import { classifyConversationFollowUp } from './conversation_runtime.mjs';
import { runShadowAutonomy } from './shadow_autonomy_runtime.mjs';

const HEALTHY_WATCHDOG = { watchdog_available: true, watchdog_healthy: true, heartbeat_age_seconds: 5 };

const rioGoal = {
  goal_id: 'OBJ-RIO-REVENUE-001',
  allowed_departments: ['rio'],
  founder_gate: ['FOUNDER_PAUSE_OR_OBJECTIVE_CHANGE'],
  hard_boundaries: ['NO_UNBOUNDED_SPEND'],
};

// 1. Real objective handling: preserve objective/action identity, validate the bounded
// contract, and authorize only disposable sandbox execution in shadow mode.
test('PHASE-C 1/7: real objective handling stays objective-bound and sandbox-only', () => {
  const contract = buildActionContract({
    goal: rioGoal,
    target: 'rio',
    runtimePhase: 'COMMERCIAL_EXECUTE',
    actionId: 'ACT-RIO-001',
  });
  const validation = validateActionContract(contract, rioGoal);
  assert.equal(validation.ok, true);
  assert.equal(contract.objective_id, rioGoal.goal_id);
  assert.equal(contract.action_id, 'ACT-RIO-001');

  const result = runShadowAutonomy({
    founder_text: 'Victor execute this objective',
    objective_id: contract.objective_id,
    action_id: contract.action_id,
    capability_id: 'sandbox.execute',
    active_target: 'rio',
    watchdog_input: HEALTHY_WATCHDOG,
    now_utc: '2026-09-26T08:00:00Z',
  });
  assert.equal(result.mode, 'SHADOW');
  assert.equal(result.decision, 'SANDBOX_EXECUTION_AUTHORIZED');
  assert.equal(result.sandbox.objective_id, contract.objective_id);
  assert.equal(result.sandbox.action_id, contract.action_id);
  assert.equal(result.sandbox.credentials.production_credentials_available, false);
  assert.equal(result.production_apply_allowed, false);
  assert.equal(result.sandbox_receipt.production_applied, false);
});

// 2. Retry/failure handling: transient retry overflow and explicit sandbox budget
// overflow both force SAFE_HOLD instead of continuing blindly.
test('PHASE-C 2/7: retry and failure limits fail closed', () => {
  const retryHold = runShadowAutonomy({
    founder_text: 'Victor execute this objective',
    objective_id: 'OBJ-RETRY',
    action_id: 'ACT-RETRY',
    watchdog_input: { ...HEALTHY_WATCHDOG, transient_retry_count: 3 },
  });
  assert.equal(retryHold.decision, 'SAFE_HOLD');
  assert.ok(retryHold.watchdog.triggers.includes('TRANSIENT_RETRY_LIMIT'));
  assert.equal(retryHold.production_apply_allowed, false);

  const budgetHold = runShadowAutonomy({
    founder_text: 'Victor execute this objective',
    objective_id: 'OBJ-BUDGET',
    action_id: 'ACT-BUDGET',
    budget_usage: { retry_count: 4 },
    watchdog_input: HEALTHY_WATCHDOG,
  });
  assert.equal(budgetHold.decision, 'SAFE_HOLD');
  assert.ok(budgetHold.watchdog.triggers.includes('RESOURCE_BUDGET_BLOCK'));
  assert.equal(budgetHold.production_apply_allowed, false);
});

// 3. Semantic no-progress is not treated as transient success. Crossing the bounded
// threshold independently forces SAFE_HOLD.
test('PHASE-C 3/7: semantic no-progress forces independent watchdog hold', () => {
  const result = runShadowAutonomy({
    founder_text: 'Victor execute this objective',
    objective_id: 'OBJ-NOPROGRESS',
    action_id: 'ACT-NOPROGRESS',
    watchdog_input: { ...HEALTHY_WATCHDOG, semantic_no_progress_count: 3 },
  });
  assert.equal(result.decision, 'SAFE_HOLD');
  assert.ok(result.watchdog.triggers.includes('SEMANTIC_NO_PROGRESS_LIMIT'));
  assert.equal(result.department_dispatch_allowed, false);
  assert.equal(result.production_apply_allowed, false);
});

// 4. A malicious/invalid planner proposal cannot smuggle destructive or cross-phase
// actions into an otherwise valid objective contract.
test('PHASE-C 4/7: malicious planner proposal is rejected by deterministic contract validation', () => {
  const contract = buildActionContract({
    goal: rioGoal,
    target: 'rio',
    runtimePhase: 'COMMERCIAL_EXECUTE',
    actionId: 'ACT-MALICIOUS',
  });
  const malicious = {
    ...contract,
    requested_actions: [
      ...contract.requested_actions,
      'DELETE_ACCOUNT',
      'ROTATE_CREDENTIALS',
      'PRODUCTION_DESTRUCTIVE_CHANGE',
    ],
    spend_allowed: true,
  };
  const validation = validateActionContract(malicious, rioGoal);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some(item => item.startsWith('ACTION_NOT_ALLOWED_FOR_PHASE:')));
  assert.ok(validation.errors.includes('UNLOCKED_SPEND_PROHIBITED'));
  assert.ok(validation.errors.includes('CREDENTIAL_OR_IDENTITY_ACTION_PROHIBITED'));
});

// 5. Offline/degraded reasoning: Phase-C safety decisions are deterministic and do not
// require a model call. Environment/authority degradation must hold rather than guess.
test('PHASE-C 5/7: offline/degraded reasoning remains deterministic and fail-closed', () => {
  let networkCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    networkCalled = true;
    throw new Error('NETWORK_MUST_NOT_BE_USED');
  };
  try {
    const result = runShadowAutonomy({
      founder_text: 'Victor execute this objective',
      objective_id: 'OBJ-OFFLINE',
      action_id: 'ACT-OFFLINE',
      watchdog_input: { ...HEALTHY_WATCHDOG, material_environment_mismatch: true, authority_ambiguity: true },
    });
    assert.equal(result.decision, 'SAFE_HOLD');
    assert.ok(result.watchdog.triggers.includes('ENVIRONMENT_MISMATCH'));
    assert.ok(result.watchdog.triggers.includes('AUTHORITY_AMBIGUITY'));
    assert.equal(result.production_apply_allowed, false);
    assert.equal(networkCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// 6. Founder conversation transcript interaction: contextual follow-up remains bound
// to the active objective/department, while a later STOP overrides execution.
test('PHASE-C 6/7: Founder transcript context is preserved and STOP wins', () => {
  const transcriptState = {
    last_target: 'rio',
    active_target: 'rio',
    last_task_id: 'ACT-RIO-TRANSCRIPT',
    active_task_id: 'ACT-RIO-TRANSCRIPT',
    last_victor_reply: 'RIO objective ka blocker fresh evidence se verify hua; next bounded action pending hai.',
  };
  const followUp = classifyConversationFollowUp('kyu?', transcriptState);
  assert.equal(followUp.mode, 'CONTEXTUAL_EXPLANATION');
  assert.equal(followUp.target, 'rio');
  assert.equal(followUp.task_id, 'ACT-RIO-TRANSCRIPT');

  const stopped = runShadowAutonomy({
    founder_text: 'RIO par kaam band karo',
    objective_id: 'OBJ-RIO-TRANSCRIPT',
    action_id: 'ACT-RIO-TRANSCRIPT',
    active_target: followUp.target,
  });
  assert.equal(stopped.decision, 'SAFE_HOLD');
  assert.equal(stopped.reason, 'FOUNDER_STOP_PAUSE');
  assert.equal(stopped.department_dispatch_allowed, false);
  assert.equal(stopped.production_apply_allowed, false);
});

// 7. Zero implicit production mutation: across happy, failure and STOP paths the
// shadow runtime can never silently promote or claim a production application.
test('PHASE-C 7/7: shadow acceptance has zero implicit production mutation', () => {
  const cases = [
    runShadowAutonomy({ founder_text: 'Victor execute this objective', objective_id: 'OBJ-A', action_id: 'ACT-A', watchdog_input: HEALTHY_WATCHDOG }),
    runShadowAutonomy({ founder_text: 'Victor execute this objective', objective_id: 'OBJ-B', action_id: 'ACT-B', watchdog_input: { ...HEALTHY_WATCHDOG, verification_failed_after_change: true } }),
    runShadowAutonomy({ founder_text: 'RIO par kaam band karo', objective_id: 'OBJ-C', action_id: 'ACT-C', active_target: 'rio' }),
    runShadowAutonomy({ founder_text: 'I want to test you', objective_id: 'OBJ-D', action_id: 'ACT-D' }),
  ];

  for (const result of cases) {
    assert.equal(result.mode, 'SHADOW');
    assert.equal(result.production_apply_allowed, false);
    if (result.sandbox_receipt) assert.equal(result.sandbox_receipt.production_applied, false);
  }
});
