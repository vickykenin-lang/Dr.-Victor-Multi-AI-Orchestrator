import {
  OUTCOME_STAGE,
  createOwnedOutcomeState,
  assessVerifiedDepartmentResult,
  shouldContinueOwnedRecovery,
  buildOwnedRecoveryDirective,
} from './outcome_state.mjs';

function assertFixture(fixture, label) {
  if (!fixture || typeof fixture !== 'object') throw new Error(`${label}_FIXTURE_REQUIRED`);
  return fixture;
}

export function runOwnedOutcomeAcceptanceTrace({
  target,
  founderRequest,
  initialTaskId = 'acceptance-attempt-1',
  results = [],
  maxAttempts = 3,
} = {}) {
  if (!target) throw new Error('TARGET_REQUIRED');
  if (!String(founderRequest || '').trim()) throw new Error('FOUNDER_REQUEST_REQUIRED');
  if (!Array.isArray(results) || results.length === 0) throw new Error('RESULT_FIXTURES_REQUIRED');

  let state = createOwnedOutcomeState({ target, founderRequest, taskId: initialTaskId });
  const trace = [{
    event: 'DISPATCH',
    attempt: state.attempts,
    task_id: state.task_id,
    stage: state.stage,
  }];

  for (let index = 0; index < results.length; index += 1) {
    const fixture = assertFixture(results[index], `RESULT_${index + 1}`);
    state = assessVerifiedDepartmentResult(fixture, state);
    trace.push({
      event: 'VERIFIED_RESULT',
      attempt: state.attempts,
      stage: state.stage,
      founder_boundary: state.founder_boundary,
      objective_achieved: state.objective_achieved,
      requires_follow_up: state.requires_follow_up,
      repeated_failure_count: state.repeated_failure_count,
      external_outcome_verified: state.external_outcome_verified === true,
    });

    if (state.stage === OUTCOME_STAGE.OBJECTIVE_ACHIEVED || state.stage === OUTCOME_STAGE.FOUNDER_ONLY_BLOCKER) break;

    if (!shouldContinueOwnedRecovery(state, maxAttempts)) {
      trace.push({
        event: 'STOP_UNVERIFIED',
        attempt: state.attempts,
        stage: state.stage,
        reason: state.result_verified !== true
          ? 'RESULT_NOT_VERIFIED'
          : state.requires_follow_up !== true
            ? 'FOLLOW_UP_NOT_REQUIRED'
            : 'MAX_ATTEMPTS_REACHED',
      });
      break;
    }

    const directive = buildOwnedRecoveryDirective(state);
    trace.push({
      event: 'RECOVERY_REPLAN',
      attempt: state.attempts + 1,
      five_whys: /Five Whys/i.test(directive),
      change_route: /change the route\/strategy/i.test(directive),
      external_proof_required: /External outcome proof is still missing/i.test(directive),
      directive,
    });

    state = createOwnedOutcomeState({
      target,
      founderRequest,
      taskId: `acceptance-attempt-${state.attempts + 1}`,
      previous: state,
    });
    trace.push({
      event: 'DISPATCH',
      attempt: state.attempts,
      task_id: state.task_id,
      stage: state.stage,
    });
  }

  return {
    final_state: state,
    trace,
    achieved: state.stage === OUTCOME_STAGE.OBJECTIVE_ACHIEVED,
    founder_only_blocker: state.stage === OUTCOME_STAGE.FOUNDER_ONLY_BLOCKER,
    attempts: Number(state.attempts || 0),
  };
}
