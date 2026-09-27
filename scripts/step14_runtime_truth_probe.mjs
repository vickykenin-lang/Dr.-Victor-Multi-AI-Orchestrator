import { pathToFileURL } from 'node:url';
import { buildActionContract, validateActionContract } from '../brain/action_contract.mjs';
import { buildProcedureExecutionPlan } from '../brain/procedure_registry.mjs';

export function buildStep14RuntimeTruthProbe({ runId = 'local', observedAt = new Date().toISOString() } = {}) {
  const goal = {
    goal_id: `step14-control-room-${runId}`,
    allowed_departments: ['internal'],
    hard_boundaries: [
      'READ_ONLY_DIAGNOSTIC',
      'NO_PRODUCTION_ACTION',
      'NO_PUBLIC_ACTION',
      'NO_CREDENTIAL_ACTION',
      'NO_AUTHORITY_EXPANSION',
    ],
  };
  const contract = buildActionContract({
    goal,
    target: 'internal',
    runtimePhase: 'PLAN',
    actionId: `step14-runtime-truth-probe:${runId}`,
  });
  const validation = validateActionContract(contract, goal);
  const procedure = buildProcedureExecutionPlan({
    procedureId: 'founder-status-check-v1',
    trigger: 'founder-command',
  });

  const pass = validation.ok === true
    && contract.mutation_allowed === false
    && contract.production_allowed === false
    && contract.public_action_allowed === false
    && contract.spend_allowed === false
    && procedure.ok === true
    && procedure.execution_allowed === true
    && procedure.reason === 'VERIFIED_PROCEDURE';

  return {
    schema_version: 1,
    evidence_type: 'VICTOR_STEP14_RUNTIME_TRUTH_PROBE',
    observed_at_utc: observedAt,
    status: pass ? 'PASS' : 'FAIL',
    action_contract: {
      instance_verified: validation.ok === true,
      contract_version: contract.contract_version,
      objective_id: contract.objective_id,
      action_id: contract.action_id,
      phase: contract.phase,
      target: contract.target,
      authority_level: contract.authority_level,
      mutation_allowed: contract.mutation_allowed,
      production_allowed: contract.production_allowed,
      public_action_allowed: contract.public_action_allowed,
      spend_allowed: contract.spend_allowed,
      validation_errors: validation.errors,
    },
    procedure_use: {
      verified: procedure.ok === true && procedure.execution_allowed === true,
      procedure_id: procedure.procedure?.id || null,
      procedure_version: procedure.procedure?.version || null,
      reason: procedure.reason,
      trigger: procedure.procedure?.allowed_trigger || null,
      steps: procedure.steps || [],
      llm_required: procedure.llm_required,
    },
    boundaries: {
      diagnostic_only: true,
      production_action_performed: false,
      public_action_performed: false,
      credential_action_performed: false,
      authority_expanded: false,
      commercial_outcome_upgraded: false,
      secrets_exposed: false,
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const receipt = buildStep14RuntimeTruthProbe({ runId: process.env.GITHUB_RUN_ID || 'local' });
  console.log(JSON.stringify(receipt, null, 2));
  if (receipt.status !== 'PASS') process.exitCode = 1;
}
