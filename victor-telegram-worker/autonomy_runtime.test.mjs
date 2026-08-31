import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTONOMY_CRONS,
  autonomyConfigured,
  buildAutonomyEvidence,
  buildGoalRuntimeState,
  buildGoalTaskPrompt,
  buildVictorReportCard,
  chooseGoalDepartment,
  classifyAutonomyResult,
  scoreGoal,
  selectAutonomyGoal,
} from './autonomy_runtime.mjs';

const revenueGoal = {
  goal_id: 'ORG-REVENUE-001',
  title: 'Revenue',
  status: 'ACTIVE',
  priority: 100,
  objective: 'Generate verified revenue',
  success_conditions: ['Verified paid outcome'],
  required_evidence_level: 'E5_BUSINESS_OUTCOME',
  primary_department: 'rio',
  allowed_departments: ['rio', 'tony_stark', 'aura3'],
  hard_boundaries: ['NO_RAW_SECRET_DISCLOSURE'],
};

test('goal routing follows runtime recommendation instead of fixed department rotation', () => {
  assert.equal(chooseGoalDepartment(revenueGoal, { recommended_department: 'tony_stark' }, ['rio', 'tony_stark']), 'tony_stark');
  assert.equal(chooseGoalDepartment(revenueGoal, {}, ['rio', 'tony_stark']), 'rio');
});

test('highest-value active goal is selected', () => {
  const registry = { goals: [
    { ...revenueGoal, goal_id: 'g-low', priority: 30 },
    { ...revenueGoal, goal_id: 'g-high', priority: 90 },
  ] };
  const selected = selectAutonomyGoal(registry, { goals: {} }, ['rio'], Date.parse('2026-08-28T18:00:00Z'));
  assert.equal(selected.goal.goal_id, 'g-high');
  assert.equal(selected.target, 'rio');
});

test('completed goal is not selected again', () => {
  const selected = selectAutonomyGoal(
    { goals: [revenueGoal] },
    { goals: { 'ORG-REVENUE-001': { state: 'GOAL_ACHIEVED_VERIFIED' } } },
    ['rio'],
  );
  assert.equal(selected, null);
});

test('stale unresolved work gains bounded priority', () => {
  const now = Date.parse('2026-08-28T18:00:00Z');
  const fresh = scoreGoal(revenueGoal, { state: 'WORKING', last_attempt_at_utc: '2026-08-28T17:55:00Z' }, now);
  const stale = scoreGoal(revenueGoal, { state: 'WORKING', last_attempt_at_utc: '2026-08-28T12:00:00Z' }, now);
  assert.ok(stale > fresh);
});

test('goal task prompt delegates HOW but keeps target and boundaries fixed', () => {
  const prompt = buildGoalTaskPrompt(revenueGoal, 'EXECUTE');
  assert.match(prompt, /Target: Generate verified revenue/);
  assert.match(prompt, /HOW is delegated/);
  assert.match(prompt, /NO_RAW_SECRET_DISCLOSURE/);
  assert.match(prompt, /Do not wait for routine Founder approval/);
});

test('verified goal cycle creates persistent certification evidence', () => {
  const state = buildAutonomyEvidence(
    { last_verified_cycle: null },
    { status: 'GOAL_PROGRESS_VERIFIED', goalId: 'ORG-REVENUE-001', target: 'rio', result: { taskId: 'task-1', evidenceReceived: true } },
    { cron: '*/15 * * * *' },
    '2026-08-28T18:00:00.000Z',
  );
  assert.equal(state.runtime_status, 'AUTONOMOUS_GOAL_CYCLE_VERIFIED');
  assert.equal(state.decision_mode, 'GOAL_DRIVEN_EXECUTIVE');
  assert.equal(state.last_verified_cycle.goal_id, 'ORG-REVENUE-001');
  assert.equal(state.last_verified_cycle.task_id, 'task-1');
});

test('autonomy requires all existing bindings', () => {
  assert.equal(autonomyConfigured({}), false);
  assert.equal(autonomyConfigured({
    GITHUB_ORCHESTRATION_TOKEN: 'present',
    TELEGRAM_BOT_TOKEN_VICTOR: 'present',
    VICTOR_FOUNDER_CHAT_ID: 'present',
  }), true);
});

test('generic approval waits are bypassed in self mode', () => {
  const assessment = classifyAutonomyResult({
    strict_supervision: {
      status: 'BLOCKED',
      error_or_blocker: 'FOUNDER_APPROVAL_REQUIRED',
      next_action: 'FOUNDER_REVIEW',
      evidence: ['audit.json'],
      requires_follow_up: true,
    },
  });
  assert.equal(assessment.founderGate, false);
  assert.equal(assessment.goalAchieved, false);
  assert.equal(assessment.hasBlocker, true);
});

test('credential administration remains Founder-only', () => {
  const assessment = classifyAutonomyResult({
    strict_supervision: {
      status: 'BLOCKED',
      error_or_blocker: 'MISSING CREDENTIAL',
      next_action: 'ADD CREDENTIAL',
      evidence: ['credential_presence_check.json'],
      requires_follow_up: true,
    },
  });
  assert.equal(assessment.founderGate, true);
  assert.equal(assessment.credentialGate, true);
});

test('goal or hard-boundary change remains Founder-owned', () => {
  const assessment = classifyAutonomyResult({
    strict_supervision: {
      status: 'BLOCKED',
      error_or_blocker: 'HARD_BOUNDARY_CONFLICT',
      next_action: 'CHANGE_GOAL',
      evidence: ['constraint.json'],
      requires_follow_up: true,
    },
  });
  assert.equal(assessment.founderGate, true);
  assert.equal(assessment.boundaryGate, true);
});

test('goal achievement requires evidence', () => {
  const withoutEvidence = classifyAutonomyResult({
    strict_supervision: { status: 'OBJECTIVE_MET_VERIFIED', evidence: [] },
  });
  const withEvidence = classifyAutonomyResult({
    strict_supervision: { status: 'OBJECTIVE_MET_VERIFIED', evidence: ['payment.json'] },
  });
  assert.equal(withoutEvidence.goalAchieved, false);
  assert.equal(withEvidence.goalAchieved, true);
});

test('goal runtime state records progress and recommended replan route', () => {
  const next = buildGoalRuntimeState(
    { goals: { 'ORG-REVENUE-001': { state: 'READY', attempts: 0, evidence: [] } } },
    { goal: revenueGoal, target: 'rio' },
    {
      verified: true,
      assessment: {
        status: 'BLOCKED',
        hasBlocker: true,
        founderGate: false,
        goalAchieved: false,
        nextAction: 'Tony technical workflow repair required',
        evidence: ['failure.json'],
      },
    },
    '2026-08-28T18:00:00Z',
  );
  assert.equal(next.goals['ORG-REVENUE-001'].state, 'BLOCKED_RETRYABLE');
  assert.equal(next.goals['ORG-REVENUE-001'].recommended_department, 'tony_stark');
  assert.equal(next.goals['ORG-REVENUE-001'].attempts, 1);
});

test('verified final goal outcome closes runtime goal', () => {
  const next = buildGoalRuntimeState(
    { goals: { 'ORG-REVENUE-001': { state: 'WORKING', attempts: 2, evidence: [] } } },
    { goal: revenueGoal, target: 'rio' },
    {
      verified: true,
      assessment: {
        status: 'OBJECTIVE_MET_VERIFIED',
        hasBlocker: false,
        founderGate: false,
        goalAchieved: true,
        nextAction: 'CLOSE',
        evidence: ['payment.json'],
      },
    },
    '2026-08-28T18:00:00Z',
  );
  assert.equal(next.runtime_status, 'GOAL_ACHIEVED_VERIFIED');
  assert.equal(next.active_goal_id, null);
  assert.equal(next.goals['ORG-REVENUE-001'].state, 'GOAL_ACHIEVED_VERIFIED');
});

test('Victor report card gives marks only for verified department final outcomes', () => {
  const card = buildVictorReportCard([
    { target: 'rio', verified: true, assessment: { finalOutcome: null } },
    { target: 'aura3', verified: true, assessment: { finalOutcome: {
      verified: true, objective_met: false, score: 7, evidence: ['lead.json'],
    } } },
    { target: 'tony_stark', verified: true, assessment: { finalOutcome: {
      verified: true, objective_met: true, score: 10, evidence: ['repair.json'],
    } } },
  ]);
  assert.equal(card.score, 6);
  assert.equal(card.departments[0].score, 1);
  assert.equal(card.departments[1].score, 7);
  assert.equal(card.departments[2].score, 10);
  assert.equal(card.system_health_points, 0);
});

test('10 out of 10 requires objective met evidence', () => {
  const card = buildVictorReportCard([{ target: 'rio', verified: true, assessment: { finalOutcome: {
    verified: true, objective_met: false, score: 10, evidence: ['partial.json'],
  } } }]);
  assert.equal(card.score, 9);
});

test('Founder manual executive trigger is a supported execution trigger', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('./autonomy_runtime.mjs', import.meta.url), 'utf8'));
  assert.match(source, /manualFounderTrigger = controller\?\.cron === 'founder-command'/);
  assert.match(source, /controller\.cron !== SUPERVISION_CRON && !manualFounderTrigger/);
});

test('cron remains watchdog plus 10 PM IST report', () => {
  assert.deepEqual(AUTONOMY_CRONS, {
    SUPERVISION_CRON: '*/15 * * * *',
    DAILY_REPORT_CRON: '30 16 * * *',
  });
});
