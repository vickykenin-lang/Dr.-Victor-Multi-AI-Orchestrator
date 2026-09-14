from pathlib import Path

worker = Path('victor-telegram-worker/worker.js')
text = worker.read_text(encoding='utf-8')

# 1) Imports
core_import = "import { autonomyConfigured, persistAutonomyEvidence, runAutonomousCycle } from './autonomy_runtime.mjs';\n"
router_import = "import { callVictorModel } from './model_router.mjs';\n"
if router_import not in text:
    if core_import not in text:
        raise SystemExit('model router import anchor missing')
    text = text.replace(core_import, core_import + router_import, 1)

active_import = "import { buildActiveContext, appendRecentTurn, formatActiveContextForPrompt } from '../brain/active_context.mjs';\n"
anti_import = "import { detectDeadEndLoop, buildDeadEndRecoveryPrompt, buildNonRepetitionDirective } from '../brain/anti_bogus_runtime.mjs';\n"
if anti_import not in text:
    if active_import not in text:
        raise SystemExit('anti-bogus import anchor missing')
    text = text.replace(active_import, active_import + anti_import, 1)

# 2) Safe health metadata. Booleans only; never secret values.
health_anchor = "        ai_inference_enabled: env.ENABLE_AI_INFERENCE === 'true',\n"
health_repl = (
    "        ai_inference_enabled: env.ENABLE_AI_INFERENCE === 'true',\n"
    "        ai_credential_configured: Boolean(env.API_VICTOR),\n"
    "        cognee_inference_credential_configured: Boolean(env.VICTOR_COGNEE_API),\n"
    "        model_router: 'BEDROCK_DISCOVERY_SPECIALIST_V1',\n"
    "        anti_bogus_runtime: 'DEAD_END_RECOVERY_V1',\n"
)
if "model_router: 'BEDROCK_DISCOVERY_SPECIALIST_V1'" not in text:
    if health_anchor not in text:
        raise SystemExit('health anchor missing')
    text = text.replace(health_anchor, health_repl, 1)

# 3) Detect repeated unresolved answers using conversation state.
owned_anchor = "      const ownedProblem = classifyOwnedProblem(text, sessionWithFounderTurn);\n"
dead_line = "      const deadEnd = detectDeadEndLoop(text, sessionWithFounderTurn);\n"
if dead_line not in text:
    if owned_anchor not in text:
        raise SystemExit('dead-end classification anchor missing')
    text = text.replace(owned_anchor, owned_anchor + dead_line, 1)

# 4) Dead-end recovery must happen before generic fact/status paths so Victor acts instead of repeating.
hulk_end = "        return json({ ok: true, mode: hulkRequest.mode, target: 'hulk', dispatch: 'NOT_ATTEMPTED_BRIDGE_UNVERIFIED' });\n      }\n\n"
dead_block = """      if (!memoryDirective && deadEnd.matched && ['rio', 'tony_stark', 'aura3'].includes(deadEnd.target)) {
        processingStage = 'DEAD_END_RECOVERY';
        const recoveryText = buildDeadEndRecoveryPrompt(deadEnd, text);
        const dispatch = await dispatchContextualInvestigation(env, deadEnd.target, recoveryText, { messageId: message.message_id });
        await writeConversationSession(chatId, {
          last_target: deadEnd.target,
          last_task_id: dispatch.taskId,
          last_task_type: 'DEAD_END_RECOVERY',
          active_issue: text,
          unresolved_question: text,
          task_state: 'DEAD_END_RECOVERY_RUNNING',
          dead_end_reason: deadEnd.reason,
          dead_end_repeat_count: deadEnd.repeated_count || 1,
        }, env);
        await sendTelegramMessage(env, chatId, 'Same unresolved answer repeat nahi karunga. Fresh diagnosis/recovery task start kar diya hai; next update fresh evidence ya exact Founder-only blocker ke saath hoga.', message.message_id);
        if (deadEnd.target === 'rio') ctx?.waitUntil(handleRioRoundTrip(env, chatId, dispatch, message.message_id));
        else if (deadEnd.target === 'tony_stark') ctx?.waitUntil(handleTonyRoundTrip(env, chatId, dispatch, message.message_id));
        else if (deadEnd.target === 'aura3') ctx?.waitUntil(handleAura3RoundTrip(env, chatId, dispatch, message.message_id));
        return json({ ok: true, mode: 'DEAD_END_RECOVERY', target: deadEnd.target, task_id: dispatch.taskId });
      }

"""
if "mode: 'DEAD_END_RECOVERY'" not in text:
    if hulk_end not in text:
        raise SystemExit('dead-end insertion anchor missing')
    text = text.replace(hulk_end, hulk_end + dead_block, 1)

# 5) Inject anti-repetition contract into governed system prompt.
prompt_anchor = "${memory.prompt}\n\nRUNTIME RULES:"
prompt_repl = "${memory.prompt}\n\n${buildNonRepetitionDirective(activeSession)}\n\nRUNTIME RULES:"
if "${buildNonRepetitionDirective(activeSession)}" not in text:
    if prompt_anchor not in text:
        raise SystemExit('non-repetition prompt anchor missing')
    text = text.replace(prompt_anchor, prompt_repl, 1)

# 6) Replace single-model hard-coded inference with specialist router.
start_marker = "async function askModel(env, system, userMessage) {\n"
end_marker = "\nfunction codedError(code, message) {"
start = text.find(start_marker)
end = text.find(end_marker, start if start >= 0 else 0)
if start < 0 or end < 0:
    raise SystemExit('askModel replacement anchors missing')
new_ask = """async function askModel(env, system, userMessage) {
  try {
    const result = await callVictorModel(env, system, userMessage);
    console.log(JSON.stringify({
      event: 'VICTOR_MODEL_ROUTE',
      task: result.task,
      model: result.model,
      discovery_status: result.discovery_status,
      fallback_attempts: result.failures?.length || 0,
      secrets_exposed: false,
    }));
    return result.content;
  } catch (error) {
    if (error?.code === 'AI_CREDENTIAL_MISSING') throw codedError('AI_CREDENTIAL_MISSING', 'API_VICTOR is not configured');
    const routed = codedError(error?.code || 'AI_MODEL_ROUTER_EXHAUSTED', 'Victor specialist model router could not obtain a verified response');
    if (Array.isArray(error?.modelFailures)) routed.modelFailures = error.modelFailures;
    throw routed;
  }
}
"""
current = text[start:end]
if "callVictorModel(env, system, userMessage)" not in current:
    text = text[:start] + new_ask + text[end:]

# 7) Add user-facing error category for router exhaustion.
msg_anchor = "    AI_UPSTREAM_EMPTY_RESPONSE: 'Victor ke AI provider se blank response mila.',\n"
msg_repl = msg_anchor + "    AI_MODEL_ROUTER_EXHAUSTED: 'Victor ne available specialist models try kiye, lekin koi verified compatible response nahi mila.',\n"
if "AI_MODEL_ROUTER_EXHAUSTED:" not in text:
    if msg_anchor not in text:
        raise SystemExit('router error message anchor missing')
    text = text.replace(msg_anchor, msg_repl, 1)

worker.write_text(text, encoding='utf-8')
print('MODEL_TRUTH_RUNTIME_APPLIED')
