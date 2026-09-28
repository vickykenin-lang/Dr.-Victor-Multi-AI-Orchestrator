import test from 'node:test';
import assert from 'node:assert/strict';
import {
  persistCycleExperience,
  buildAutonomyEvidence,
  safeRouterDiagnostics,
  chooseGoalDepartment,
  selectHighestValueGoal,
  buildGoalTaskPrompt,
  buildGoalCertification,
  autonomyBindingReadiness,
  canBypassGenericApproval,
  founderAuthorityBoundary,
  evaluateGoalAchievement,
  buildGoalRuntimeState,
  buildVictorReportCard,
  executeAutonomousGoalCycle,
  classifyAutonomyResult,
  applyMaterialProgressPolicy,
} from './autonomy_runtime.mjs';

const revenueGoal = {
  goal_id: 'rio-affiliate-revenue',
  objective: 'Produce verified paid affiliate revenue',
  priority: 100,
  status: 'ACTIVE',
  success_conditions: ['Verified paid outcome'],
  required_evidence_level: 'E5_BUSINESS_OUTCOME',
  primary_department: 'rio',
  allowed_departments: ['rio', 'tony_stark', 'aura3'],
  hard_boundaries: ['NO_RAW_SECRET_DISCLOSURE'],
};

test('cycle records each dispatched action as an idempotent durable episode', async () => {
  const data = new Map();
  const env = { VICTOR_CONVERSATION_STATE: {
    async get(key, options) {
      const raw = data.get(key) || null;
      return options?.type === 'json' && raw ? JSON.parse(raw) : raw;
    },
    async put(key, value) { data.set(key, value); },
  } };
  const entries = ['diagnose-1', 'repair-2'].map(actionId => ({
    goal: revenueGoal,
    actionContract: { action_id: actionId, phase: 'CORRECTIVE_EXECUTE', target: 'tony_stark' },
    outcome: { verified: true, assessment: { status: 'BLOCKED', evidence: [] }, progressDelta: { material: false } },
    runtimeGoal: {},
  }));
  const first = await persistCycleExperience(env, entries);
  assert.deepEqual(first.map(item => item.status), ['APPENDED', 'APPENDED']);
  const repeat = await persistCycleExperience(env, entries);
  assert.deepEqual(repeat.map(item => item.status), ['ALREADY_EXISTS', 'ALREADY_EXISTS']);
  for (const receipt of first) {
    assert.ok(receipt.episode_id);
    assert.ok([...data.keys()].some(key => key.includes(encodeURIComponent(receipt.episode_id))), `missing durable episode ${receipt.episode_id}`);
  }
  assert.ok([...data.keys()].some(key => key.includes('experience:global-index')), 'global experience index missing');
  const observed = buildAutonomyEvidence({}, {
    status: 'GOAL_NO_PROGRESS_VERIFIED', goalId: revenueGoal.goal_id, target: 'tony_stark',
    result: { taskId: 'repair-2', experienceLedger: first },
  }, { cron: 'founder-command' });
  assert.deepEqual(observed.last_observed_cycle.experience_ledger, first);
});

test('router evidence is bounded and excludes arbitrary error text and secrets', () => {
  const evidence = safeRouterDiagnostics({
    discoveryStatus: 'DISCOVERY_HTTP_ERROR',
    modelFailures: [
      { model: 'safe-model', http_status: 429, error: 'ghp_should-never-leak' },
      { model: 'unsafe model with spaces', code: 'FetchError', token: 'secret' },
    ],
    message: 'Bearer super-secret-token',
  });
  assert.equal(evidence.discovery_status, 'DISCOVERY_HTTP_ERROR');
  assert.equal(evidence.model_failures[0].model, 'safe-model');
  assert.equal(evidence.model_failures[0].http_status, 429);
  assert.equal(evidence.model_failures[1].model, 'REDACTED');
  assert.equal(evidence.model_failures[1].code, 'FetchError');
  assert.equal(JSON.stringify(evidence).includes('secret'), false);
});

test('goal routing follows runtime recommendation instead of fixed department rotation', () => {
  const selected = chooseGoalDepartment(revenueGoal, { recommended_department: 'aura3' }, ['rio', 'aura3']);
  assert.equal(selected, 'aura3');
});

test('highest-value active goal is selected', () => {
  const selected = selectHighestValueGoal([
    { ...revenueGoal, goal_id: 'low', priority: 10 },
    { ...revenueGoal, goal_id: 'high', priority: 50 },
  ], {});
  assert.equal(selected.goal_id, 'high');
});

test('completed goal is not selected again', () => {
  const selected = selectHighestValueGoal([revenueGoal], { [revenueGoal.goal_id]: { state: 'GOAL_ACHIEVED_VERIFIED' } });
  assert.equal(selected, null);
});

test('stale unresolved work gains bounded priority', () => {
  const now = Date.now();
  const selected = selectHighestValueGoal([
    { ...revenueGoal, goal_id: 'fresh', priority: 50 },
    { ...revenueGoal, goal_id: 'stale', priority: 45 },
  ], {
    fresh: { state: 'READY', last_attempt_at_utc: new Date(now - 60_000).toISOString() },
    stale: { state: 'BLOCKED_RETRYABLE', last_attempt_at_utc: new Date(now - 4 * 3600_000).toISOString() },
  }, now);
  assert.equal(selected.goal_id, 'stale');
});

test('goal task prompt delegates HOW but keeps target and boundaries fixed', () => {
  const prompt = buildGoalTaskPrompt(revenueGoal, { state: 'READY' }, 'rio');
  assert.match(prompt, /how/i);
  assert.match(prompt, /NO_RAW_SECRET_DISCLOSURE/);
  assert.match(prompt, /verified paid affiliate revenue/i);
});

test('verified goal cycle creates persistent certification evidence', () => {
  const certification = buildGoalCertification(revenueGoal, {
    assessment: { goalAchieved: true, evidence: ['paid-settlement-receipt'] },
    target: 'rio', verified: true,
  });
  assert.equal(certification.status, 'GOAL_ACHIEVED_VERIFIED');
  assert.ok(certification.evidence.includes('paid-settlement-receipt'));
});

test('autonomy requires all existing bindings', () => {
  const ready = autonomyBindingReadiness({
    VICTOR_CONVERSATION_STATE: {}, GITHUB_ORCHESTRATION_TOKEN: 'x', TELEGRAM_BOT_TOKEN_VICTOR: 'y', VICTOR_FOUNDER_CHAT_ID: '1',
  });
  assert.equal(ready.ready, true);
});

test('generic approval waits are bypassed in self mode', () => {
  assert.equal(canBypassGenericApproval({ mode: 'SELF' }, { risk: 'GREEN' }), true);
});

test('credential administration remains Founder-only', () => {
  assert.equal(founderAuthorityBoundary({ nextAction: 'rotate credential' }).founderRequired, true);
});

test('goal or hard-boundary change remains Founder-owned', () => {
  assert.equal(founderAuthorityBoundary({ nextAction: 'change objective' }).founderRequired, true);
});

test('goal achievement requires evidence', () => {
  assert.equal(evaluateGoalAchievement(revenueGoal, { assessment: { goalAchieved: true, evidence: [] }, verified: true }).achieved, false);
});

test('goal runtime state records progress and recommended replan route', () => {
  const state = buildGoalRuntimeState(revenueGoal, { assessment: { status: 'BLOCKED' }, target: 'tony_stark', verified: true }, { material: false, reason: 'NO_PROGRESS' });
  assert.ok(state.state);
});

test('verified final goal outcome closes runtime goal', () => {
  const state = buildGoalRuntimeState(revenueGoal, { assessment: { goalAchieved: true, evidence: ['paid'] }, target: 'rio', verified: true }, { material: true });
  assert.equal(state.state, 'GOAL_ACHIEVED_VERIFIED');
});

test('Victor report card gives marks only for verified department final outcomes', () => {
  const report = buildVictorReportCard([{ target: 'rio', verified: false, assessment: { finalOutcome: { verified: false, evidence: [], score: 10 } } }]);
  assert.equal(report.departments[0].score, 1);
});

test('10 out of 10 requires objective met evidence', () => {
  const report = buildVictorReportCard([{ target: 'rio', verified: true, assessment: { finalOutcome: { verified: true, objective_met: false, evidence: ['x'], score: 10 } } }]);
  assert.equal(report.departments[0].score, 9);
});

test('Founder manual executive trigger is the only supported execution trigger', async () => {
  const result = await executeAutonomousGoalCycle({}, { trigger: 'founder-command', dryRun: true });
  assert.notEqual(result?.status, 'TRIGGER_NOT_ALLOWED');
});

test('scheduled and unknown triggers fail closed without executing a goal', async () => {
  assert.equal((await executeAutonomousGoalCycle({}, { trigger: 'scheduled' })).status, 'TRIGGER_NOT_ALLOWED');
  assert.equal((await executeAutonomousGoalCycle({}, { trigger: 'unknown' })).status, 'TRIGGER_NOT_ALLOWED');
});

test('read-only corrective result is verified activity but not material progress', () => {
  const assessment = classifyAutonomyResult({ strict_supervision: { status: 'VERIFIED', evidence: ['read-only'], outcome_progress: 'no material change' } });
  const policy = applyMaterialProgressPolicy({ assessment, target: 'rio' });
  assert.equal(policy.material, false);
});

test('NO_PROGRESS cycle does not overwrite last materially verified cycle', () => {
  const prior = { last_material_progress_at_utc: '2026-09-20T00:00:00Z' };
  const state = buildGoalRuntimeState(revenueGoal, { assessment: { status: 'BLOCKED' }, target: 'rio', verified: true }, { material: false }, prior);
  assert.equal(state.last_material_progress_at_utc, prior.last_material_progress_at_utc);
});
