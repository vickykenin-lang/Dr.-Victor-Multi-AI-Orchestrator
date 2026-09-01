from pathlib import Path

path = Path('victor-telegram-worker/worker.js')
text = path.read_text(encoding='utf-8')

conv_import = "import { classifyConversationFollowUp, formatPendingTaskStatus } from '../brain/conversation_runtime.mjs';\n"
active_import = "import { buildActiveContext, appendRecentTurn, formatActiveContextForPrompt } from '../brain/active_context.mjs';\n"
if active_import not in text:
    if conv_import not in text:
        raise SystemExit('conversation runtime import missing')
    text = text.replace(conv_import, conv_import + active_import, 1)

old = "      const session = await readConversationSession(chatId);\n      const deterministicIntent = resolveFounderIntent(text, replyContext);\n      const contextualFollowUp = classifyConversationFollowUp(text, session);\n"
new = "      const session = await readConversationSession(chatId);\n      const activePatch = buildActiveContext(session, { founderText: text, replyContext, messageId: message.message_id });\n      const sessionWithFounderTurn = appendRecentTurn({ ...session, ...activePatch }, 'founder', text);\n      await writeConversationSession(chatId, sessionWithFounderTurn);\n      const deterministicIntent = resolveFounderIntent(text, replyContext);\n      const contextualFollowUp = classifyConversationFollowUp(text, sessionWithFounderTurn);\n"
if new not in text:
    if old not in text:
        raise SystemExit('active context planning anchor missing')
    text = text.replace(old, new, 1)

text = text.replace("answerExistingDepartmentTask(env, chatId, contextualFollowUp, session, message.message_id)", "answerExistingDepartmentTask(env, chatId, contextualFollowUp, sessionWithFounderTurn, message.message_id)")
text = text.replace("session?.last_target === target && session?.last_task_id", "sessionWithFounderTurn?.last_target === target && sessionWithFounderTurn?.last_task_id")
text = text.replace("session.last_task_id }, session, message.message_id)", "sessionWithFounderTurn.last_task_id }, sessionWithFounderTurn, message.message_id)")
text = text.replace("task_id: session.last_task_id", "task_id: sessionWithFounderTurn.last_task_id")

old_plan_call = "      const plan = await planFounderRequest(env, text, replyContext);\n"
new_plan_call = "      const plan = await planFounderRequest(env, text, replyContext, sessionWithFounderTurn);\n"
if new_plan_call not in text:
    if old_plan_call not in text:
        raise SystemExit('planner call anchor missing')
    text = text.replace(old_plan_call, new_plan_call, 1)

old_core_call = "        reply = await callVictorCore(env, text, {\n          telegramWebhookAuthenticated: true,\n          telegramMessageReceivedNow: true,\n          diagnosticDepartmentBridgeAvailable: aura3BridgeConfigured(env) || tonyBridgeConfigured(env) || rioBridgeConfigured(env),\n        });\n"
new_core_call = "        reply = await callVictorCore(env, text, {\n          telegramWebhookAuthenticated: true,\n          telegramMessageReceivedNow: true,\n          diagnosticDepartmentBridgeAvailable: aura3BridgeConfigured(env) || tonyBridgeConfigured(env) || rioBridgeConfigured(env),\n        }, sessionWithFounderTurn);\n"
if new_core_call not in text:
    if old_core_call not in text:
        raise SystemExit('callVictorCore invocation anchor missing')
    text = text.replace(old_core_call, new_core_call, 1)

old_sig = "async function planFounderRequest(env, text, replyContext = '') {\n"
new_sig = "async function planFounderRequest(env, text, replyContext = '', activeSession = {}) {\n"
if new_sig not in text:
    if old_sig not in text:
        raise SystemExit('planner signature anchor missing')
    text = text.replace(old_sig, new_sig, 1)

planner_system_anchor = "You are Victor's request planner. Understand the Founder's intent like a normal AI.\nReturn ONLY one JSON object, no prose.\n"
planner_system_new = "You are Victor's request planner. Understand the Founder's intent like a normal AI.\nReturn ONLY one JSON object, no prose.\n\nACTIVE WORKING THREAD:\n${formatActiveContextForPrompt(activeSession)}\n\nContinuity rule: short, elliptical or pronoun-based messages normally refer to this active thread unless the Founder clearly starts a new topic. Do not reset context merely because the current message omits the department or task name.\n"
if planner_system_new not in text:
    if planner_system_anchor not in text:
        raise SystemExit('planner system prompt anchor missing')
    text = text.replace(planner_system_anchor, planner_system_new, 1)

old_core_sig = "async function callVictorCore(env, userMessage, requestFacts) {\n"
new_core_sig = "async function callVictorCore(env, userMessage, requestFacts, activeSession = {}) {\n"
if new_core_sig not in text:
    if old_core_sig not in text:
        raise SystemExit('callVictorCore signature anchor missing')
    text = text.replace(old_core_sig, new_core_sig, 1)

memory_contract_anchor = "MEMORY CONTRACT:\n- Relevant memory is supporting context, not proof of current external state.\n"
active_contract = "ACTIVE WORKING THREAD:\n${formatActiveContextForPrompt(activeSession)}\n\nTHREAD CONTINUITY CONTRACT:\n- Treat the active thread as the default referent for short follow-ups such as 'pata karke batao', 'iska kya hua', 'kyu', 'status?', 'continue', or 'thik karo'.\n- A new explicit department/topic may replace the active thread.\n- Working-thread memory is conversational context, not proof of external state; current operational facts still require fresh evidence.\n- Do not contradict a recent Founder correction unless newer explicit Founder wording changes it.\n\n"
if active_contract not in text:
    if memory_contract_anchor not in text:
        raise SystemExit('memory contract anchor missing')
    text = text.replace(memory_contract_anchor, active_contract + memory_contract_anchor, 1)

# Persist every Victor Telegram reply into working-thread memory so the next Founder turn can refer to it.
send_anchor = "  if (!response.ok) throw new Error(`Telegram sendMessage HTTP ${response.status}`);\n}\n"
send_repl = "  if (!response.ok) throw new Error(`Telegram sendMessage HTTP ${response.status}`);\n  try {\n    const current = await readConversationSession(chatId);\n    const withReply = appendRecentTurn({ ...current, last_victor_reply: cleanText.slice(0, 1200) }, 'victor', cleanText.slice(0, 1200));\n    await writeConversationSession(chatId, withReply);\n  } catch (_) {}\n}\n"
if send_repl not in text:
    if send_anchor not in text:
        raise SystemExit('Telegram send anchor missing')
    text = text.replace(send_anchor, send_repl, 1)

# Extend best-effort current-memory window from 15 minutes to 2 hours. It remains non-durable conversational state.
text = text.replace("'Cache-Control': 'public, max-age=900'", "'Cache-Control': 'public, max-age=7200'")

# Health surface should expose the new layer without claiming durable persistence.
health_anchor = "        memory_recall_mode: 'LAYERED_REPO_MEMORY_V3',\n"
health_new = "        memory_recall_mode: 'LAYERED_REPO_MEMORY_V3',\n        active_thread_memory: 'BEST_EFFORT_WORKING_CONTEXT_V1',\n"
if health_new not in text:
    if health_anchor not in text:
        raise SystemExit('health memory anchor missing')
    text = text.replace(health_anchor, health_new, 1)

path.write_text(text, encoding='utf-8')
print('Active working-thread memory integration applied')
