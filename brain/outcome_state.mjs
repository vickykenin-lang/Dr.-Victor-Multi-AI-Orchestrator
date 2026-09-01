export const OUTCOME_STAGE = Object.freeze({
  TASK_SENT: 'TASK_SENT',
  WORK_PERFORMED: 'WORK_PERFORMED',
  RESULT_VERIFIED: 'RESULT_VERIFIED',
  OBJECTIVE_ACHIEVED: 'OBJECTIVE_ACHIEVED',
  FOUNDER_ONLY_BLOCKER: 'FOUNDER_ONLY_BLOCKER',
  EXECUTION_UNVERIFIED: 'EXECUTION_UNVERIFIED',
});

const FOUNDER_BOUNDARY = /(?:ADD|CREATE|PROVISION|REPLACE|ROTATE|REVOKE|EXPAND).{0,40}(?:CREDENTIAL|SECRET|ACCOUNT IDENTITY)|(?:CREDENTIAL|SECRET|ACCOUNT IDENTITY).{0,40}(?:ADD|CREATE|PROVISION|REPLACE|ROTATE|REVOKE|EXPAND)|SPEND.{0,30}(?:CEILING|LIMIT|APPROVAL)|IRREVERSIBLE|LEGAL.{0,30}(?:JUDGMENT|DECISION|APPROVAL)|SECURITY.{0,30}(?:JUDGMENT|DECISION|APPROVAL)|OBJECTIVE_IMPOSSIBLE|GOAL_IMPOSSIBLE|CHANGE_(?:GOAL|OBJECTIVE|SUCCESS_CRITERIA)|FOUNDER_(?:PAUSE|HOLD|GOAL_CHANGE_REQUIRED)/i;

function text(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(' | ') : String(value ?? '');
}

function evidenceOf(result = {}) {
  const strict = result?.strict_supervision || {};
  const finalOutcome = result?.final_outcome || strict?.final_outcome || {};
  const evidence = [
    ...(Array.isArray(strict.evidence) ? strict.evidence : []),
    ...(Array.isArray(finalOutcome.evidence) ? finalOutcome.evidence : []),
  ];
  return [...new Set(evidence.filter(Boolean).map(String))];
}

export function createOwnedOutcomeState({ target, founderRequest, taskId, previous = null } = {}) {
  const prior = previous && typeof previous === 'object' ? previous : {};
  return {
    schema_version: 1,
    target: target || prior.target || null,
    founder_request: String(founderRequest || prior.founder_request || '').trim(),
    stage: OUTCOME_STAGE.TASK_SENT,
    task_id: taskId || null,
    attempts: Math.max(1, Number(prior.attempts || 0) + 1),
    repeated_failure_count: Number(prior.repeated_failure_count || 0),
    last_failure_fingerprint: prior.last_failure_fingerprint || null,
    founder_boundary: false,
    objective_achieved: false,
    requires_follow_up: true,
    work_performed: false,
    result_verified: false,
    evidence: Array.isArray(prior.evidence) ? prior.evidence : [],
    last_status: 'TASK_DISPATCHED',
    last_next_action: null,
  };
}

export function assessVerifiedDepartmentResult(result = {}, priorState = {}) {
  const strict = result?.strict_supervision || {};
  const finalOutcome = result?.final_outcome || strict?.final_outcome || {};
  const evidence = evidenceOf(result);
  const status = String(strict.status || result.execution_status || 'UNKNOWN').toUpperCase();
  const blocker = strict.error_or_blocker ?? result.blockers ?? null;
  const nextAction = strict.next_action || result.next_valid_action || null;
  const boundaryText = [status, text(blocker), text(nextAction)].join(' ');
  const founderBoundary = FOUNDER_BOUNDARY.test(boundaryText);

  const objectiveAchieved = Boolean(
    (finalOutcome?.verified === true && finalOutcome?.objective_met === true && Array.isArray(finalOutcome.evidence) && finalOutcome.evidence.length > 0)
    || (/GOAL_ACHIEVED_VERIFIED|OBJECTIVE_MET_VERIFIED/.test(status) && evidence.length > 0)
  );

  const verified = result?.__victor_verified === true;
  const workPerformed = Boolean(
    result?.governed_business_cycle_performed === true
    || result?.public_action_performed === true
    || result?.changed_files?.length
    || result?.snapshot?.changed_files?.length
    || (!/READ_ONLY|REPORTING_CONNECTED|STATUS_CHECK/.test(String(result.execution_status || '').toUpperCase()) && evidence.length > 0)
  );

  let stage = OUTCOME_STAGE.EXECUTION_UNVERIFIED;
  if (workPerformed) stage = OUTCOME_STAGE.WORK_PERFORMED;
  if (verified) stage = OUTCOME_STAGE.RESULT_VERIFIED;
  if (founderBoundary) stage = OUTCOME_STAGE.FOUNDER_ONLY_BLOCKER;
  if (objectiveAchieved) stage = OUTCOME_STAGE.OBJECTIVE_ACHIEVED;

  const requiresFollowUp = objectiveAchieved
    ? false
    : founderBoundary
      ? false
      : strict.requires_follow_up === true;

  const failureFingerprint = blocker || nextAction
    ? [priorState?.target || result?.sender || 'unknown', status, text(blocker), text(nextAction)].filter(Boolean).join('|').slice(0, 500)
    : null;
  const repeatedFailureCount = failureFingerprint && failureFingerprint === priorState?.last_failure_fingerprint
    ? Number(priorState?.repeated_failure_count || 0) + 1
    : (failureFingerprint ? 1 : 0);

  return {
    ...priorState,
    stage,
    founder_boundary: founderBoundary,
    objective_achieved: objectiveAchieved,
    requires_follow_up: requiresFollowUp,
    work_performed: workPerformed,
    result_verified: verified,
    evidence: [...new Set([...(priorState?.evidence || []), ...evidence])].slice(-100),
    last_status: status,
    last_next_action: nextAction,
    last_blocker: blocker,
    last_failure_fingerprint: failureFingerprint,
    repeated_failure_count: repeatedFailureCount,
  };
}

export function shouldContinueOwnedRecovery(state = {}, maxAttempts = 3) {
  return Boolean(
    state.stage !== OUTCOME_STAGE.OBJECTIVE_ACHIEVED
    && state.stage !== OUTCOME_STAGE.FOUNDER_ONLY_BLOCKER
    && state.result_verified === true
    && state.requires_follow_up === true
    && Number(state.attempts || 0) < maxAttempts
  );
}

export function buildOwnedRecoveryDirective(state = {}) {
  const repeated = Number(state.repeated_failure_count || 0) >= 2;
  const lines = [
    'VICTOR OWNED OUTCOME CONTINUATION',
    `Current stage: ${state.stage || 'UNKNOWN'}`,
    `Attempt: ${Number(state.attempts || 0) + 1}`,
    state.last_status ? `Last verified status: ${state.last_status}` : null,
    state.last_blocker ? `Last blocker: ${text(state.last_blocker)}` : null,
    state.last_next_action ? `Last next action: ${text(state.last_next_action)}` : null,
    repeated
      ? 'REPEATED FAILURE MODE: Do not repeat the same action. Run evidence-backed Five Whys, identify the best-supported controllable root cause, then change the route/strategy or corrective action.'
      : 'Continue from the verified result. Execute the next corrective action; do not stop at diagnosis or recommendation.',
    'Return fresh evidence and set requires_follow_up=true if the Founder-requested outcome is still not verified and no Founder-only boundary exists.',
  ].filter(Boolean);
  return lines.join('\n');
}
