from pathlib import Path

p = Path('victor-telegram-worker/worker.js')
s = p.read_text(encoding='utf-8')

imp_old = "import { buildRuntimeFounderRequest, buildSessionPatchForRequest, buildFactRequestFromFounderRequest, shouldUseFactGateway } from '../brain/request_gateway.mjs';\n"
imp_new = imp_old + "import { shouldExecuteCrossDepartment } from '../brain/execution_plan.mjs';\n"
if "from '../brain/execution_plan.mjs'" not in s:
    if imp_old not in s:
        raise SystemExit('execution-plan import anchor missing')
    s = s.replace(imp_old, imp_new, 1)

anchor = "      if (!memoryDirective && ownedProblem.matched) {\n"
block = """      if (!memoryDirective && shouldExecuteCrossDepartment(founderRequest.execution_plan)) {
        processingStage = 'CROSS_DEPARTMENT_EXECUTION';
        const crossResult = await executeCrossDepartmentPlan(env, ctx, chatId, founderRequest.execution_plan, message.message_id);
        await writeConversationSession(chatId, {
          active_issue: text,
          unresolved_question: text,
          task_state: crossResult.failed.length ? 'CROSS_DEPARTMENT_PARTIAL' : 'CROSS_DEPARTMENT_DISPATCHED',
          cross_department_plan: crossResult,
          last_task_id: null,
          parent_task_id: null,
        }, env);
        const dispatchedNames = crossResult.dispatched.map(x => x.target === 'tony_stark' ? 'Tony' : x.target.toUpperCase()).join(', ');
        const failedNames = crossResult.failed.map(x => x.target === 'tony_stark' ? 'Tony' : x.target.toUpperCase()).join(', ');
        const reply = failedNames
          ? `Cross-department plan start hua. Dispatched: ${dispatchedNames || 'none'}. Abhi dispatch nahi hua: ${failedNames}. Main unverified execution ko completed claim nahi kar raha.`
          : `Cross-department plan start hua: ${dispatchedNames}. Final outcome har department ke verified result ke baad hi maana jayega.`;
        await sendTelegramMessage(env, chatId, reply, message.message_id);
        return json({ ok: true, mode: 'CROSS_DEPARTMENT_ACTION', dispatched: crossResult.dispatched.map(x => x.target), failed: crossResult.failed.map(x => x.target) });
      }

"""
if "mode: 'CROSS_DEPARTMENT_ACTION'" not in s:
    if anchor not in s:
        raise SystemExit('cross-department runtime anchor missing')
    s = s.replace(anchor, block + anchor, 1)

helper_anchor = "async function dispatchContextualInvestigation(env, target, investigationText, metadata = {}) {\n"
helper = """async function executeCrossDepartmentPlan(env, ctx, chatId, plan, replyToMessageId) {
  const dispatched = [];
  const failed = [];
  for (const step of plan.steps || []) {
    const target = step.target;
    try {
      const pause = await isExecutionPaused(env, target);
      if (pause.paused) {
        failed.push({ target, reason: 'PAUSED' });
        continue;
      }
      let dispatch;
      if (target === 'rio') {
        if (!rioBridgeConfigured(env)) throw new Error('RIO_BRIDGE_NOT_CONFIGURED');
        dispatch = await dispatchRioTask(env, step.founder_text, { replyToMessageId });
        ctx?.waitUntil(handleRioRoundTrip(env, chatId, dispatch, replyToMessageId));
      } else if (target === 'tony_stark') {
        if (!tonyBridgeConfigured(env)) throw new Error('TONY_BRIDGE_NOT_CONFIGURED');
        dispatch = await dispatchTonyTask(env, step.founder_text, { replyToMessageId });
        ctx?.waitUntil(handleTonyRoundTrip(env, chatId, dispatch, replyToMessageId));
      } else if (target === 'aura3') {
        if (!aura3BridgeConfigured(env)) throw new Error('AURA3_BRIDGE_NOT_CONFIGURED');
        dispatch = await dispatchAura3Task(env, step.founder_text, { replyToMessageId });
        ctx?.waitUntil(handleAura3RoundTrip(env, chatId, dispatch, replyToMessageId));
      } else {
        failed.push({ target, reason: 'UNSUPPORTED_TARGET' });
        continue;
      }
      dispatched.push({ target, task_id: dispatch.taskId, task_type: dispatch.taskType || 'CROSS_DEPARTMENT_ACTION' });
    } catch (error) {
      console.error('Cross-department dispatch failed:', target, safeErrorMessage(error));
      failed.push({ target, reason: 'DISPATCH_FAILED' });
    }
  }
  return { version: plan.version, requested_outcome: plan.requested_outcome, dispatched, failed };
}

"""
if "async function executeCrossDepartmentPlan" not in s:
    if helper_anchor not in s:
        raise SystemExit('execution-plan helper anchor missing')
    s = s.replace(helper_anchor, helper + helper_anchor, 1)

p.write_text(s, encoding='utf-8')
print('execution plan runtime integration present')
