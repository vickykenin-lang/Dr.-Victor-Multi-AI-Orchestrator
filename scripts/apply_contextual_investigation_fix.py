from pathlib import Path

path = Path('victor-telegram-worker/worker.js')
text = path.read_text(encoding='utf-8')

old_import = "import { classifyConversationFollowUp, formatPendingTaskStatus } from '../brain/conversation_runtime.mjs';\n"
new_import = "import { classifyConversationFollowUp, buildInvestigationTaskText, formatPendingTaskStatus } from '../brain/conversation_runtime.mjs';\n"
if old_import in text:
    text = text.replace(old_import, new_import, 1)
elif new_import not in text:
    raise SystemExit('conversation runtime import anchor missing')

old_branch = """      if (!memoryDirective && contextualFollowUp.mode) {\n        const handled = await answerExistingDepartmentTask(env, chatId, contextualFollowUp, sessionWithFounderTurn, message.message_id);\n        if (handled) return json({ ok: true, mode: contextualFollowUp.mode, target: contextualFollowUp.target, task_id: contextualFollowUp.task_id });\n      }\n"""
new_branch = """      if (!memoryDirective && contextualFollowUp.mode === 'CONTEXTUAL_INVESTIGATION') {\n        const investigationText = buildInvestigationTaskText(contextualFollowUp, sessionWithFounderTurn);\n        const dispatch = await dispatchContextualInvestigation(env, contextualFollowUp.target, investigationText, { messageId: message.message_id });\n        await writeConversationSession(chatId, {\n          last_target: contextualFollowUp.target,\n          last_task_id: dispatch.taskId,\n          parent_task_id: contextualFollowUp.parent_task_id || contextualFollowUp.task_id || null,\n          last_task_type: 'CONTEXTUAL_INVESTIGATION',\n          active_issue: contextualFollowUp.query || text,\n          unresolved_question: contextualFollowUp.query || text,\n          task_state: 'PENDING_INVESTIGATION',\n        });\n        await sendTelegramMessage(env, chatId, `${String(contextualFollowUp.target || '').toUpperCase()} ko specific follow-up investigation di hai. Parent task: ${contextualFollowUp.parent_task_id || contextualFollowUp.task_id || 'none'}. Investigation task: ${dispatch.taskId}. Purani report repeat nahi karni; fresh evidence ya evidence-gap ka root cause return karna hai.`, message.message_id);\n        if (contextualFollowUp.target === 'rio') ctx?.waitUntil(handleRioRoundTrip(env, chatId, dispatch, message.message_id));\n        else if (contextualFollowUp.target === 'tony_stark') ctx?.waitUntil(handleTonyRoundTrip(env, chatId, dispatch, message.message_id));\n        else if (contextualFollowUp.target === 'aura3') ctx?.waitUntil(handleAura3RoundTrip(env, chatId, dispatch, message.message_id));\n        return json({ ok: true, mode: contextualFollowUp.mode, target: contextualFollowUp.target, parent_task_id: contextualFollowUp.parent_task_id || null, task_id: dispatch.taskId });\n      }\n\n      if (!memoryDirective && contextualFollowUp.mode) {\n        const handled = await answerExistingDepartmentTask(env, chatId, contextualFollowUp, sessionWithFounderTurn, message.message_id);\n        if (handled) return json({ ok: true, mode: contextualFollowUp.mode, target: contextualFollowUp.target, task_id: contextualFollowUp.task_id });\n      }\n"""
if new_branch not in text:
    if old_branch not in text:
        raise SystemExit('contextual follow-up branch anchor missing')
    text = text.replace(old_branch, new_branch, 1)

helper_anchor = "async function answerExistingDepartmentTask(env, chatId, followUp, session, replyToMessageId) {\n"
helper = r'''async function dispatchContextualInvestigation(env, target, investigationText, metadata = {}) {
  if (target === 'rio') {
    if (!rioBridgeConfigured(env)) throw new Error('RIO_BRIDGE_NOT_CONFIGURED');
    return dispatchRioTask(env, investigationText, metadata);
  }
  if (target === 'tony_stark') {
    if (!tonyBridgeConfigured(env)) throw new Error('TONY_BRIDGE_NOT_CONFIGURED');
    return dispatchTonyTask(env, investigationText, metadata);
  }
  if (target === 'aura3') {
    if (!aura3BridgeConfigured(env)) throw new Error('AURA3_BRIDGE_NOT_CONFIGURED');
    return dispatchAura3Task(env, investigationText, metadata);
  }
  throw new Error('CONTEXTUAL_INVESTIGATION_TARGET_UNSUPPORTED');
}

'''
if helper not in text:
    if helper_anchor not in text:
        raise SystemExit('existing task helper anchor missing')
    text = text.replace(helper_anchor, helper + helper_anchor, 1)

path.write_text(text, encoding='utf-8')
print('CONTEXTUAL_INVESTIGATION_FIX_APPLIED')
