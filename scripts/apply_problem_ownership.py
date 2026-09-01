from pathlib import Path

worker = Path('victor-telegram-worker/worker.js')
text = worker.read_text(encoding='utf-8')

founder_conv_import = "import { naturalDispatchAcknowledgement, naturalInvestigationAcknowledgement, naturalPendingReply, buildNaturalResultPrompt, naturalResultFallback } from '../brain/founder_conversation.mjs';\n"
ownership_import = "import { classifyOwnedProblem, buildOwnedProblemPrompt, naturalOwnedProblemAck } from '../brain/problem_ownership.mjs';\n"
if ownership_import not in text:
    if founder_conv_import not in text:
        raise SystemExit('founder conversation import anchor missing')
    text = text.replace(founder_conv_import, founder_conv_import + ownership_import, 1)

classify_anchor = "      const contextualFollowUp = classifyConversationFollowUp(text, sessionWithFounderTurn);\n      const hulkRequest = classifyHulkRequest(text);\n"
classify_repl = "      const contextualFollowUp = classifyConversationFollowUp(text, sessionWithFounderTurn);\n      const ownedProblem = classifyOwnedProblem(text, sessionWithFounderTurn);\n      const hulkRequest = classifyHulkRequest(text);\n"
if classify_repl not in text:
    if classify_anchor not in text:
        raise SystemExit('ownership classification anchor missing')
    text = text.replace(classify_anchor, classify_repl, 1)

hulk_block_end = "        return json({ ok: true, mode: hulkRequest.mode, target: 'hulk', dispatch: 'NOT_ATTEMPTED_BRIDGE_UNVERIFIED' });\n      }\n\n"
ownership_block = "      if (!memoryDirective && ownedProblem.matched) {\n        const recoveryText = buildOwnedProblemPrompt(ownedProblem.target, text);\n        const dispatch = await dispatchContextualInvestigation(env, ownedProblem.target, recoveryText, { messageId: message.message_id });\n        await writeConversationSession(chatId, {\n          last_target: ownedProblem.target,\n          last_task_id: dispatch.taskId,\n          last_task_type: 'OWNED_PROBLEM_RECOVERY',\n          active_issue: text,\n          unresolved_question: text,\n          task_state: 'OWNED_RECOVERY_RUNNING',\n        });\n        await sendTelegramMessage(env, chatId, naturalOwnedProblemAck(ownedProblem.target), message.message_id);\n        if (ownedProblem.target === 'rio') ctx?.waitUntil(handleRioRoundTrip(env, chatId, dispatch, message.message_id));\n        else if (ownedProblem.target === 'tony_stark') ctx?.waitUntil(handleTonyRoundTrip(env, chatId, dispatch, message.message_id));\n        else if (ownedProblem.target === 'aura3') ctx?.waitUntil(handleAura3RoundTrip(env, chatId, dispatch, message.message_id));\n        return json({ ok: true, mode: ownedProblem.mode, target: ownedProblem.target, task_id: dispatch.taskId });\n      }\n\n"
if ownership_block not in text:
    if hulk_block_end not in text:
        raise SystemExit('ownership insertion anchor missing')
    text = text.replace(hulk_block_end, hulk_block_end + ownership_block, 1)

worker.write_text(text, encoding='utf-8')

bridge = Path('victor-telegram-worker/department_bridge.mjs')
b = bridge.read_text(encoding='utf-8')
old = "  if (/victor goal contract|goal id:|org-revenue-001|replan_execute/.test(value)) return 'GOAL_EXECUTE';"
new = "  if (/victor goal contract|victor owned problem recovery|goal id:|org-revenue-001|replan_execute/.test(value)) return 'GOAL_EXECUTE';"
if new not in b:
    if old not in b:
        raise SystemExit('RIO goal task selector anchor missing')
    b = b.replace(old, new, 1)
bridge.write_text(b, encoding='utf-8')

print('PROBLEM_OWNERSHIP_APPLIED')
