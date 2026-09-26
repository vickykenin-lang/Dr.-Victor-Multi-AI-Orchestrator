import { classifyFounderIntent, FOUNDER_INTENT } from './founder_intent_gateway.mjs';
import { createSandboxSpec, evaluateSandboxBudget, buildSandboxEvidenceReceipt } from './sandbox_manager.mjs';
import { issueCapabilityLease } from './capability_broker.mjs';
import { evaluateWatchdog, watchdogOverridesVictor } from './safety_watchdog.mjs';

export function runShadowAutonomy({
  founder_text,
  objective_id,
  action_id,
  capability_id = 'sandbox.execute',
  active_target = null,
  founder_available = true,
  founder_approved = false,
  action_contract_authorized = false,
  budget_usage = {},
  watchdog_input = {},
  now_utc = new Date().toISOString(),
} = {}) {
  const intent = classifyFounderIntent(founder_text, { active_target });

  if (intent.intent === FOUNDER_INTENT.STOP_PAUSE) {
    return {
      mode: 'SHADOW',
      decision: 'SAFE_HOLD',
      intent,
      department_dispatch_allowed: false,
      production_apply_allowed: false,
      continuation_allowed: false,
      reason: 'FOUNDER_STOP_PAUSE',
    };
  }

  if (intent.intent !== FOUNDER_INTENT.EXECUTION_COMMAND) {
    return {
      mode: 'SHADOW',
      decision: 'NO_DISPATCH',
      intent,
      department_dispatch_allowed: false,
      production_apply_allowed: false,
      continuation_allowed: false,
      reason: 'NON_EXECUTION_INTENT',
    };
  }

  if (!objective_id || !action_id) {
    return {
      mode: 'SHADOW',
      decision: 'SAFE_HOLD',
      intent,
      department_dispatch_allowed: false,
      production_apply_allowed: false,
      continuation_allowed: false,
      reason: 'OBJECTIVE_ACTION_REQUIRED',
    };
  }

  const sandbox = createSandboxSpec({ objective_id, action_id });
  const budget = evaluateSandboxBudget({ spec: sandbox, usage: budget_usage });
  const watchdog = evaluateWatchdog({ ...watchdog_input, budget_result: budget });
  const effective = watchdogOverridesVictor('CONTINUE', watchdog);
  if (effective.effective_decision === 'SAFE_HOLD') {
    const sandbox_receipt = budget.safe_hold === true
      ? buildSandboxEvidenceReceipt({
          spec: sandbox,
          status: 'SAFE_HOLD_BUDGET_EXCEEDED',
          evidence_refs: (budget.exceeded || []).map(item => `budget:${item}`),
          notes: [budget.reason],
        })
      : null;
    return {
      mode: 'SHADOW',
      decision: 'SAFE_HOLD',
      intent,
      sandbox,
      budget,
      watchdog,
      sandbox_receipt,
      department_dispatch_allowed: false,
      production_apply_allowed: false,
      continuation_allowed: false,
      reason: budget.safe_hold === true ? 'RESOURCE_BUDGET_SAFE_HOLD' : 'WATCHDOG_SAFE_HOLD',
    };
  }

  const lease = issueCapabilityLease({
    actor: 'victor',
    capability_id,
    objective_id,
    action_id,
    action_contract_authorized,
    founder_approved,
    emergency_pause: false,
    now_utc,
  });

  if (!lease.issued) {
    const redFounderWait = lease?.security?.zone === 'RED' && founder_available !== true;
    return {
      mode: 'SHADOW',
      decision: 'SAFE_HOLD',
      intent,
      sandbox,
      budget,
      lease,
      department_dispatch_allowed: false,
      production_apply_allowed: false,
      continuation_allowed: false,
      reason: redFounderWait ? 'FOUNDER_UNAVAILABLE_RED_BOUNDARY' : `CAPABILITY_DENIED:${lease.reason}`,
    };
  }

  const sandbox_receipt = buildSandboxEvidenceReceipt({
    spec: sandbox,
    status: 'READY_FOR_SANDBOX_EXECUTION',
    evidence_refs: [],
  });

  return {
    mode: 'SHADOW',
    decision: 'SANDBOX_EXECUTION_AUTHORIZED',
    intent,
    sandbox,
    budget,
    lease,
    sandbox_receipt,
    department_dispatch_allowed: true,
    production_apply_allowed: false,
    continuation_allowed: true,
    reason: 'SHADOW_ONLY_NO_PRODUCTION_PROMOTION',
  };
}
