function norm(value) {
  return String(value || '').trim();
}

function upper(value) {
  return norm(value).toUpperCase();
}

function stableList(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(v => upper(v)).filter(Boolean))].sort();
}

export function buildStrategyFingerprint(actionContract = {}) {
  return [
    norm(actionContract.target).toLowerCase(),
    upper(actionContract.phase),
    upper(actionContract.authority_level),
    actionContract.mutation_allowed === true ? 'M1' : 'M0',
    actionContract.production_allowed === true ? 'P1' : 'P0',
    stableList(actionContract.requested_actions).join(','),
  ].join('|');
}

function explicitProgressDelta(result = {}, strict = {}) {
  const candidate = strict.progress_delta || result.progress_delta || null;
  if (!candidate || typeof candidate !== 'object') return null;
  const rawTypes = Array.isArray(candidate.types) ? candidate.types : (candidate.type ? [candidate.type] : []);
  const types = stableList(rawTypes);
  const evidence = Array.isArray(candidate.evidence) ? candidate.evidence.filter(Boolean) : [];
  return {
    material: candidate.material === true && types.length > 0,
    types,
    evidence,
    source: 'EXPLICIT_DEPARTMENT_DELTA',
    detail: candidate.detail || null,
  };
}

function resultSignals(result = {}, assessment = {}) {
  const strict = result?.strict_supervision || {};
  const status = upper(assessment.status || strict.status || result.execution_status);
  const nextAction = upper(assessment.nextAction || strict.next_action);
  const rootCause = norm(assessment.rootCause || strict.root_cause || result.root_cause);
  const finalOutcome = assessment.finalOutcome || strict.final_outcome || result.final_outcome || null;
  const outcomeProgress = assessment.outcomeProgress || strict.outcome_progress || result.outcome_progress || null;
  return { strict, status, nextAction, rootCause, finalOutcome, outcomeProgress };
}

function materiallyDifferentText(current, previous) {
  const now = upper(current);
  const before = upper(previous);
  return Boolean(now) && now !== before;
}

export function evaluateProgressDelta({ previousGoal = {}, actionContract = {}, outcome = {}, rawResult = {} } = {}) {
  const assessment = outcome.assessment || {};
  const { strict, status, nextAction, rootCause, finalOutcome, outcomeProgress } = resultSignals(rawResult, assessment);
  const phase = upper(actionContract.phase || outcome.actionContract?.phase);
  const evidence = Array.isArray(assessment.evidence) ? assessment.evidence.filter(Boolean) : [];

  if (outcome.verified !== true) {
    return {
      material: false,
      types: ['EXECUTION_UNVERIFIED'],
      evidence: [],
      source: 'VERIFIER',
      reason: 'DEPARTMENT_RESULT_NOT_VERIFIED',
    };
  }

  if (assessment.goalAchieved === true) {
    return {
      material: true,
      types: ['OUTCOME_VERIFIED'],
      evidence,
      source: 'GOAL_VERIFIER',
      reason: 'GOAL_SUCCESS_CONDITIONS_VERIFIED',
    };
  }

  const explicit = explicitProgressDelta(rawResult, strict);
  if (explicit) {
    if (explicit.material && explicit.evidence.length === 0 && evidence.length === 0) {
      return { ...explicit, material: false, reason: 'EXPLICIT_DELTA_WITHOUT_EVIDENCE' };
    }
    return explicit;
  }

  const types = [];
  const source = 'DETERMINISTIC_INFERENCE';
  let reason = null;

  if (assessment.founderGate === true) {
    const changedGate = previousGoal.state !== 'FOUNDER_ONLY_BLOCKER'
      || materiallyDifferentText(nextAction, previousGoal.last_next_action);
    if (changedGate) types.push('FOUNDER_BOUNDARY_VERIFIED');
  }

  if (assessment.hasBlocker === true) {
    const blockerChanged = previousGoal.state !== 'BLOCKED_RETRYABLE'
      || (rootCause && materiallyDifferentText(rootCause, previousGoal.last_root_cause))
      || materiallyDifferentText(nextAction, previousGoal.last_next_action);
    if (blockerChanged) types.push('BLOCKER_IDENTIFIED');
  }

  if (phase === 'DIAGNOSE') {
    if (rootCause && materiallyDifferentText(rootCause, previousGoal.last_root_cause)) {
      types.push('ROOT_CAUSE_ADVANCED');
    }
    const whyChain = strict.why_chain || rawResult.why_chain;
    if (Array.isArray(whyChain) && whyChain.some(item => upper(item?.status) === 'VERIFIED')) {
      types.push('HYPOTHESIS_CONFIRMED_OR_REJECTED');
    }
    if (!types.length) reason = 'DIAGNOSIS_RETURNED_NO_NEW_CAUSAL_STATE';
  } else if (phase === 'PLAN') {
    if (materiallyDifferentText(nextAction, previousGoal.last_next_action)
      && !/REVIEW|AUDIT|PLAN|AUTHORIZE/.test(nextAction)) {
      types.push('BLOCKER_REMOVAL_PATH_IDENTIFIED');
    }
    if (!types.length) reason = 'PLAN_DID_NOT_CREATE_MATERIALLY_DIFFERENT_EXECUTABLE_PATH';
  } else if (phase === 'CORRECTIVE_EXECUTE') {
    const repairExecuted = rawResult.repair_executed === true
      || strict.repair_executed === true
      || rawResult.code_change_applied === true
      || strict.code_change_applied === true;
    const changedFiles = strict.changed_files || rawResult.changed_files || rawResult.files_changed || [];
    const tests = strict.test_results || rawResult.test_results || null;
    const readOnly = /READ[_ -]?ONLY|AUDIT_COMPLETED|DIAGNOSIS_COMPLETED|PLAN_READY/.test(status);
    if (repairExecuted || (Array.isArray(changedFiles) && changedFiles.length > 0)) types.push('CORRECTIVE_CHANGE_APPLIED');
    if (tests && !/NOT_RUN|UNVERIFIED|UNKNOWN/.test(upper(typeof tests === 'string' ? tests : JSON.stringify(tests)))) {
      types.push('TEST_RESULT_CHANGED');
    }
    if (/BLOCKER_REMOVED|RECOVERY_VERIFIED|REPAIRED|FIXED|IMPLEMENTED/.test(status) && !readOnly) {
      types.push('BLOCKER_REMOVED');
    }
    if (readOnly) {
      reason = 'CORRECTIVE_EXECUTE_DEGRADED_TO_READ_ONLY_ACTIVITY';
      types.length = 0;
    } else if (!types.length) {
      reason = 'CORRECTIVE_EXECUTE_RETURNED_NO_PROOF_OF_CHANGE_OR_RECOVERY';
    }
  } else if (phase === 'COMMERCIAL_EXECUTE') {
    const governedCycle = rawResult.governed_business_cycle_performed === true;
    const publicAction = rawResult.public_action_performed === true;
    const commercialStatus = /PUBLISHED|POSTED|CLICK|LEAD|CONVERSION|COMMISSION|PAYMENT|COMMERCIAL_ACTION/.test(status);
    const structuredProgress = outcomeProgress && typeof outcomeProgress === 'object'
      ? JSON.stringify(outcomeProgress)
      : norm(outcomeProgress);
    if (governedCycle || publicAction || commercialStatus) types.push('COMMERCIAL_ACTION_COMPLETED');
    if (structuredProgress && materiallyDifferentText(structuredProgress, previousGoal.last_outcome_progress_fingerprint)) {
      types.push('FUNNEL_STATE_ADVANCED');
    }
    if (finalOutcome?.verified === true && Array.isArray(finalOutcome.evidence) && finalOutcome.evidence.length > 0) {
      types.push('EXTERNAL_OUTCOME_OBSERVED');
    }
    if (!types.length) reason = 'COMMERCIAL_EXECUTE_RETURNED_NO_MATERIAL_FUNNEL_OR_EXTERNAL_DELTA';
  } else if (phase === 'VERIFY') {
    if (/VERIFIED|PASS|RECOVERY|HEALTHY/.test(status) && !/NOT_VERIFIED|FAILED|BLOCKED/.test(status)) {
      types.push('VERIFIED_STATE_TRANSITION');
    }
    if (finalOutcome?.verified === true) types.push('OUTCOME_VERIFIED');
    if (!types.length) reason = 'VERIFY_RETURNED_NO_VERIFIED_STATE_TRANSITION';
  } else if (phase === 'MONITOR') {
    if (strict.material_observation === true || rawResult.material_observation === true) {
      types.push('MATERIAL_NEW_EVIDENCE');
    }
    if (!types.length) reason = 'MONITOR_RETURNED_NO_MATERIAL_OBSERVATION';
  }

  return {
    material: types.length > 0,
    types: stableList(types),
    evidence: types.length ? evidence : [],
    source,
    reason: types.length ? null : (reason || 'NO_MATERIAL_PROGRESS_PREDICATE_MET'),
  };
}

export function nextConvergenceState({ previousGoal = {}, progressDelta = {}, strategyFingerprint = '', actionContract = {} } = {}) {
  const wasNoProgress = Number(previousGoal.no_progress_count || 0);
  const previousStalled = norm(previousGoal.stalled_strategy_fingerprint);
  const phase = upper(actionContract.phase);

  if (progressDelta.material === true) {
    const diagnosticRecovery = phase === 'DIAGNOSE' && Boolean(previousStalled);
    return {
      no_progress_count: 0,
      stalled_strategy_fingerprint: diagnosticRecovery ? previousStalled : null,
      recovery_generation: diagnosticRecovery
        ? Number(previousGoal.recovery_generation || 0) + 1
        : Number(previousGoal.recovery_generation || 0),
      must_change_strategy: diagnosticRecovery,
    };
  }

  const nextNoProgress = wasNoProgress + 1;
  return {
    no_progress_count: nextNoProgress,
    stalled_strategy_fingerprint: previousStalled || strategyFingerprint || null,
    recovery_generation: Number(previousGoal.recovery_generation || 0),
    must_change_strategy: nextNoProgress >= 2 || Boolean(previousGoal.must_change_strategy),
  };
}

export function validateStrategyChange({ previousGoal = {}, actionContract = {} } = {}) {
  const currentFingerprint = buildStrategyFingerprint(actionContract);
  const stalled = norm(previousGoal.stalled_strategy_fingerprint);
  const mustChange = previousGoal.must_change_strategy === true;
  if (mustChange && stalled && currentFingerprint === stalled) {
    return {
      ok: false,
      code: 'STALLED_STRATEGY_REUSE_BLOCKED',
      current_fingerprint: currentFingerprint,
      stalled_fingerprint: stalled,
    };
  }
  return {
    ok: true,
    code: null,
    current_fingerprint: currentFingerprint,
    stalled_fingerprint: stalled || null,
  };
}
