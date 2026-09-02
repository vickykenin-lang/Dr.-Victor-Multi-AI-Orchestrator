const SUPPORTED = new Set(['rio', 'tony_stark', 'aura3']);

function unique(values = []) { return [...new Set(values.filter(Boolean))]; }

export function buildExecutionPlan(founderRequest = {}) {
  const entities = unique(founderRequest?.entities || []);
  const actions = unique(founderRequest?.requested_actions || []);
  const actionableTargets = entities.filter(x => SUPPORTED.has(x));
  const unsupportedTargets = entities.filter(x => !SUPPORTED.has(x));
  const requiresAction = actions.length > 0;
  const crossDepartment = requiresAction && actionableTargets.length > 1;

  return {
    version: 'VICTOR_EXECUTION_PLAN_V1',
    mode: crossDepartment ? 'CROSS_DEPARTMENT_ACTION' : (requiresAction && actionableTargets.length === 1 ? 'SINGLE_DEPARTMENT_ACTION' : 'NO_DETERMINISTIC_ACTION'),
    requested_outcome: founderRequest?.success_condition || 'FOUNDER_INTENT_SATISFIED',
    cross_department: crossDepartment,
    actions,
    steps: actionableTargets.map((target, index) => ({
      step_id: `step-${index + 1}`,
      target,
      requested_actions: actions,
      founder_text: founderRequest?.raw_text || '',
      status: 'PLANNED',
      verification_required: true,
    })),
    unsupported_targets: unsupportedTargets,
    founder_boundary: founderRequest?.founder_boundary || null,
  };
}

export function shouldExecuteCrossDepartment(plan = {}) {
  return plan?.mode === 'CROSS_DEPARTMENT_ACTION' && Array.isArray(plan?.steps) && plan.steps.length > 1 && !plan?.founder_boundary;
}
