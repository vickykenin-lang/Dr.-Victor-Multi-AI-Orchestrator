from pathlib import Path

p = Path('victor-telegram-worker/worker.js')
s = p.read_text()

def once(old, new, label):
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    s = s.replace(old, new, 1)

import_anchor = "import { readActiveFounderGuidance, shouldTreatAsFounderGuidanceAnswer, recordFounderGuidanceAnswer } from '../brain/founder_guidance.mjs';\n"
import_block = import_anchor + """import { classifyFounderIntent as classifyV2FounderIntent, FOUNDER_INTENT as V2_FOUNDER_INTENT } from '../brain/founder_intent_gateway.mjs';
import { evaluateSecurityRequest, SECURITY_POLICY_VERSION } from '../brain/security_kernel.mjs';
import { buildActionContract, validateActionContract } from '../brain/action_contract.mjs';
import { createSandboxSpec, validateSandboxSpec, SANDBOX_PROFILE_VERSION } from '../brain/sandbox_manager.mjs';
import { issueCapabilityLease, validateCapabilityLease, BROKER_VERSION } from '../brain/capability_broker.mjs';
import { evaluateWatchdog, WATCHDOG_VERSION } from '../brain/safety_watchdog.mjs';
import { PROMOTION_GATE_VERSION } from '../brain/promotion_gate.mjs';
import { ROLLBACK_CONTRACT_VERSION } from '../brain/rollback_contract.mjs';
"""
once(import_anchor, import_block, 'v2 imports')

health_anchor = "        governed_diagnostic_department_bridge: true,\n"
health_block = health_anchor + """        v2_runtime_wired: true,
        v2_founder_intent_gateway: 'DETERMINISTIC_STOP_PAUSE_V1',
        v2_security_kernel_policy: SECURITY_POLICY_VERSION,
        v2_action_contract: 'ACTION_CONTRACT_V1',
        v2_sandbox_profile: SANDBOX_PROFILE_VERSION,
        v2_capability_broker: BROKER_VERSION,
        v2_watchdog: WATCHDOG_VERSION,
        v2_promotion_gate: PROMOTION_GATE_VERSION,
        v2_rollback_contract: ROLLBACK_CONTRACT_VERSION,
        v2_production_autonomy_enabled: false,
        v2_live_sandbox_verified: false,
        v2_live_rollback_verified: false,
"""
once(health_anchor, health_block, 'health attestation')

post_anchor = "    if (request.method !== 'POST' || url.pathname !== '/telegram') return json({ error: 'not_found' }, 404);\n"
v2_endpoint = """    if (request.method === 'GET' && url.pathname === '/v2-health') {
      const stopTest = classifyV2FounderIntent('STOP Victor');
      const greenTest = evaluateSecurityRequest({ capability_id: 'evidence.read' });
      const redTest = evaluateSecurityRequest({ capability_id: 'credential.rotate', founder_approved: false });
      const sandbox = createSandboxSpec({ objective_id: 'V2-LIVE-SELFTEST', action_id: 'SANDBOX-SPEC' });
      const sandboxValidation = validateSandboxSpec(sandbox);
      const lease = issueCapabilityLease({ capability_id: 'sandbox.execute', objective_id: 'V2-LIVE-SELFTEST', action_id: 'LEASE', ttl_seconds: 60 });
      const leaseValidation = validateCapabilityLease(lease, { objective_id: 'V2-LIVE-SELFTEST', action_id: 'LEASE', capability_id: 'sandbox.execute' });
      const watchdog = evaluateWatchdog({ heartbeat_age_seconds: 0 });
      const ready = stopTest.intent === V2_FOUNDER_INTENT.STOP_PAUSE
        && greenTest.decision === 'ALLOW'
        && redTest.decision === 'DENY'
        && sandboxValidation.valid === true
        && lease.issued === true
        && leaseValidation.valid === true
        && watchdog.decision === 'CONTINUE_BOUNDED';
      return json({
        service: 'victor-v2-runtime',
        status: ready ? 'READY' : 'SAFE_STOP',
        runtime_wired: true,
        founder_stop_precedence: stopTest.intent === V2_FOUNDER_INTENT.STOP_PAUSE,
        green_evidence_read: greenTest.decision,
        red_credential_without_founder: redTest.decision,
        sandbox_profile: sandbox.profile_version,
        sandbox_validation: sandboxValidation.reason,
        capability_broker: lease.broker_version || BROKER_VERSION,
        capability_lease_valid: leaseValidation.valid === true,
        watchdog: watchdog.decision,
        security_policy: SECURITY_POLICY_VERSION,
        production_autonomy_enabled: false,
        live_sandbox_execution_verified: false,
        live_rollback_drill_verified: false,
        secrets_exposed: false,
      }, ready ? 200 : 503);
    }

""" + post_anchor
once(post_anchor, v2_endpoint, 'v2 health endpoint')

auth_anchor = "    if (!isAuthorizedFounderMessage(env, chatId, senderId)) {\n      return json({ ok: true, ignored: true, reason: 'chat_not_authorized' });\n    }\n\n    const traceId = buildTraceId(update?.update_id, message.message_id);\n"
auth_block = "    if (!isAuthorizedFounderMessage(env, chatId, senderId)) {\n      return json({ ok: true, ignored: true, reason: 'chat_not_authorized' });\n    }\n\n    const v2Intent = classifyV2FounderIntent(text);\n    const v2Watchdog = evaluateWatchdog({ heartbeat_age_seconds: 0 });\n    if (v2Watchdog.decision === 'SAFE_HOLD') {\n      await sendTelegramMessage(env, chatId, 'Victor V2 watchdog SAFE_HOLD active hai; new execution dispatch blocked hai.', message.message_id);\n      return json({ ok: true, mode: 'V2_SAFE_HOLD', dispatch: 'BLOCKED', watchdog: v2Watchdog.triggers });\n    }\n\n    const traceId = buildTraceId(update?.update_id, message.message_id);\n"
once(auth_anchor, auth_block, 'v2 ingress intent/watchdog')

emergency_anchor = "    const emergencyCommand = parseEmergencyCommand(text);\n    if (emergencyCommand) {\n"
emergency_block = "    const emergencyCommand = parseEmergencyCommand(text);\n    if (v2Intent.intent === V2_FOUNDER_INTENT.STOP_PAUSE && !emergencyCommand) {\n      await sendTelegramMessage(env, chatId, 'Founder STOP/PAUSE precedence detected. New execution fail-closed SAFE_HOLD me hai; no dispatch attempted.', message.message_id);\n      return json({ ok: true, mode: 'V2_STOP_PAUSE_SAFE_HOLD', dispatch: 'BLOCKED' });\n    }\n    if (emergencyCommand) {\n"
once(emergency_anchor, emergency_block, 'stop precedence fallback')

for old, new, label in [
    ("if (shouldRunDeadEndRecovery(memoryDirective, explicitExecutiveGoalCommand, deadEnd)) {", "if (v2Intent.intent === V2_FOUNDER_INTENT.EXECUTION_COMMAND && shouldRunDeadEndRecovery(memoryDirective, explicitExecutiveGoalCommand, deadEnd)) {", 'dead-end dispatch gate'),
    ("if (!memoryDirective && shouldExecuteCrossDepartment(founderRequest.execution_plan)) {", "if (!memoryDirective && v2Intent.intent === V2_FOUNDER_INTENT.EXECUTION_COMMAND && shouldExecuteCrossDepartment(founderRequest.execution_plan)) {", 'cross dispatch gate'),
    ("if (!memoryDirective && ownedProblem.matched) {", "if (!memoryDirective && v2Intent.intent === V2_FOUNDER_INTENT.EXECUTION_COMMAND && ownedProblem.matched) {", 'owned problem dispatch gate'),
    ("if (!memoryDirective && contextualFollowUp.mode === 'CONTEXTUAL_INVESTIGATION') {", "if (!memoryDirective && v2Intent.intent === V2_FOUNDER_INTENT.EXECUTION_COMMAND && contextualFollowUp.mode === 'CONTEXTUAL_INVESTIGATION') {", 'contextual dispatch gate'),
]:
    once(old, new, label)

target_anchor = "        const target = plan.target;\n\n        if (plan.mode === 'DEPARTMENT_STATUS'"
target_block = """        const target = plan.target;

        if (plan.mode === 'DEPARTMENT_ACTION') {
          if (v2Intent.intent !== V2_FOUNDER_INTENT.EXECUTION_COMMAND) {
            await sendTelegramMessage(env, chatId, 'Victor V2 ne implicit department execution block kiya. Explicit execution command required hai.', message.message_id);
            return json({ ok: true, mode: 'V2_NO_IMPLICIT_EXECUTION', target, dispatch: 'BLOCKED' });
          }
          const preflight = buildV2DispatchPreflight(target, traceId);
          if (!preflight.allowed) {
            await sendTelegramMessage(env, chatId, `Victor V2 security preflight SAFE_HOLD: ${preflight.reason}.`, message.message_id);
            return json({ ok: true, mode: 'V2_SECURITY_SAFE_HOLD', target, dispatch: 'BLOCKED', reason: preflight.reason });
          }
        }

        if (plan.mode === 'DEPARTMENT_STATUS'"""
once(target_anchor, target_block, 'department preflight')

helper_anchor = "async function executeCrossDepartmentPlan(env, ctx, chatId, plan, replyToMessageId) {\n"
helper = """function buildV2DispatchPreflight(target, traceId) {
  const normalizedTarget = ['rio', 'tony_stark', 'aura3', 'hulk'].includes(target) ? target : 'internal';
  const goal = { goal_id: `telegram:${traceId}`, allowed_departments: [normalizedTarget] };
  const contract = buildActionContract({ goal, target: normalizedTarget, runtimePhase: 'EXECUTE', actionId: `${traceId}:${normalizedTarget}` });
  const contractValidation = validateActionContract(contract, goal);
  if (!contractValidation.ok) return { allowed: false, reason: `ACTION_CONTRACT_INVALID:${contractValidation.errors.join(',')}`, contract };
  const lease = issueCapabilityLease({
    capability_id: 'sandbox.execute',
    objective_id: contract.objective_id,
    action_id: contract.action_id,
    action_contract_authorized: true,
    ttl_seconds: 300,
  });
  if (!lease.issued) return { allowed: false, reason: `CAPABILITY_DENIED:${lease.reason}`, contract, lease };
  const leaseValidation = validateCapabilityLease(lease, {
    objective_id: contract.objective_id,
    action_id: contract.action_id,
    capability_id: 'sandbox.execute',
  });
  if (!leaseValidation.valid) return { allowed: false, reason: `CAPABILITY_INVALID:${leaseValidation.reason}`, contract, lease };
  return { allowed: true, reason: 'V2_PREFLIGHT_ALLOWED', contract, lease };
}

""" + helper_anchor
once(helper_anchor, helper, 'v2 dispatch preflight helper')

cross_target_anchor = "    const target = step.target;\n    try {\n      const pause = await isExecutionPaused(env, target);\n"
cross_target_block = "    const target = step.target;\n    try {\n      const v2Preflight = buildV2DispatchPreflight(target, `cross:${replyToMessageId || 'none'}:${target}`);\n      if (!v2Preflight.allowed) {\n        failed.push({ target, reason: v2Preflight.reason });\n        continue;\n      }\n      const pause = await isExecutionPaused(env, target);\n"
once(cross_target_anchor, cross_target_block, 'cross department preflight')

p.write_text(s)
