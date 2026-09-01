from pathlib import Path

path = Path('victor-telegram-worker/worker.js')
text = path.read_text(encoding='utf-8')

intent_import = "import { resolveFounderIntent, founderDirectionReply, clarificationFallback } from '../brain/founder_intent.mjs';\n"
conversation_import = "import { classifyConversationFollowUp, formatPendingTaskStatus } from '../brain/conversation_runtime.mjs';\n"
if conversation_import not in text:
    if intent_import not in text:
        raise SystemExit('founder intent import missing')
    text = text.replace(intent_import, intent_import + conversation_import, 1)

planning = "      processingStage = 'REQUEST_PLANNING';\n      const replyContext = message?.reply_to_message?.text || '';\n      const deterministicIntent = resolveFounderIntent(text, replyContext);\n"
replacement = "      processingStage = 'REQUEST_PLANNING';\n      const replyContext = message?.reply_to_message?.text || '';\n      const session = await readConversationSession(chatId);\n      const deterministicIntent = resolveFounderIntent(text, replyContext);\n      const contextualFollowUp = classifyConversationFollowUp(text, session);\n\n      if (!memoryDirective && contextualFollowUp.mode) {\n        const handled = await answerExistingDepartmentTask(env, chatId, contextualFollowUp, session, message.message_id);\n        if (handled) return json({ ok: true, mode: contextualFollowUp.mode, target: contextualFollowUp.target, task_id: contextualFollowUp.task_id });\n      }\n"
if replacement not in text:
    if planning not in text:
        raise SystemExit('planning continuity anchor missing')
    text = text.replace(planning, replacement, 1)

for target, marker in [('rio', 'RIO'), ('tony_stark', 'Tony'), ('aura3', 'AURA3')]:
    if target == 'rio':
        anchor = "          await sendTelegramMessage(env, chatId, `RIO ko task de diya. Task ID: ${dispatch.taskId}.`, message.message_id);\n          ctx?.waitUntil(handleRioRoundTrip(env, chatId, dispatch, message.message_id));"
        repl = "          await writeConversationSession(chatId, { last_target: 'rio', last_task_id: dispatch.taskId, last_task_type: dispatch.taskType || plan.mode, last_founder_text: text, task_state: 'PENDING' });\n          await sendTelegramMessage(env, chatId, `RIO ko task de diya. Task ID: ${dispatch.taskId}.`, message.message_id);\n          ctx?.waitUntil(handleRioRoundTrip(env, chatId, dispatch, message.message_id));"
    elif target == 'tony_stark':
        anchor = "          await sendTelegramMessage(env, chatId, `Tony ko task de diya. Task ID: ${dispatch.taskId}.`, message.message_id);\n          ctx?.waitUntil(handleTonyRoundTrip(env, chatId, dispatch, message.message_id));"
        repl = "          await writeConversationSession(chatId, { last_target: 'tony_stark', last_task_id: dispatch.taskId, last_task_type: dispatch.taskType || plan.mode, last_founder_text: text, task_state: 'PENDING' });\n          await sendTelegramMessage(env, chatId, `Tony ko task de diya. Task ID: ${dispatch.taskId}.`, message.message_id);\n          ctx?.waitUntil(handleTonyRoundTrip(env, chatId, dispatch, message.message_id));"
    else:
        anchor = "          await sendTelegramMessage(env, chatId, `AURA3 ko task de diya. Task ID: ${dispatch.taskId}.`, message.message_id);\n          ctx?.waitUntil(handleAura3RoundTrip(env, chatId, dispatch, message.message_id));"
        repl = "          await writeConversationSession(chatId, { last_target: 'aura3', last_task_id: dispatch.taskId, last_task_type: dispatch.taskType || plan.mode, last_founder_text: text, task_state: 'PENDING' });\n          await sendTelegramMessage(env, chatId, `AURA3 ko task de diya. Task ID: ${dispatch.taskId}.`, message.message_id);\n          ctx?.waitUntil(handleAura3RoundTrip(env, chatId, dispatch, message.message_id));"
    if repl not in text:
        if anchor not in text:
            raise SystemExit(f'{target} session anchor missing')
        text = text.replace(anchor, repl, 1)

# Reuse a recent same-department status task instead of dispatching duplicates.
status_anchor = "      if (!memoryDirective && (plan.mode === 'DEPARTMENT_STATUS' || plan.mode === 'DEPARTMENT_ACTION')) {\n        processingStage = 'DEPARTMENT_EXECUTION';\n        const target = plan.target;\n"
status_repl = "      if (!memoryDirective && (plan.mode === 'DEPARTMENT_STATUS' || plan.mode === 'DEPARTMENT_ACTION')) {\n        processingStage = 'DEPARTMENT_EXECUTION';\n        const target = plan.target;\n\n        if (plan.mode === 'DEPARTMENT_STATUS' && session?.last_target === target && session?.last_task_id) {\n          const handled = await answerExistingDepartmentTask(env, chatId, { mode: 'TASK_STATUS_FOLLOWUP', target, task_id: session.last_task_id }, session, message.message_id);\n          if (handled) return json({ ok: true, mode: 'DEPARTMENT_STATUS_REUSED', target, task_id: session.last_task_id });\n        }\n"
if status_repl not in text:
    if status_anchor not in text:
        raise SystemExit('status reuse anchor missing')
    text = text.replace(status_anchor, status_repl, 1)

helper_anchor = "function memoryAcknowledgement(status) {\n"
helpers = r'''async function readConversationSession(chatId) {
  try {
    const cache = caches.default;
    const key = new Request(`https://victor.internal/conversation/${encodeURIComponent(String(chatId))}`);
    const hit = await cache.match(key);
    return hit ? await hit.json() : {};
  } catch (_) {
    return {};
  }
}

async function writeConversationSession(chatId, next) {
  try {
    const cache = caches.default;
    const key = new Request(`https://victor.internal/conversation/${encodeURIComponent(String(chatId))}`);
    const current = await readConversationSession(chatId);
    const payload = { ...current, ...next, updated_at: new Date().toISOString() };
    await cache.put(key, new Response(JSON.stringify(payload), { headers: { 'Cache-Control': 'public, max-age=900', 'Content-Type': 'application/json' } }));
  } catch (_) {}
}

async function answerExistingDepartmentTask(env, chatId, followUp, session, replyToMessageId) {
  const target = followUp?.target || session?.last_target;
  const taskId = followUp?.task_id || session?.last_task_id;
  if (!target || !taskId) return false;
  try {
    let received;
    let verification;
    let report;
    if (target === 'rio') {
      received = await waitForRioResult(taskId, { attempts: 1, delayMs: 0 });
      if (received.status === 'RESULT_RECEIVED') {
        verification = verifyRioResult(received.result, taskId);
        if (verification.ok) report = formatRioResultForFounder(received.result);
      }
    } else if (target === 'tony_stark') {
      received = await waitForTonyResult(taskId, env, { attempts: 1, delayMs: 0 });
      if (received.status === 'RESULT_RECEIVED') {
        verification = verifyTonyResult(received.result, taskId);
        if (verification.ok) report = formatTonyResultForFounder(received.result);
      }
    } else if (target === 'aura3') {
      received = await waitForAura3Result(taskId, { attempts: 1, delayMs: 0 });
      if (received.status === 'RESULT_RECEIVED') {
        verification = verifyAura3Result(received.result, taskId);
        if (verification.ok) report = formatAura3ResultForFounder(received.result);
      }
    } else {
      return false;
    }

    if (report) {
      await writeConversationSession(chatId, { last_target: target, last_task_id: taskId, task_state: 'RESULT_VERIFIED' });
      await sendTelegramMessage(env, chatId, `${report}\n\nVictor verification: existing task ka fresh result VERIFIED. Naya duplicate task dispatch nahi kiya.`, replyToMessageId);
      return true;
    }

    await sendTelegramMessage(env, chatId, formatPendingTaskStatus({ last_target: target, last_task_id: taskId }), replyToMessageId);
    return true;
  } catch (error) {
    console.error('Existing task status lookup failed:', safeErrorMessage(error));
    await sendTelegramMessage(env, chatId, `Existing task ${taskId} ka fresh status abhi verify nahi hua. Victor naya duplicate task dispatch nahi karega; same task ko track karega.`, replyToMessageId);
    return true;
  }
}

'''
if helpers not in text:
    if helper_anchor not in text:
        raise SystemExit('helper anchor missing')
    text = text.replace(helper_anchor, helpers + helper_anchor, 1)

path.write_text(text, encoding='utf-8')
print('Conversation continuity fix applied')
