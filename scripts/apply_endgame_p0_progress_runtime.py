from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"{label} anchor not found")
    return text.replace(old, new, 1)


p = Path("victor-telegram-worker/autonomy_runtime.mjs")
s = p.read_text()

old_import = "import { buildActionContract, validateActionContract, summarizeActionContract } from '../brain/action_contract.mjs';\n"
new_import = old_import + "import { buildStrategyFingerprint, evaluateProgressDelta, nextConvergenceState, validateStrategyChange } from '../brain/progress_contract.mjs';\n"
s = replace_once(s, old_import, new_import, "progress import")

if "if (runtimeStatus === 'NO_PROGRESS') score += 20;" not in s:
    s = replace_once(
        s,
        "  if (runtimeStatus === 'BLOCKED_RETRYABLE') score += 15;\n",
        "  if (runtimeStatus === 'BLOCKED_RETRYABLE') score += 15;\n  if (runtimeStatus === 'NO_PROGRESS') score += 20;\n",
        "NO_PROGRESS score",
    )

old_prompt = "Return strict_supervision with status, goal_id, outcome_progress, error_or_blocker, root_cause, solution, next_action, evidence, requires_follow_up. Include final_outcome only when final outcome evidence exists."
new_prompt = "Return strict_supervision with status, goal_id, outcome_progress, error_or_blocker, root_cause, solution, next_action, evidence, requires_follow_up, and progress_delta. progress_delta must include material:boolean, types:[], evidence:[] and must describe a real state/evidence/outcome delta, never a newly-created filename by itself. Include final_outcome only when final outcome evidence exists."
if old_prompt in s:
    s = s.replace(old_prompt, new_prompt, 1)

start = s.index("export function buildGoalRuntimeState(")
end = s.index("\nexport function autonomyConfigured", start)
new_fn = r'''export function buildGoalRuntimeState(previous, selection, outcome, checkedAt = new Date().toISOString()) {
  const goal = selection?.goal || {};
  const goalId = goal.goal_id;
  const previousGoals = previous?.goals || {};
  const oldGoal = previousGoals[goalId] || {};
  const assessment = outcome?.assessment || {};
  const actionContract = outcome?.actionContract || {};
  const rawResult = outcome?.rawResult || {};
  const achieved = outcome?.verified === true && assessment.goalAchieved === true;
  const founderBlocked = assessment.founderGate === true;
  const strategyFingerprint = buildStrategyFingerprint(actionContract);
  const progressDelta = evaluateProgressDelta({
    previousGoal: oldGoal,
    actionContract,
    outcome,
    rawResult,
  });
  const convergence = nextConvergenceState({
    previousGoal: oldGoal,
    progressDelta,
    strategyFingerprint,
    actionContract,
  });
  const materialProgress = progressDelta.material === true;
  const state = achieved
    ? 'GOAL_ACHIEVED_VERIFIED'
    : founderBlocked
      ? 'FOUNDER_ONLY_BLOCKER'
      : outcome?.verified !== true
        ? 'EXECUTION_UNVERIFIED'
        : materialProgress
          ? (assessment.hasBlocker ? 'BLOCKED_RETRYABLE' : 'WORKING')
          : 'NO_PROGRESS';
  const failureFingerprint = assessment.hasBlocker
    ? [selection?.target, assessment.status, assessment.nextAction].filter(Boolean).join('|').slice(0, 240)
    : null;
  const nextDepartment = achieved ? null : recommendNextDepartment(goal, assessment, selection?.target);
  const oldEvidence = Array.isArray(oldGoal.evidence) ? oldGoal.evidence : [];
  const assessmentEvidence = Array.isArray(assessment.evidence) ? assessment.evidence : [];
  const hasNewEvidence = assessmentEvidence.some(item => !oldEvidence.includes(item));
  const sameFailureCount = failureFingerprint && failureFingerprint === oldGoal.failure_fingerprint
    ? (Number(oldGoal.same_failure_count) || 1) + 1
    : (failureFingerprint ? 1 : 0);
  const sameRecommendationCount = assessment.nextAction && assessment.nextAction === oldGoal.last_next_action
    ? (Number(oldGoal.same_recommendation_count) || 1) + 1
    : (assessment.nextAction ? 1 : 0);
  const brainReview = reviewOutcome({
    expected: oldGoal.last_next_action || null,
    actual: assessment.nextAction || null,
    previousAction: oldGoal.last_status || null,
    sameActionCount: Math.max(sameFailureCount, sameRecommendationCount, convergence.no_progress_count),
    hasNewEvidence: materialProgress ? hasNewEvidence : false,
  });
  const fiveWhysRequired = !achieved && !founderBlocked && !materialProgress && (
    convergence.no_progress_count >= 2
    || shouldRunFiveWhys({
      rootCauseKnown: Boolean(assessment.rootCause),
      repeatedFailureCount: Math.max(sameFailureCount, convergence.no_progress_count),
      sameRecommendationCount,
      hasNewEvidence: false,
      departmentExplainsFailure: assessment.hasBlocker ? Boolean(assessment.rootCause || assessment.outcomeProgress) : true,
      confidence: assessment.hasBlocker && !assessment.rootCause ? 'LOW' : 'MEDIUM',
    })
  );
  const evidence = unique([...oldEvidence, ...assessmentEvidence]).slice(-50);
  const outcomeProgressFingerprint = assessment.outcomeProgress
    ? JSON.stringify(assessment.outcomeProgress).slice(0, 1000)
    : null;

  return {
    ...previous,
    schema_version: 2,
    runtime_status: achieved ? 'GOAL_ACHIEVED_VERIFIED' : 'GOAL_DRIVEN_ACTIVE',
    active_goal_id: achieved ? null : goalId,
    goals: {
      ...previousGoals,
      [goalId]: {
        ...oldGoal,
        state,
        attempts: (Number(oldGoal.attempts) || 0) + 1,
        last_target: selection?.target || null,
        recommended_department: nextDepartment,
        brain_required_mode: fiveWhysRequired ? 'FIVE_WHYS_BEFORE_NEXT_DISPATCH' : 'NORMAL_EXECUTION',
        brain_review: brainReview,
        same_failure_count: sameFailureCount,
        same_recommendation_count: sameRecommendationCount,
        no_progress_count: convergence.no_progress_count,
        stalled_strategy_fingerprint: convergence.stalled_strategy_fingerprint,
        recovery_generation: convergence.recovery_generation,
        must_change_strategy: convergence.must_change_strategy,
        last_strategy_fingerprint: strategyFingerprint || null,
        last_progress_delta: progressDelta,
        last_status: assessment.status || 'UNKNOWN',
        last_next_action: assessment.nextAction || null,
        last_root_cause: assessment.rootCause || oldGoal.last_root_cause || null,
        last_outcome_progress_fingerprint: outcomeProgressFingerprint || oldGoal.last_outcome_progress_fingerprint || null,
        last_attempt_at_utc: checkedAt,
        last_verified_progress_at_utc: materialProgress ? checkedAt : (oldGoal.last_verified_progress_at_utc || null),
        last_progress_delta_at_utc: materialProgress ? checkedAt : (oldGoal.last_progress_delta_at_utc || null),
        goal_achieved_at_utc: achieved ? checkedAt : (oldGoal.goal_achieved_at_utc || null),
        evidence,
        failure_fingerprint: failureFingerprint,
      },
    },
    note: 'Runtime state records material progress separately from verified activity. New artifact filenames alone are not progress.',
  };
}'''
s = s[:start] + new_fn + s[end:]

start = s.index("export function buildAutonomyEvidence(")
end = s.index("\nasync function readRepoJsonRaw", start)
new_fn = r'''export function buildAutonomyEvidence(previous, result, controller, checkedAt = new Date().toISOString()) {
  const materialStatuses = new Set(['GOAL_PROGRESS_VERIFIED', 'GOAL_ACHIEVED_VERIFIED', 'DAILY_REPORT_SENT']);
  const materialVerified = materialStatuses.has(result?.status);
  const noProgressVerified = result?.status === 'GOAL_NO_PROGRESS_VERIFIED';
  return {
    ...previous,
    requested_mode: 'AUTONOMOUS_MANAGED_ORCHESTRATOR',
    decision_mode: 'GOAL_DRIVEN_EXECUTIVE',
    runtime_status: materialVerified
      ? 'AUTONOMOUS_GOAL_CYCLE_VERIFIED'
      : noProgressVerified
        ? 'AUTONOMOUS_GOAL_CYCLE_NO_PROGRESS'
        : 'AUTONOMOUS_GOAL_CYCLE_SAFE_STOP',
    automatic_next_action_loop: 'GOAL_SELECT_ROUTE_EXECUTE_VERIFY_MATERIAL_PROGRESS_REPLAN',
    last_verified_cycle: materialVerified ? {
      checked_at_utc: checkedAt,
      cron: controller.cron,
      status: result.status,
      goal_id: result.goalId || null,
      target: result.target || 'all',
      task_id: result.result?.taskId || null,
      evidence_received: result.result?.evidenceReceived ?? true,
      progress_delta: result.result?.progressDelta || null,
    } : (previous?.last_verified_cycle || null),
    last_observed_cycle: {
      checked_at_utc: checkedAt,
      cron: controller.cron,
      status: result?.status || 'UNKNOWN',
      goal_id: result?.goalId || null,
      target: result?.target || null,
      task_id: result?.result?.taskId || null,
      progress_delta: result?.result?.progressDelta || null,
    },
    last_cycle_attempt: {
      checked_at_utc: checkedAt,
      cron: controller.cron,
      status: result?.status || 'UNKNOWN',
      goal_id: result?.goalId || null,
      target: result?.target || null,
      error_code: result?.error_code || null,
      diagnostics: result?.diagnostics || null,
    },
    report_card: result?.reportCard || previous?.report_card || null,
  };
}'''
s = s[:start] + new_fn + s[end:]

old_return = """  return {
    status: outcome.verified
      ? (outcome.assessment.goalAchieved ? 'GOAL_ACHIEVED_VERIFIED' : 'GOAL_PROGRESS_VERIFIED')
      : 'SAFE_STOP',
    goalId: selection.goal.goal_id,
    target: selection.target,
    result: outcome,
  };
"""
new_return = """  const finalRuntimeGoal = state.goals?.[selection.goal.goal_id] || {};
  const cycleStatus = outcome.verified !== true
    ? 'SAFE_STOP'
    : outcome.assessment.goalAchieved
      ? 'GOAL_ACHIEVED_VERIFIED'
      : finalRuntimeGoal.last_progress_delta?.material === true
        ? 'GOAL_PROGRESS_VERIFIED'
        : 'GOAL_NO_PROGRESS_VERIFIED';

  return {
    status: cycleStatus,
    goalId: selection.goal.goal_id,
    target: selection.target,
    result: { ...outcome, progressDelta: finalRuntimeGoal.last_progress_delta || null },
  };
"""
s = replace_once(s, old_return, new_return, "cycle status return")

validation_anchor = """  const contractValidation = validateActionContract(actionContract, selection.goal);
  if (!contractValidation.ok) {
    const error = new Error(`ACTION_CONTRACT_INVALID_${contractValidation.errors.join('_')}`);
    error.code = 'ACTION_CONTRACT_INVALID';
    error.contractErrors = contractValidation.errors;
    throw error;
  }
"""
validation_insert = validation_anchor + """
  const strategyValidation = validateStrategyChange({
    previousGoal: selection.runtimeGoal || {},
    actionContract,
  });
  if (!strategyValidation.ok) {
    const error = new Error(strategyValidation.code);
    error.code = strategyValidation.code;
    error.strategyValidation = strategyValidation;
    throw error;
  }
"""
if "const strategyValidation = validateStrategyChange" not in s:
    s = replace_once(s, validation_anchor, validation_insert, "strategy validation")

return_anchor = """    actionContract,
    actionContractValid: contractValidation.ok,
    taskId: dispatch.taskId,
"""
return_insert = """    actionContract,
    actionContractValid: contractValidation.ok,
    strategyFingerprint: strategyValidation.current_fingerprint,
    strategyChangeValidated: strategyValidation.ok,
    rawResult: result,
    taskId: dispatch.taskId,
"""
if "strategyFingerprint: strategyValidation.current_fingerprint" not in s:
    s = replace_once(s, return_anchor, return_insert, "supervise result")

p.write_text(s)

p = Path("victor-telegram-worker/autonomy_runtime.test.mjs")
s = p.read_text()
if "read-only corrective result is verified activity but not material progress" not in s:
    s += r'''

test('read-only corrective result is verified activity but not material progress', () => {
  const priorProgress = '2026-08-28T17:00:00Z';
  const next = buildGoalRuntimeState(
    { goals: { 'ORG-REVENUE-001': { state: 'WORKING', attempts: 10, evidence: ['old.json'], last_verified_progress_at_utc: priorProgress } } },
    { goal: revenueGoal, target: 'tony_stark' },
    {
      verified: true,
      actionContract: {
        contract_version: 1,
        objective_id: 'ORG-REVENUE-001',
        phase: 'CORRECTIVE_EXECUTE',
        target: 'tony_stark',
        requested_actions: ['READ_REPOSITORY', 'ANALYZE', 'PROPOSE_OR_APPLY_CODE_CHANGE_SUBJECT_TO_AUTHORITY', 'RUN_TESTS', 'RETURN_EVIDENCE'],
        authority_level: 'L2',
        mutation_allowed: true,
        production_allowed: false,
      },
      rawResult: { repair_executed: false },
      assessment: {
        status: 'READ_ONLY_AUDIT_COMPLETED',
        hasBlocker: false,
        founderGate: false,
        goalAchieved: false,
        nextAction: 'VICTOR_REVIEW_AUDIT_AND_AUTHORIZE_REPAIR_PLAN',
        evidence: ['fresh-audit-filename.json'],
      },
    },
    '2026-08-28T18:00:00Z',
  );
  const goal = next.goals['ORG-REVENUE-001'];
  assert.equal(goal.state, 'NO_PROGRESS');
  assert.equal(goal.last_progress_delta.material, false);
  assert.equal(goal.last_verified_progress_at_utc, priorProgress);
});

test('NO_PROGRESS cycle does not overwrite last materially verified cycle', () => {
  const prior = {
    last_verified_cycle: { status: 'GOAL_PROGRESS_VERIFIED', task_id: 'material-task' },
  };
  const next = buildAutonomyEvidence(
    prior,
    { status: 'GOAL_NO_PROGRESS_VERIFIED', goalId: 'ORG-REVENUE-001', target: 'tony_stark', result: { taskId: 'audit-task', progressDelta: { material: false } } },
    { cron: '*/15 * * * *' },
    '2026-08-28T18:00:00Z',
  );
  assert.equal(next.runtime_status, 'AUTONOMOUS_GOAL_CYCLE_NO_PROGRESS');
  assert.equal(next.last_verified_cycle.task_id, 'material-task');
  assert.equal(next.last_observed_cycle.task_id, 'audit-task');
});
'''
    p.write_text(s)
