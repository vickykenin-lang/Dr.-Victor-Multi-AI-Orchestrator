from pathlib import Path

path = Path('victor-telegram-worker/worker.js')
text = path.read_text(encoding='utf-8')

anchor = "import { buildActiveContext, appendRecentTurn, formatActiveContextForPrompt } from '../brain/active_context.mjs';\n"
line = "import { naturalDispatchAcknowledgement, naturalInvestigationAcknowledgement, naturalPendingReply, buildNaturalResultPrompt, naturalResultFallback } from '../brain/founder_conversation.mjs';\n"
if line not in text:
    if anchor not in text:
        raise SystemExit('active-context import anchor missing')
    text = text.replace(anchor, anchor + line, 1)

text = text.replace("active_thread_memory: 'BEST_EFFORT_WORKING_CONTEXT_V1',", "active_thread_memory: 'BEST_EFFORT_WORKING_CONTEXT_V1',\n        founder_conversation_layer: 'NATURAL_CONVERSATION_FIRST_V1',")

old = "        await sendTelegramMessage(env, chatId, `${String(contextualFollowUp.target || '').toUpperCase()} ko specific follow-up investigation di hai. Parent task: ${contextualFollowUp.parent_task_id || contextualFollowUp.task_id || 'none'}. Investigation task: ${dispatch.taskId}. Purani report repeat nahi karni; fresh evidence ya evidence-gap ka root cause return karna hai.`, message.message_id);"
new = "        await sendTelegramMessage(env, chatId, naturalInvestigationAcknowledgement(contextualFollowUp.target, contextualFollowUp.query || text), message.message_id);"
text = text.replace(old, new)

replacements = {
"          await sendTelegramMessage(env, chatId, `RIO ko task de diya. Task ID: ${dispatch.taskId}.`, message.message_id);": "          await sendTelegramMessage(env, chatId, naturalDispatchAcknowledgement('rio', text), message.message_id);",
"          await sendTelegramMessage(env, chatId, `Tony ko task de diya. Task ID: ${dispatch.taskId}.`, message.message_id);": "          await sendTelegramMessage(env, chatId, naturalDispatchAcknowledgement('tony_stark', text), message.message_id);",
"          await sendTelegramMessage(env, chatId, `AURA3 ko task de diya. Task ID: ${dispatch.taskId}.`, message.message_id);": "          await sendTelegramMessage(env, chatId, naturalDispatchAcknowledgement('aura3', text), message.message_id);",
"    await sendTelegramMessage(env, chatId, `${report}\\n\\nVictor verification: fresh governed round-trip VERIFIED. Ye communication certification hai; RIO production authority ya objective change nahi hua.`, replyToMessageId);": "    await sendNaturalDepartmentResult(env, chatId, 'rio', report, replyToMessageId);",
"    await sendTelegramMessage(env, chatId, `${report}\\n\\n${verificationNote}`, replyToMessageId);": "    await sendNaturalDepartmentResult(env, chatId, 'tony_stark', `${report}\\n\\n${verificationNote}`, replyToMessageId);",
"      await sendTelegramMessage(env, chatId, `${report}\\n\\nVictor verification: existing task ka fresh result VERIFIED. Naya duplicate task dispatch nahi kiya.`, replyToMessageId);": "      await sendNaturalDepartmentResult(env, chatId, target, report, replyToMessageId);",
"    await sendTelegramMessage(env, chatId, formatPendingTaskStatus({ last_target: target, last_task_id: taskId }), replyToMessageId);": "    await sendTelegramMessage(env, chatId, naturalPendingReply(target), replyToMessageId);",
}
for old_value, new_value in replacements.items():
    text = text.replace(old_value, new_value)

# AURA3 has a slightly different verification suffix.
aura_old = "    await sendTelegramMessage(env, chatId, `${report}\\n\\nVictor verification: round-trip evidence VERIFIED for this task. Ye diagnostic communication verification hai; production/LIVE certification alag gate hai.`, replyToMessageId);"
aura_new = "    await sendNaturalDepartmentResult(env, chatId, 'aura3', report, replyToMessageId);"
text = text.replace(aura_old, aura_new)

# Make common error paths conversational and hide internal task IDs by default.
error_replacements = {
"`RIO task ${dispatch.taskId} ka fresh revert timeout hua. Connection VERIFIED claim nahi kiya jayega.`": "'RIO ka fresh result abhi verify nahi ho paya. Main ise success ya connected result claim nahi kar raha; same check ko track karunga.'",
"`RIO ka revert mila, lekin strict verification fail hui. Task ${dispatch.taskId} VERIFIED_CONNECTED nahi hai.`": "'RIO se result mila, lekin verification pass nahi hui. Isliye main us result ko reliable fact ke roop me use nahi karunga.'",
"`RIO round-trip verify nahi hua. Task ${dispatch.taskId} par error aaya; main connected/success claim nahi karunga.`": "'RIO ka fresh check verify nahi ho paya. Main success claim nahi kar raha; exact failure ko internally track kar raha hoon.'",
"`Tony task ${dispatch.taskId} ka fresh revert timeout hua. Connection ko VERIFIED claim nahi kar raha. Follow-up required hai.`": "'Tony ka fresh result abhi verify nahi ho paya. Main same check ko track kar raha hoon aur unverified result ko final nahi maanunga.'",
"`Tony ka revert mila, lekin strict verification fail hui. Task ${dispatch.taskId} ko VERIFIED_CONNECTED nahi maana jayega.`": "'Tony se result mila, lekin verification pass nahi hui. Main ise reliable final result nahi maan raha.'",
"`Tony round-trip verify nahi hua. Task ${dispatch.taskId} par error aaya; main connected/success claim nahi karunga.`": "'Tony ka fresh check verify nahi ho paya. Main success claim nahi kar raha; issue internally track ho raha hai.'",
"`AURA3 task ${dispatch.taskId} ka fresh revert timeout hua. Connection ko VERIFIED claim nahi kar raha. Follow-up required hai.`": "'AURA3 ka fresh result abhi verify nahi ho paya. Main same check ko track kar raha hoon; unverified result ko final nahi maanunga.'",
"`AURA3 ka revert mila, lekin strict verification fail hui. Task ${dispatch.taskId} ko VERIFIED_CONNECTED nahi maana jayega.`": "'AURA3 se result mila, lekin verification pass nahi hui. Main ise reliable final result nahi maan raha.'",
"`AURA3 round-trip verify nahi hua. Task ${dispatch.taskId} par error aaya; main connected/success claim nahi karunga.`": "'AURA3 ka fresh check verify nahi ho paya. Main success claim nahi kar raha; issue internally track ho raha hai.'",
}
for old_value, new_value in error_replacements.items():
    text = text.replace(old_value, new_value)

helper_anchor = "async function readConversationSession(chatId) {\n"
helper = r'''async function sendNaturalDepartmentResult(env, chatId, target, rawReport, replyToMessageId) {
  const session = await readConversationSession(chatId);
  const founderQuestion = session?.unresolved_question || session?.active_issue || session?.last_founder_text || '';
  let reply = naturalResultFallback(target, rawReport);
  if (env.ENABLE_AI_INFERENCE === 'true') {
    try {
      reply = await askModel(
        env,
        'Rewrite verified department evidence into a natural Founder-facing answer. Follow the supplied rules exactly; never invent or upgrade evidence.',
        buildNaturalResultPrompt(target, founderQuestion, rawReport),
      );
    } catch (error) {
      console.error('Natural Founder result synthesis failed:', safeErrorMessage(error));
    }
  }
  await writeConversationSession(chatId, {
    last_victor_reply: reply,
    unresolved_question: null,
    task_state: 'RESULT_VERIFIED',
  });
  await sendTelegramMessage(env, chatId, reply, replyToMessageId);
}

'''
if helper not in text:
    if helper_anchor not in text:
        raise SystemExit('conversation-session helper anchor missing')
    text = text.replace(helper_anchor, helper + helper_anchor, 1)

path.write_text(text, encoding='utf-8')
print('Natural Founder conversation layer applied')
