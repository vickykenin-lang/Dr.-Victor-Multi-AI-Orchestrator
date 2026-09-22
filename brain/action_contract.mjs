const PHASES = new Set([
  'DIAGNOSE',
  'PLAN',
  'CORRECTIVE_EXECUTE',
  'COMMERCIAL_EXECUTE',
  'VERIFY',
  'MONITOR',
]);

const TARGETS = new Set(['tony_stark', 'rio', 'aura3', 'hulk', 'internal']);

const DEFAULT_FOUNDER_GATES = [
  'CREDENTIAL_OR_ACCOUNT_IDENTITY_ADMINISTRATION',
  'SPEND_ABOVE_EXPLICIT_CONFIGURED_BUDGET_CEILING',
  'IRREVERSIBLE_HIGH_IMPACT_EXTERNAL_COMMITMENT',
  'UNRESOLVED_LEGAL_OR_SECURITY_JUDGMENT',
  'FOUNDER_PAUSE_OR_OBJECTIVE_CHANGE',
  'VERIFIED_OBJECTIVE_IMPOSSIBILITY_REQUIRING_FOUNDER_DECISION',
];

const PHASE_ACTIONS = {
  DIAGNOSE: ['READ_REPOSITORY', 'ANALYZE', 'RETURN_EVIDENCE'],
  PLAN: ['READ_REPOSITORY', 'ANALYZE', 'PROPOSE_PLAN', 'RETURN_EVIDENCE'],
  CORRECTIVE_EXECUTE: [
    'READ_REPOSITORY',
    'ANALYZE',
    'PROPOSE_OR_APPLY_CODE_CHANGE_SUBJECT_TO_AUTHORITY',
    'RUN_TESTS',
    'RETURN_EVIDENCE',
  ],
  COMMERCIAL_EXECUTE: [
    'READ_REPOSITORY',
    'ANALYZE',
    'EXECUTE_GOVERNED_BUSINESS_ACTION',
    'COLLECT_EVIDENCE',
    'RETURN_EVIDENCE',
  ],
  VERIFY: ['VERIFY_RESULT', 'COLLECT_EVIDENCE', 'RETURN_EVIDENCE'],
  MONITOR: ['COLLECT_EVIDENCE', 'RETURN_EVIDENCE'],
};

const EXPECTED_PROGRESS = {
  DIAGNOSE: ['ROOT_CAUSE_ADVANCED', 'HYPOTHESIS_CONFIRMED_OR_REJECTED', 'MATERIAL_NEW_EVIDENCE'],
  PLAN: ['EXECUTABLE_PLAN_CREATED', 'BLOCKER_REMOVAL_PATH_IDENTIFIED'],
  CORRECTIVE_EXECUTE: ['CORRECTIVE_CHANGE_APPLIED', 'TEST_RESULT_CHANGED', 'BLOCKER_REMOVED'],
  COMMERCIAL_EXECUTE: ['COMMERCIAL_ACTION_COMPLETED', 'FUNNEL_STATE_ADVANCED', 'EXTERNAL_OUTCOME_OBSERVED'],
  VERIFY: ['VERIFIED_STATE_TRANSITION', 'OUTCOME_VERIFIED'],
  MONITOR: ['MATERIAL_NEW_EVIDENCE'],
};

const EXIT_CRITERIA = {
  DIAGNOSE: ['ROOT_CAUSE_OR_BOUNDED_HYPOTHESES_RETURNED', 'FRESH_EVIDENCE_RETURNED'],
  PLAN: ['EXECUTABLE_NEXT_ACTION_IDENTIFIED', 'AUTHORITY_AND_EVIDENCE_REQUIREMENTS_EXPLICIT'],
  CORRECTIVE_EXECUTE: ['AUTHORIZED_CORRECTIVE_ACTION_ATTEMPTED', 'TEST_OR_VERIFICATION_EVIDENCE_RETURNED'],
  COMMERCIAL_EXECUTE: ['POLICY_VALID_COMMERCIAL_ACTION_ATTEMPTED', 'EXTERNAL_OR_FUNNEL_EVIDENCE_RETURNED'],
  VERIFY: ['EXPECTED_RESULT_CHECKED', 'VERIFICATION_EVIDENCE_RETURNED'],
  MONITOR: ['FRESH_OBSERVATION_RETURNED'],
};

function norm(value) {
  return String(value || '').trim();
}

function upper(value) {
  return norm(value).toUpperCase();
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

export function resolveActionPhase({ target, runtimePhase = 'EXECUTE', runtimeGoal = {} } = {}) {
  const resolvedTarget = norm(target).toLowerCase();
  const requested = upper(runtimePhase);
  const priorStatus = upper(runtimeGoal?.last_status);
  const priorMode = upper(runtimeGoal?.brain_required_mode);
  const priorRequiredNextMode = upper(runtimeGoal?.brain_review?.required_next_mode);

  if (requested === 'FIVE_WHYS_DIAGNOSIS' || priorMode === 'FIVE_WHYS_BEFORE_NEXT_DISPATCH') {
    return 'DIAGNOSE';
  }
  if (requested === 'VERIFY') return 'VERIFY';
  if (requested === 'MONITOR') return 'MONITOR';

  if (resolvedTarget === 'tony_stark') {
    const correctiveContinuation = requested === 'REPLAN_EXECUTE'
      || priorStatus === 'FIVE_WHYS_DIAGNOSIS_COMPLETED'
      || priorRequiredNextMode === 'NORMAL_REPLAN';
    return correctiveContinuation ? 'CORRECTIVE_EXECUTE' : 'PLAN';
  }

  if (resolvedTarget === 'rio') return 'COMMERCIAL_EXECUTE';
  if (resolvedTarget === 'aura3') return requested === 'REPLAN_EXECUTE' ? 'CORRECTIVE_EXECUTE' : 'PLAN';
  if (resolvedTarget === 'hulk') return 'DIAGNOSE';
  return 'PLAN';
}

export function buildActionContract({ goal = {}, target, runtimePhase = 'EXECUTE', runtimeGoal = {}, actionId = null } = {}) {
  const phase = resolveActionPhase({ target, runtimePhase, runtimeGoal });
  const resolvedTarget = norm(target).toLowerCase() || 'internal';
  const mutationAllowed = phase === 'CORRECTIVE_EXECUTE';
  const governedCommercial = phase === 'COMMERCIAL_EXECUTE' && resolvedTarget === 'rio';
  const authorityLevel = mutationAllowed ? 'L2' : (governedCommercial ? 'GOVERNED_PRODUCTION' : 'L1');

  return {
    contract_version: 1,
    objective_id: goal?.goal_id || null,
    action_id: actionId || `${goal?.goal_id || 'objective'}:${resolvedTarget}:${phase}`,
    phase,
    target: resolvedTarget,
    requested_actions: [...(PHASE_ACTIONS[phase] || [])],
    authority_level: authorityLevel,
    mutation_allowed: mutationAllowed,
    production_allowed: governedCommercial,
    public_action_allowed: governedCommercial,
    spend_allowed: false,
    expected_progress_delta: [...(EXPECTED_PROGRESS[phase] || [])],
    exit_criteria: [...(EXIT_CRITERIA[phase] || [])],
    founder_gate_if: unique([
      ...(Array.isArray(goal?.founder_gate) ? goal.founder_gate : []),
      ...DEFAULT_FOUNDER_GATES,
    ]),
    hard_boundaries: unique(Array.isArray(goal?.hard_boundaries) ? goal.hard_boundaries : []),
    source_runtime_phase: upper(runtimePhase) || 'EXECUTE',
  };
}

export function validateActionContract(contract = {}, goal = {}) {
  const errors = [];
  const phase = upper(contract.phase);
  const target = norm(contract.target).toLowerCase();
  const actions = Array.isArray(contract.requested_actions) ? contract.requested_actions : [];
  const allowedDepartments = Array.isArray(goal?.allowed_departments) ? goal.allowed_departments : [];

  if (Number(contract.contract_version) !== 1) errors.push('CONTRACT_VERSION_UNSUPPORTED');
  if (!contract.objective_id) errors.push('OBJECTIVE_ID_REQUIRED');
  if (!PHASES.has(phase)) errors.push('PHASE_INVALID');
  if (!TARGETS.has(target)) errors.push('TARGET_INVALID');
  if (goal?.goal_id && contract.objective_id !== goal.goal_id) errors.push('OBJECTIVE_ID_MISMATCH');
  if (allowedDepartments.length && !allowedDepartments.includes(target)) errors.push('TARGET_NOT_ALLOWED_BY_GOAL');
  if (!actions.length) errors.push('REQUESTED_ACTIONS_REQUIRED');
  if (!Array.isArray(contract.expected_progress_delta) || !contract.expected_progress_delta.length) errors.push('EXPECTED_PROGRESS_DELTA_REQUIRED');
  if (!Array.isArray(contract.exit_criteria) || !contract.exit_criteria.length) errors.push('EXIT_CRITERIA_REQUIRED');
  if (!Array.isArray(contract.founder_gate_if) || !contract.founder_gate_if.length) errors.push('FOUNDER_GATE_REQUIRED');

  const canonicalActions = PHASE_ACTIONS[phase] || [];
  for (const action of actions) {
    if (!canonicalActions.includes(action)) errors.push(`ACTION_NOT_ALLOWED_FOR_PHASE:${action}`);
  }

  if (phase === 'CORRECTIVE_EXECUTE') {
    if (contract.mutation_allowed !== true) errors.push('CORRECTIVE_EXECUTE_REQUIRES_MUTATION_ALLOWED');
    if (!actions.includes('PROPOSE_OR_APPLY_CODE_CHANGE_SUBJECT_TO_AUTHORITY')) errors.push('CORRECTIVE_EXECUTE_REQUIRES_CHANGE_ACTION');
    if (!actions.includes('RUN_TESTS')) errors.push('CORRECTIVE_EXECUTE_REQUIRES_TESTS');
    if (contract.production_allowed === true) errors.push('CORRECTIVE_EXECUTE_PRODUCTION_MUST_BE_FALSE');
    if (contract.public_action_allowed === true) errors.push('CORRECTIVE_EXECUTE_PUBLIC_ACTION_MUST_BE_FALSE');
    if (contract.spend_allowed === true) errors.push('CORRECTIVE_EXECUTE_SPEND_MUST_BE_FALSE');
  } else if (contract.mutation_allowed === true) {
    errors.push('MUTATION_NOT_ALLOWED_FOR_PHASE');
  }

  if (phase === 'COMMERCIAL_EXECUTE') {
    if (target !== 'rio') errors.push('COMMERCIAL_EXECUTE_TARGET_MUST_BE_RIO');
    if (contract.spend_allowed === true) errors.push('UNLOCKED_SPEND_PROHIBITED');
  } else {
    if (contract.production_allowed === true) errors.push('PRODUCTION_NOT_ALLOWED_FOR_PHASE');
    if (contract.public_action_allowed === true) errors.push('PUBLIC_ACTION_NOT_ALLOWED_FOR_PHASE');
  }

  if (actions.some(action => /CREDENTIAL|SECRET|ROTATE|REVOKE|DELETE_ACCOUNT/i.test(String(action)))) {
    errors.push('CREDENTIAL_OR_IDENTITY_ACTION_PROHIBITED');
  }

  return {
    ok: errors.length === 0,
    errors,
    contract,
  };
}

export function summarizeActionContract(contract = {}) {
  return [
    `Action Contract V${contract.contract_version || '?'}`,
    `Phase: ${contract.phase || 'UNKNOWN'}`,
    `Target: ${contract.target || 'UNKNOWN'}`,
    `Authority: ${contract.authority_level || 'UNKNOWN'}`,
    `Mutation: ${contract.mutation_allowed === true ? 'YES' : 'NO'}`,
    `Production: ${contract.production_allowed === true ? 'YES' : 'NO'}`,
    `Public action: ${contract.public_action_allowed === true ? 'YES' : 'NO'}`,
    `Spend: ${contract.spend_allowed === true ? 'YES' : 'NO'}`,
    `Requested actions: ${(contract.requested_actions || []).join(', ') || 'NONE'}`,
    `Expected progress: ${(contract.expected_progress_delta || []).join(', ') || 'NONE'}`,
  ].join('\n');
}
