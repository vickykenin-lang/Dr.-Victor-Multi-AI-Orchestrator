import { attachResultTruth } from './result_truth_receipts.mjs';

export const OUTCOME_STAGE = Object.freeze({
  TASK_SENT: 'TASK_SENT',
  WORK_PERFORMED: 'WORK_PERFORMED',
  RESULT_VERIFIED: 'RESULT_VERIFIED',
  OBJECTIVE_ACHIEVED: 'OBJECTIVE_ACHIEVED',
  FOUNDER_ONLY_BLOCKER: 'FOUNDER_ONLY_BLOCKER',
  EXECUTION_UNVERIFIED: 'EXECUTION_UNVERIFIED',
});

const FOUNDER_BOUNDARY = /(?:ADD|CREATE|PROVISION|REPLACE|ROTATE|REVOKE|EXPAND).{0,40}(?:CREDENTIAL|SECRET|ACCOUNT IDENTITY)|(?:CREDENTIAL|SECRET|ACCOUNT IDENTITY).{0,40}(?:ADD|CREATE|PROVISION|REPLACE|ROTATE|REVOKE|EXPAND)|SPEND.{0,30}(?:CEILING|LIMIT|APPROVAL)|IRREVERSIBLE|LEGAL.{0,30}(?:JUDGMENT|DECISION|APPROVAL)|SECURITY.{0,30}(?:JUDGMENT|DECISION|APPROVAL)|OBJECTIVE_IMPOSSIBLE|GOAL_IMPOSSIBLE|CHANGE_(?:GOAL|OBJECTIVE|SUCCESS_CRITERIA)|FOUNDER_(?:PAUSE|HOLD|GOAL_CHANGE_REQUIRED)/i;
const EXTERNAL_OUTCOME_INTENT = /\b(?:publish|published|post(?:ed)?|instagram|meta|payment|paid|revenue|sale|order|transaction|permalink|live\s+external|external\s+platform)\b/i;

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

function hasResolvedExternalOutcome(result = {}, target = null) {
  const fact = `${target || result?.sender || 'unknown'}.external.objective_outcome`;
  const resolved = result?.resolved_truth?.facts?.[fact];
  return Boolean(
    resolved?.status === 'RESOLVED'
    && resolved?.selected?.source_class === 'EXTERNAL_RESULT'
    && resolved?.selected?.value?.verified === true
    && resolved?.selected?.value?.objective_met === true
    && Array.isArray(resolved?.selected?.value?.evidence)
    && resolved.selected.value.evidence.length > 0
  );
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
    truth_receipts: Array.isArray(prior.truth_receipts) ? prior.truth_receipts : [],
    resolved_truth: prior.resolved_truth || null,
    last_status: 'TASK_DISPATCHED',
    last_next_action: null,
  };
}

export function assessVerifiedDepartmentResult(result = {}, priorState = {}) {
  const truthAttached = attachResultTruth(result, {
    target: priorState?.target || result?.sender || null,
    taskId: result?.task_id || priorState?.task_id || null,
  });
  const strict = truthAttached?.strict_supervision || {};
  const finalOutcome = truthAttached?.final_outcome || strict?.final_outcome || {};
  const evidence = evidenceOf(truthAttached);
  const status = String(strict.status || truthAttached.execution_status || 'UNKNOWN').toUpperCase();
  const blocker = strict.error_or_blocker ?? truthAttached.blockers ?? null;
  const nextAction = strict.next_action || truthAttached.next_valid_action || null;
  const boundaryText = [status, text(blocker), text(nextAction)].join(' ');
  const founderBoundary = FOUNDER_BOUNDARY.test(boundaryText);
  const externalOutcomeRequired = EXTERNAL_OUTCOME_INTENT.test(String(priorState?.founder_request || ''));
  const externalOutcomeVerified = hasResolvedExternalOutcome(truthAttached, priorState?.target || truthAttached?.sender || null);
  const departmentOutcomeClaim = Boolean(
    (finalOutcome?.verified === true && finalOutcome?.objective_met === true && Array.isArray(finalOutcome.evidence) && finalOutcome.evidence.length > 0)
    || (/GOAL_ACHIEVED_VERIFIED|OBJECTIVE_MET_VERIFIED/.test(status) && evidence.length > 0)
  );
  const objectiveAchieved = externalOutcomeRequired ? externalOutcomeVerified : departmentOutcomeClaim;

  const verified = truthAttached?.__victor_verified === true;
  const workPerformed = Boolean(
    truthAttached?.governed_business_cycle_performed === true
    || truthAttached?.public_action_performed === true
    || truthAttached?.changed_files?.length
    || truthAttached?.snapshot?.changed_files?.length
    || (!/READ_ONLY|REPORTING_CONNECTED|STATUS_CHECK/.test(String(truthAttached.execution_status || '').toUpperCase()) && evidence.length > 0)
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
      : (externalOutcomeRequired && departmentOutcomeClaim ? true : strict.requires_follow_up === true);

  const failureFingerprint = blocker || nextAction
    ? [priorState?.target || truthAttached?.sender || 'unknown', status, text(blocker), text(nextAction)].filter(Boolean).join('|').slice(0, 500)
    : null;
  const repeatedFailureCount = failureFingerprint && failureFingerprint === priorState?.last_failure_fingerprint
    ? Number(priorState?.repeated_failure_count || 0) + 1
    : (failureFingerprint ? 1 : 0);

  return {
    ...priorState,
    stage,
    founder_boundary: founderBoundary,
    objective_achieved: objectiveAchieved,
    external_outcome_required: externalOutcomeRequired,
    external_outcome_verified: externalOutcomeVerified,
    requires_follow_up: requiresFollowUp,
    work_performed: workPerformed,
    result_verified: verified,
    evidence: [...new Set([...(priorState?.evidence || []), ...evidence])].slice(-100),
    truth_receipts: [...(Array.isArray(priorState?.truth_receipts) ? priorState.truth_receipts : []), ...(truthAttached.truth_receipts || [])].slice(-100),
    resolved_truth: truthAttached.resolved_truth || priorState?.resolved_truth || null,
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
    state.external_outcome_required && !state.external_outcome_verified ? 'External outcome proof is still missing; do not treat a department completion claim as the Founder outcome.' : null,
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
