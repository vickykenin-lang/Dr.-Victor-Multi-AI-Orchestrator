import {
  aura3BridgeConfigured,
  dispatchAura3Task,
  waitForAura3Result,
  verifyAura3Result,
  tonyBridgeConfigured,
  dispatchTonyTask,
  waitForTonyResult,
  verifyTonyResult,
  rioBridgeConfigured,
  dispatchRioTask,
  waitForRioResult,
  verifyRioResult,
} from './department_bridge.mjs';

import { isExecutionPaused } from './emergency_pause_runtime.mjs';
import { shouldRunFiveWhys, reviewOutcome, departmentCapabilityFit } from '../brain/runtime.mjs';

const TELEGRAM_API = 'https://api.telegram.org';
const SUPERVISION_CRON = '*/15 * * * *';
const DAILY_REPORT_CRON = '30 16 * * *';
const VICTOR_REPO = 'vickykenin-lang/Dr.-Victor-Multi-AI-Orchestrator';
const AUTONOMY_STATE_PATH = 'data/autonomy_state.json';
const GOAL_RUNTIME_STATE_PATH = 'data/goal_runtime_state.json';
const RAW_BASE = `https://raw.githubusercontent.com/${VICTOR_REPO}/main`;
const GOAL_REGISTRY_RAW = `${RAW_BASE}/data/goal_registry.json`;
const GOAL_RUNTIME_STATE_RAW = `${RAW_BASE}/data/goal_runtime_state.json`;
const REVENUE_OUTCOMES_RAW = `${RAW_BASE}/data/revenue_outcomes.json`;

const ACTIVE_GOAL_STATES = new Set(['ACTIVE', 'READY', 'WORKING', 'BLOCKED_RETRYABLE']);
const TERMINAL_GOAL_STATES = new Set(['GOAL_ACHIEVED_VERIFIED', 'COMPLETED', 'CANCELLED', 'FOUNDER_HOLD']);

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function normalizedState(value, fallback = 'UNKNOWN') {
  return String(value || fallback).trim().toUpperCase();
}

export function classifyAutonomyResult(result) {
  const strict = result?.strict_supervision || {};
  const status = normalizedState(strict.status || result?.execution_status || 'UNKNOWN');
  const blocker = strict.error_or_blocker ?? result?.blockers ?? null;
  const strictEvidence = Array.isArray(strict.evidence) ? strict.evidence : [];
  const finalOutcome = result?.final_outcome || strict?.final_outcome || null;
  const finalEvidence = Array.isArray(finalOutcome?.evidence) ? finalOutcome.evidence : [];
  const evidence = unique([...strictEvidence, ...finalEvidence]);
  const hasBlocker = Boolean(
    (Array.isArray(blocker) && blocker.length) ||
    (!Array.isArray(blocker) && blocker && !/^none|no blocker|null$/i.test(String(blocker)))
  );
  const authorityText = [status, strict.next_action, blocker].flat().filter(Boolean).join(' ').toUpperCase();
  const credentialGate = /(?:ADD|CREATE|PROVISION|REPLACE|ROTATE|REVOKE|EXPAND).{0,28}(?:CREDENTIAL|SECRET|ACCOUNT IDENTITY)|(?:CREDENTIAL|SECRET).{0,28}(?:ADD|CREATE|PROVISION|REPLACE|ROTATE|REVOKE|EXPAND)|MISSING (?:CREDENTIAL|SECRET)/.test(authorityText);
  const boundaryGate = /OBJECTIVE_IMPOSSIBLE|GOAL_IMPOSSIBLE|HARD_BOUNDARY_CONFLICT|CHANGE_(?:GOAL|OBJECTIVE|SUCCESS_CRITERIA|BUDGET_CEILING)|FOUNDER_GOAL_CHANGE_REQUIRED/.test(authorityText);
  const founderGate = credentialGate || boundaryGate;
  const statusClaimsGoal = /GOAL_ACHIEVED_VERIFIED|OBJECTIVE_MET_VERIFIED/.test(status);
  const finalClaimsGoal = finalOutcome?.verified === true && finalOutcome?.objective_met === true && finalEvidence.length > 0;
  const goalAchieved = (statusClaimsGoal && evidence.length > 0) || finalClaimsGoal;
  const verifiedSuccess = goalAchieved || (
    /COMPLETED|VERIFIED|PASS|HEALTHY|READY/.test(status) &&
    !/PENDING|NOT_VERIFIED|SAFE_STOP|BLOCKED|FAILED/.test(status) &&
    evidence.length > 0
  );
  return {
    status,
    hasBlocker,
    founderGate,
    credentialGate,
    boundaryGate,
    verifiedSuccess,
    goalAchieved,
    requiresFollowUp: strict.requires_follow_up === true,
    nextAction: strict.next_action || 'NOT_PROVIDED',
    outcomeProgress: strict.outcome_progress || result?.outcome_progress || null,
    rootCause: strict.root_cause || result?.root_cause || null,
    solution: strict.solution || result?.solution || null,
    evidence,
    finalOutcome,
  };
}

export function buildVictorReportCard(checks) {
  const departments = (Array.isArray(checks) ? checks : []).map(check => {
    const finalOutcome = check?.assessment?.finalOutcome;
    const evidence = Array.isArray(finalOutcome?.evidence) ? finalOutcome.evidence : [];
    const verified = check?.verified === true && finalOutcome?.verified === true && evidence.length > 0;
    let score = 1;
    if (verified) {
      const declared = Number(finalOutcome?.score);
      score = Number.isFinite(declared) ? Math.max(1, Math.min(10, Math.round(declared))) : 1;
      if (score === 10 && finalOutcome?.objective_met !== true) score = 9;
    }
    return {
      department: check?.target || 'unknown',
      score,
      final_outcome_verified: verified,
      objective_met: finalOutcome?.objective_met === true,
      evidence,
    };
  });
  const score = departments.length
    ? Math.round((departments.reduce((sum, item) => sum + item.score, 0) / departments.length) * 10) / 10
    : 1;
  return {
    score,
    target: 10,
    basis: 'VERIFIED_DEPARTMENT_FINAL_OUTCOMES_ONLY',
    system_health_points: 0,
    activity_points: 0,
    departments,
  };
}

export function goalDepartmentOrder(goal, runtimeGoal = {}) {
  const allowed = Array.isArray(goal?.allowed_departments) ? goal.allowed_departments : [];
  return unique([
    runtimeGoal?.recommended_department,
    goal?.primary_department,
    ...allowed,
  ]).filter(dept => !allowed.length || allowed.includes(dept));
}

export function chooseGoalDepartment(goal, runtimeGoal = {}, availableDepartments = []) {
  const available = new Set(availableDepartments || []);
  return goalDepartmentOrder(goal, runtimeGoal).find(dept => available.has(dept)) || null;
}

export function scoreGoal(goal, runtimeGoal = {}, nowMs = Date.now()) {
  const goalStatus = normalizedState(goal?.status, 'ACTIVE');
  const runtimeStatus = normalizedState(runtimeGoal?.state, 'READY');
  if (!ACTIVE_GOAL_STATES.has(goalStatus) && goalStatus !== 'ACTIVE') return Number.NEGATIVE_INFINITY;
  if (TERMINAL_GOAL_STATES.has(runtimeStatus)) return Number.NEGATIVE_INFINITY;

  let score = Number(goal?.priority) || 0;
  if (runtimeStatus === 'READY') score += 5;
  if (runtimeStatus === 'WORKING') score += 10;
  if (runtimeStatus === 'BLOCKED_RETRYABLE') score += 15;
  if (runtimeGoal?.failure_fingerprint) score += 3;

  const lastAttempt = Date.parse(runtimeGoal?.last_attempt_at_utc || '');
  if (Number.isFinite(lastAttempt)) {
    const staleMinutes = Math.max(0, (Number(nowMs) - lastAttempt) / 60000);
    score += Math.min(20, Math.floor(staleMinutes / 15));
  } else {
    score += 10;
  }

  const deadline = Date.parse(goal?.deadline || '');
  if (Number.isFinite(deadline)) {
    const hoursRemaining = (deadline - Number(nowMs)) / 3600000;
    if (hoursRemaining <= 0) score += 30;
    else if (hoursRemaining <= 24) score += 20;
    else if (hoursRemaining <= 72) score += 10;
  }
  return score;
}

export function selectAutonomyGoal(registry, runtimeState, availableDepartments = [], nowMs = Date.now()) {
  const goals = Array.isArray(registry?.goals) ? registry.goals : [];
  const states = runtimeState?.goals || {};
  const candidates = goals
    .map(goal => {
      const runtimeGoal = states[goal.goal_id] || {};
      const target = chooseGoalDepartment(goal, runtimeGoal, availableDepartments);
      const score = target ? scoreGoal(goal, runtimeGoal, nowMs) : Number.NEGATIVE_INFINITY;
      return { goal, runtimeGoal, target, score };
    })
    .filter(item => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score || (Number(b.goal?.priority) || 0) - (Number(a.goal?.priority) || 0));
  return candidates[0] || null;
}

export function buildGoalTaskPrompt(goal, phase = 'EXECUTE', runtimeGoal = {}) {
  const success = Array.isArray(goal?.success_conditions) ? goal.success_conditions : [];
  const boundaries = Array.isArray(goal?.hard_boundaries) ? goal.hard_boundaries : [];
  const fiveWhysMode = phase === 'FIVE_WHYS_DIAGNOSIS' || runtimeGoal?.brain_required_mode === 'FIVE_WHYS_BEFORE_NEXT_DISPATCH';
  return [
    `VICTOR GOAL CONTRACT — ${phase}`,
    `Goal ID: ${goal?.goal_id || 'UNKNOWN'}`,
    `Target: ${goal?.objective || 'NOT_PROVIDED'}`,
    `Success conditions: ${success.join(' | ') || 'Use canonical department objective and evidence standard.'}`,
    `Required evidence: ${goal?.required_evidence_level || 'CANONICAL_REQUIRED_EVIDENCE'}`,
    `Hard boundaries: ${boundaries.join(' | ') || 'Existing constitutional, credential, cost, compliance and evidence boundaries.'}`,
    'Brain rule: decompose work into a concrete deliverable with authority, evidence, exit criteria, and next handoff. Department role is capability guidance, not a reason to reject a valid cross-department technical support task.',
    fiveWhysMode
      ? 'BRAIN FIVE-WHYS MODE: do not repeat the previous action. Start from the verified symptom, build an evidence-backed causal chain, label unsupported causes HYPOTHESIS, identify the best supported controllable root cause, and return the corrective next action. If the verified chain ends at a Founder-only boundary, state the exact Founder action required; otherwise continue without Founder approval.'
      : 'Operating rule: the target is fixed; HOW is delegated. Choose the highest-impact valid next action yourself, execute it inside existing authority, and change the plan if the previous route is weak or blocked.',
    'Commercial priority rule: when verified revenue is zero and executable offers/actions exist, prioritize the closest policy-valid revenue/conversion action. Planning, readiness documents, or pillar rotation must not displace an executable higher-impact commercial action unless they remove a verified blocker.',
    'Do not wait for routine Founder approval. Founder is required only for credential/account identity administration, a hard-boundary/goal change, or objective impossibility after governed recovery.',
    'Return fresh evidence. Do not report task completion as goal achievement unless the Goal Contract success conditions are actually verified.',
    'Return strict_supervision with status, goal_id, outcome_progress, error_or_blocker, root_cause, solution, next_action, evidence, requires_follow_up. Include final_outcome only when final outcome evidence exists.',
  ].join('\n');
}

export function recommendNextDepartment(goal, assessment, currentTarget) {
  const allowed = new Set(Array.isArray(goal?.allowed_departments) ? goal.allowed_departments : []);
  const text = [assessment?.status, assessment?.nextAction, assessment?.rootCause, assessment?.solution, assessment?.hasBlocker ? 'BLOCKER' : '', assessment?.outcomeProgress]
    .filter(Boolean).join(' ').toUpperCase();
  if (allowed.has('tony_stark') && departmentCapabilityFit('tony_stark', text)) return 'tony_stark';
  if (allowed.has('aura3') && departmentCapabilityFit('aura3', text)) return 'aura3';
  if (allowed.has('rio') && departmentCapabilityFit('rio', text)) return 'rio';
  if (allowed.has('hulk') && departmentCapabilityFit('hulk', text)) return 'hulk';
  return currentTarget || goal?.primary_department || null;
}

export function buildGoalRuntimeState(previous, selection, outcome, checkedAt = new Date().toISOString()) {
  const goal = selection?.goal || {};
  const goalId = goal.goal_id;
  const previousGoals = previous?.goals || {};
  const oldGoal = previousGoals[goalId] || {};
  const assessment = outcome?.assessment || {};
  const achieved = outcome?.verified === true && assessment.goalAchieved === true;
  const founderBlocked = assessment.founderGate === true;
  const verifiedProgress = outcome?.verified === true && Array.isArray(assessment.evidence) && assessment.evidence.length > 0;
  const state = achieved
    ? 'GOAL_ACHIEVED_VERIFIED'
    : founderBlocked
      ? 'FOUNDER_ONLY_BLOCKER'
      : outcome?.verified === true
        ? (assessment.hasBlocker ? 'BLOCKED_RETRYABLE' : 'WORKING')
        : 'EXECUTION_UNVERIFIED';
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
    sameActionCount: Math.max(sameFailureCount, sameRecommendationCount),
    hasNewEvidence,
  });
  const fiveWhysRequired = !achieved && !founderBlocked && shouldRunFiveWhys({
    rootCauseKnown: Boolean(assessment.rootCause),
    repeatedFailureCount: sameFailureCount,
    sameRecommendationCount,
    hasNewEvidence,
    departmentExplainsFailure: assessment.hasBlocker ? Boolean(assessment.rootCause || assessment.outcomeProgress) : true,
    confidence: assessment.hasBlocker && !assessment.rootCause ? 'LOW' : 'MEDIUM',
  });
  const evidence = unique([...oldEvidence, ...assessmentEvidence]).slice(-50);

  return {
    ...previous,
    schema_version: 1,
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
        last_status: assessment.status || 'UNKNOWN',
        last_next_action: assessment.nextAction || null,
        last_attempt_at_utc: checkedAt,
        last_verified_progress_at_utc: verifiedProgress ? checkedAt : (oldGoal.last_verified_progress_at_utc || null),
        goal_achieved_at_utc: achieved ? checkedAt : (oldGoal.goal_achieved_at_utc || null),
        evidence,
        failure_fingerprint: failureFingerprint,
      },
    },
    note: 'Runtime state records progress and routing. It does not redefine the Goal Contract.',
  };
}

export function autonomyConfigured(env) {
  return Boolean(
    env.GITHUB_ORCHESTRATION_TOKEN &&
    env.TELEGRAM_BOT_TOKEN_VICTOR &&
    env.VICTOR_FOUNDER_CHAT_ID
  );
}

export function buildAutonomyEvidence(previous, result, controller, checkedAt = new Date().toISOString()) {
  const verifiedStatuses = new Set(['GOAL_PROGRESS_VERIFIED', 'GOAL_ACHIEVED_VERIFIED', 'DAILY_REPORT_SENT']);
  const verified = verifiedStatuses.has(result?.status);
  return {
    ...previous,
    requested_mode: 'AUTONOMOUS_MANAGED_ORCHESTRATOR',
    decision_mode: 'GOAL_DRIVEN_EXECUTIVE',
    runtime_status: verified ? 'AUTONOMOUS_GOAL_CYCLE_VERIFIED' : 'AUTONOMOUS_GOAL_CYCLE_SAFE_STOP',
    automatic_next_action_loop: 'GOAL_SELECT_ROUTE_EXECUTE_VERIFY_REPLAN_IMPLEMENTED',
    last_verified_cycle: verified ? {
      checked_at_utc: checkedAt,
      cron: controller.cron,
      status: result.status,
      goal_id: result.goalId || null,
      target: result.target || 'all',
      task_id: result.result?.taskId || null,
      evidence_received: result.result?.evidenceReceived ?? true,
    } : (previous?.last_verified_cycle || null),
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
}

async function readRepoJsonRaw(url, fallback = {}) {
  try {
    const response = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return await response.json();
  } catch {
    return fallback;
  }
}

async function readRepoJson(env, path, fallback = {}) {
  const tokens = [...new Set([env.GITHUB_ORCHESTRATION_TOKEN, env.GITHUB_MEMORY_TOKEN].filter(Boolean))];
  const api = `https://api.github.com/repos/${VICTOR_REPO}/contents/${path}?ref=main&t=${Date.now()}`;
  let lastError = 'NO_TOKEN';
  for (const token of tokens) {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.raw+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Dr-Victor-Goal-Runtime/2.1',
    };
    try {
      const response = await fetch(api, { headers, cache: 'no-store' });
      if (!response.ok) {
        lastError = `HTTP_${response.status}`;
        if ([401, 403].includes(response.status)) continue;
        continue;
      }
      return await response.json();
    } catch (error) {
      lastError = error?.message || 'READ_FAILED';
    }
  }
  // Public raw is retained only as a compatibility fallback; canonical runtime
  // reads must prefer authenticated GitHub API access so a transient raw/CDN
  // failure cannot silently turn an active goal registry into an empty registry.
  const rawMap = {
    'data/goal_registry.json': GOAL_REGISTRY_RAW,
    'data/goal_runtime_state.json': GOAL_RUNTIME_STATE_RAW,
    'data/revenue_outcomes.json': REVENUE_OUTCOMES_RAW,
    [AUTONOMY_STATE_PATH]: `${RAW_BASE}/${AUTONOMY_STATE_PATH}`,
  };
  if (rawMap[path]) {
    const publicRecord = await readRepoJsonRaw(rawMap[path], null);
    if (publicRecord) return publicRecord;
  }
  throw new Error(`CANONICAL_STATE_READ_FAILED_${path.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}_${lastError}`);
}

async function updateRepoJson(env, path, nextOrBuilder, message) {
  const tokens = [...new Set([env.GITHUB_ORCHESTRATION_TOKEN, env.GITHUB_MEMORY_TOKEN].filter(Boolean))];
  if (!tokens.length) throw new Error('GOAL_STATE_TOKEN_NOT_CONFIGURED');
  const api = `https://api.github.com/repos/${VICTOR_REPO}/contents/${path}`;
  let lastError = 'UNKNOWN';
  for (const token of tokens) {
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'Dr-Victor-Goal-Runtime/2.2' };
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const currentResponse = await fetch(`${api}?ref=main&t=${Date.now()}`, { headers, cache: 'no-store' });
      if (!currentResponse.ok) { lastError = `READ_HTTP_${currentResponse.status}`; if ([401, 403].includes(currentResponse.status)) break; continue; }
      const currentFile = await currentResponse.json();
      let current = {};
      try { current = JSON.parse(decodeURIComponent(escape(atob(currentFile.content || '')))); } catch (_) { current = {}; }
      // Rebuild from the freshest repository document on every retry. This is
      // critical: a new SHA with an old precomputed body would silently erase a
      // concurrent cycle's state even though the retry itself succeeds.
      const next = typeof nextOrBuilder === 'function' ? nextOrBuilder(current) : nextOrBuilder;
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(next, null, 2) + '\n')));
      const updateResponse = await fetch(api, { method: 'PUT', headers, body: JSON.stringify({ message, content: encoded, sha: currentFile.sha, branch: 'main' }) });
      if (updateResponse.ok) return next;
      lastError = `WRITE_HTTP_${updateResponse.status}`;
      if ([401, 403].includes(updateResponse.status)) break;
      if ([409, 422].includes(updateResponse.status)) { await new Promise(resolve => setTimeout(resolve, attempt * 750)); continue; }
      break;
    }
  }
  throw new Error(`GOAL_STATE_PERSIST_FAILED_${lastError}`);
}

export async function persistAutonomyEvidence(env, controller, result) {
  return updateRepoJson(
    env,
    AUTONOMY_STATE_PATH,
    current => buildAutonomyEvidence(current || {}, result, controller),
    `Record Victor goal-driven cycle: ${result.status}`,
  );
}

async function availableDepartments(env) {
  const configured = [];
  if (rioBridgeConfigured(env)) configured.push('rio');
  if (tonyBridgeConfigured(env)) configured.push('tony_stark');
  if (aura3BridgeConfigured(env)) configured.push('aura3');
  const checks = await Promise.all(configured.map(async department => ({
    department,
    pause: await isExecutionPaused(env, department),
  })));
  return checks.filter(item => item.pause.paused !== true).map(item => item.department);
}

async function loadGoalRegistry(env) {
  const record = await readRepoJson(env, 'data/goal_registry.json', { goals: [] });
  if (!Array.isArray(record?.goals) || record.goals.length === 0) throw new Error('GOAL_REGISTRY_EMPTY_OR_INVALID');
  return record;
}

async function loadGoalRuntimeState(env) {
  const state = await readRepoJson(env, GOAL_RUNTIME_STATE_PATH, { schema_version: 1, goals: {} });
  if (!state?.goals || typeof state.goals !== 'object') throw new Error('GOAL_RUNTIME_STATE_INVALID');
  return state;
}

async function persistGoalRuntimeState(env, nextState, goalId) {
  return updateRepoJson(
    env,
    GOAL_RUNTIME_STATE_PATH,
    current => ({
      ...(current || {}),
      ...nextState,
      goals: {
        ...((current || {}).goals || {}),
        ...((nextState || {}).goals || {}),
        [goalId]: nextState?.goals?.[goalId] || current?.goals?.[goalId] || {},
      },
    }),
    `Record Victor goal progress: ${goalId}`,
  );
}

export async function runAutonomousCycle(controller, env) {
  if (!autonomyConfigured(env)) throw new Error('AUTONOMY_REQUIRED_BINDINGS_NOT_CONFIGURED');

  if (controller.cron === DAILY_REPORT_CRON) {
    const registry = await loadGoalRegistry(env);
    const state = await loadGoalRuntimeState(env);
    const revenue = await loadCanonicalRevenue(env);
    const activeGoal = registry.goals.find(goal => goal.goal_id === state.active_goal_id)
      || registry.goals.find(goal => normalizedState(goal.status) === 'ACTIVE')
      || null;
    const activeState = activeGoal ? (state.goals?.[activeGoal.goal_id] || {}) : {};
    const lines = [
      'Victor daily goal report',
      `Goal: ${activeGoal?.title || 'No active goal'}`,
      `Goal state: ${activeState.state || (activeGoal ? 'READY' : 'NONE')}`,
      `Last route: ${activeState.last_target || 'Not run yet'}`,
      `Next route: ${activeState.recommended_department || activeGoal?.primary_department || 'None'}`,
      `Verified collected revenue: INR ${revenue.collected_revenue_inr} (${revenue.payments_received} payment events)`,
    ];
    if (activeState.state === 'FOUNDER_ONLY_BLOCKER') {
      lines.push(`Action required: ${activeState.last_next_action || 'Founder boundary decision required'}`);
    } else {
      lines.push('Aapko abhi routine execution ke liye kuch approve nahi karna.');
    }
    await sendFounder(env, lines.join('\n'));
    return { status: 'DAILY_REPORT_SENT', goalId: activeGoal?.goal_id || null, target: activeState.last_target || null, revenue };
  }

  if (controller.cron !== SUPERVISION_CRON) return { status: 'IGNORED_UNKNOWN_CRON', cron: controller.cron };

  const pause = await isExecutionPaused(env);
  if (pause.paused) return { status: 'SAFE_STOP', goalId: null, target: null, error_code: 'EMERGENCY_PAUSE_ACTIVE', diagnostics: pause };

  const registry = await loadGoalRegistry(env);
  let state = await loadGoalRuntimeState(env);
  const available = await availableDepartments(env);
  let selection = selectAutonomyGoal(registry, state, available, controller.scheduledTime);
  if (!selection) {
    const activeGoals = (registry.goals || []).filter(goal => normalizedState(goal.status) === 'ACTIVE');
    const activeGoalIds = activeGoals.map(goal => goal.goal_id);
    const candidate_diagnostics = (registry.goals || []).map(goal => {
      const runtimeGoal = state?.goals?.[goal.goal_id] || {};
      const departmentOrder = goalDepartmentOrder(goal, runtimeGoal);
      const target = chooseGoalDepartment(goal, runtimeGoal, available);
      const score = target ? scoreGoal(goal, runtimeGoal, controller.scheduledTime) : Number.NEGATIVE_INFINITY;
      return {
        goal_id: goal.goal_id || null,
        goal_status: normalizedState(goal.status, 'ACTIVE'),
        runtime_state: normalizedState(runtimeGoal.state, 'READY'),
        department_order: departmentOrder,
        chosen_target: target,
        finite_score: Number.isFinite(score),
        score: Number.isFinite(score) ? score : null,
      };
    });
    return {
      status: 'SAFE_STOP',
      goalId: state.active_goal_id || activeGoalIds[0] || null,
      target: null,
      error_code: 'NO_ACTIONABLE_GOAL_OR_QUALIFIED_ROUTE',
      diagnostics: {
        registry_goal_count: Array.isArray(registry.goals) ? registry.goals.length : 0,
        active_goal_ids: activeGoalIds,
        available_departments: available,
        runtime_active_goal_id: state.active_goal_id || null,
        bridge_configured: {
          rio: rioBridgeConfigured(env),
          tony_stark: tonyBridgeConfigured(env),
          aura3: aura3BridgeConfigured(env),
        },
        candidates: candidate_diagnostics,
      },
    };
  }

  const initialPhase = (
    selection.runtimeGoal?.brain_required_mode === 'FIVE_WHYS_BEFORE_NEXT_DISPATCH'
    || Number(selection.runtimeGoal?.same_recommendation_count) >= 2
    || Number(selection.runtimeGoal?.same_failure_count) >= 2
    || selection.runtimeGoal?.brain_review?.repeat_loop_detected === true
  )
    ? 'FIVE_WHYS_DIAGNOSIS'
    : 'EXECUTE';
  let outcome = await superviseGoal(selection, env, initialPhase);
  state = buildGoalRuntimeState(state, selection, outcome);

  if (
    outcome.verified &&
    outcome.assessment.requiresFollowUp &&
    !outcome.assessment.founderGate &&
    !outcome.assessment.goalAchieved
  ) {
    const nextRuntimeGoal = state.goals?.[selection.goal.goal_id] || {};
    const nextTarget = chooseGoalDepartment(selection.goal, nextRuntimeGoal, available);
    if (nextTarget) {
      selection = { ...selection, runtimeGoal: nextRuntimeGoal, target: nextTarget };
      const followUpPhase = nextRuntimeGoal.brain_required_mode === 'FIVE_WHYS_BEFORE_NEXT_DISPATCH'
        ? 'FIVE_WHYS_DIAGNOSIS'
        : 'REPLAN_EXECUTE';
      const followUp = await superviseGoal(selection, env, followUpPhase);
      state = buildGoalRuntimeState(state, selection, followUp);
      outcome = { ...followUp, previousTaskId: outcome.taskId, automaticReplan: true };
    }
  }

  await persistGoalRuntimeState(env, state, selection.goal.goal_id);

  if (outcome.assessment.founderGate) {
    await sendFounder(env, [
      'Victor boundary escalation',
      `Goal: ${selection.goal.title}`,
      `Status: ${outcome.assessment.status}`,
      `Required: ${outcome.assessment.nextAction}`,
      'Routine plan approval nahi chahiye; ye Founder-owned boundary hai.',
    ].join('\n'));
  } else if (outcome.verified && outcome.assessment.goalAchieved) {
    await sendFounder(env, [
      'Victor verified goal achieved',
      `Goal: ${selection.goal.title}`,
      `Department: ${selection.target}`,
      `Evidence items: ${outcome.assessment.evidence.length}`,
    ].join('\n'));
  }

  return {
    status: outcome.verified
      ? (outcome.assessment.goalAchieved ? 'GOAL_ACHIEVED_VERIFIED' : 'GOAL_PROGRESS_VERIFIED')
      : 'SAFE_STOP',
    goalId: selection.goal.goal_id,
    target: selection.target,
    result: outcome,
  };
}

async function loadCanonicalRevenue(env) {
  const record = await readRepoJson(env, 'data/revenue_outcomes.json', {});
  const totals = record?.verified_totals || {};
  return {
    status: record?.status || 'NOT_VERIFIED',
    collected_revenue_inr: Number(totals.collected_revenue_inr) || 0,
    payments_received: Number(totals.payments_received) || 0,
  };
}

async function superviseGoal(selection, env, phase = 'EXECUTE') {
  const target = selection.target;
  const prompt = buildGoalTaskPrompt(selection.goal, phase, selection.runtimeGoal || {});
  let dispatch;
  let received;
  let verification;

  if (target === 'tony_stark') {
    if (!tonyBridgeConfigured(env)) throw new Error('TONY_BRIDGE_NOT_CONFIGURED');
    dispatch = await dispatchTonyTask(env, prompt, { messageId: 'goal-auto' });
    received = await waitForTonyResult(dispatch.taskId, env, { attempts: 30, delayMs: 5000 });
    verification = received.status === 'RESULT_RECEIVED' ? verifyTonyResult(received.result, dispatch.taskId) : { ok: false };
  } else if (target === 'rio') {
    if (!rioBridgeConfigured(env)) throw new Error('RIO_BRIDGE_NOT_CONFIGURED');
    dispatch = await dispatchRioTask(env, prompt, { messageId: 'goal-auto' });
    received = await waitForRioResult(dispatch.taskId, { attempts: 30, delayMs: 5000 });
    verification = received.status === 'RESULT_RECEIVED' ? verifyRioResult(received.result, dispatch.taskId) : { ok: false };
  } else if (target === 'aura3') {
    if (!aura3BridgeConfigured(env)) throw new Error('AURA3_BRIDGE_NOT_CONFIGURED');
    dispatch = await dispatchAura3Task(env, prompt, { messageId: 'goal-auto' });
    received = await waitForAura3Result(dispatch.taskId, { attempts: 30, delayMs: 5000 });
    verification = received.status === 'RESULT_RECEIVED' ? verifyAura3Result(received.result, dispatch.taskId) : { ok: false };
  } else {
    throw new Error(`UNSUPPORTED_GOAL_TARGET_${String(target || 'NONE').toUpperCase()}`);
  }

  const result = received.result || {};
  return {
    target,
    phase,
    taskId: dispatch.taskId,
    taskType: dispatch.taskType,
    verified: verification.ok === true,
    assessment: classifyAutonomyResult(result),
    evidenceReceived: received.status === 'RESULT_RECEIVED',
  };
}

async function sendFounder(env, text) {
  const response = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN_VICTOR}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: String(env.VICTOR_FOUNDER_CHAT_ID),
      text: String(text).slice(0, 4096),
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) throw new Error(`AUTONOMY_TELEGRAM_HTTP_${response.status}`);
}

export const AUTONOMY_CRONS = { SUPERVISION_CRON, DAILY_REPORT_CRON };
