from pathlib import Path

worker = Path('victor-telegram-worker/worker.js')
text = worker.read_text(encoding='utf-8')

# 1) Imports
core_import = "import { autonomyConfigured, persistAutonomyEvidence, runAutonomousCycle } from './autonomy_runtime.mjs';\n"
old_router_import = "import { callVictorModel } from './model_router.mjs';\n"
router_import = "import { callVictorModel, callCogneeInference } from './model_router.mjs';\n"
if old_router_import in text and router_import not in text:
    text = text.replace(old_router_import, router_import, 1)
elif router_import not in text:
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

integrity_health_anchor = "        anti_bogus_runtime: 'DEAD_END_RECOVERY_V1',\n"
integrity_health_line = "        response_integrity: 'INDEPENDENT_EVIDENCE_LOCK_V1',\n"
if "response_integrity: 'INDEPENDENT_EVIDENCE_LOCK_V1'" not in text:
    if integrity_health_anchor not in text:
        raise SystemExit('response integrity health anchor missing')
    text = text.replace(integrity_health_anchor, integrity_health_anchor + integrity_health_line, 1)

cognee_health_anchor = "        cognee_inference_credential_configured: Boolean(env.VICTOR_COGNEE_API),\n"
cognee_health_line = "        cognee_inference_runtime: 'DEDICATED_OPENAI_PATH_V1',\n"
if "cognee_inference_runtime: 'DEDICATED_OPENAI_PATH_V1'" not in text:
    if cognee_health_anchor not in text:
        raise SystemExit('cognee health anchor missing')
    text = text.replace(cognee_health_anchor, cognee_health_anchor + cognee_health_line, 1)

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

# 5) Explicit runtime inference diagnostics must bypass the GitHub fact gateway.
# Cognee smoke tests use VICTOR_COGNEE_API only and must never silently fall back to API_VICTOR.
fact_gateway_anchor = "      if (!memoryDirective && shouldUseFactGateway(founderRequest, factRequest)) {\n"
cognee_diag_block = """      const explicitCogneeInferenceDiagnostic = /\\b(cognee inference|cognee smoke|victor_cognee_api|cognee api|test cognee)\\b/i.test(text);
      if (!memoryDirective && explicitCogneeInferenceDiagnostic) {
        processingStage = 'LIVE_COGNEE_INFERENCE_DIAGNOSTIC';
        if (!env.VICTOR_COGNEE_API) {
          await sendTelegramMessage(env, chatId, 'Cognee live inference blocked hai: VICTOR_COGNEE_API runtime credential configured nahi hai.', message.message_id);
          return json({ ok: false, mode: 'LIVE_COGNEE_INFERENCE_DIAGNOSTIC', status: 'CREDENTIAL_MISSING', credential_source: 'VICTOR_COGNEE_API' }, 503);
        }
        try {
          const result = await callCogneeInference(
            env,
            'You are the dedicated Cognee inference diagnostic. Return one short harmless confirmation sentence only. Never reveal credentials, tokens, secrets, or keys.',
            'Reply briefly confirming this response came from the dedicated Cognee inference path.'
          );
          const safeContent = String(result.content || '').trim().slice(0, 500);
          const reply = [
            'Cognee live inference: VERIFIED',
            `Credential path: ${result.credential_source || 'VICTOR_COGNEE_API'}`,
            `Selected model: ${result.model || 'unknown'}`,
            `Bedrock model discovery: ${result.discovery_status || 'unknown'}`,
            `Live response: ${safeContent}`,
            'API_VICTOR fallback: no',
            'Secrets exposed: no',
          ].join('\\n');
          console.log(JSON.stringify({
            event: 'VICTOR_COGNEE_MODEL_ROUTE',
            model: result.model || null,
            discovery_status: result.discovery_status || null,
            credential_source: 'VICTOR_COGNEE_API',
            api_victor_fallback: false,
            secrets_exposed: false,
          }));
          await sendTelegramMessage(env, chatId, reply, message.message_id);
          return json({
            ok: true,
            mode: 'LIVE_COGNEE_INFERENCE_DIAGNOSTIC',
            status: 'VERIFIED',
            model: result.model || null,
            discovery_status: result.discovery_status || null,
            credential_source: 'VICTOR_COGNEE_API',
            api_victor_fallback: false,
            secrets_exposed: false,
          });
        } catch (error) {
          const code = error?.code || 'COGNEE_INFERENCE_FAILED';
          const detail = error?.httpStatus ? ` HTTP ${error.httpStatus}.` : '';
          await sendTelegramMessage(env, chatId, `Cognee live inference FAILED. Runtime code: ${code}.${detail} API_VICTOR fallback nahi kiya gaya.`, message.message_id);
          return json({
            ok: false,
            mode: 'LIVE_COGNEE_INFERENCE_DIAGNOSTIC',
            status: 'FAILED',
            code,
            http_status: error?.httpStatus || null,
            discovery_status: error?.discoveryStatus || null,
            credential_source: 'VICTOR_COGNEE_API',
            api_victor_fallback: false,
            secrets_exposed: false,
          }, 503);
        }
      }

"""
inference_diag_block = """      const explicitInferenceDiagnostic = /\\b(live ai inference|ai inference test|inference test|bedrock model discovery|selected model|model discovery status|test bedrock|bedrock test)\\b/i.test(text);
      if (!memoryDirective && explicitInferenceDiagnostic) {
        processingStage = 'LIVE_AI_INFERENCE_DIAGNOSTIC';
        if (env.ENABLE_AI_INFERENCE !== 'true') {
          await sendTelegramMessage(env, chatId, 'Live AI inference disabled hai: ENABLE_AI_INFERENCE=true required.', message.message_id);
          return json({ ok: false, mode: 'LIVE_AI_INFERENCE_DIAGNOSTIC', status: 'INFERENCE_DISABLED' }, 503);
        }
        if (!env.API_VICTOR) {
          await sendTelegramMessage(env, chatId, 'Live AI inference blocked hai: API_VICTOR runtime credential configured nahi hai.', message.message_id);
          return json({ ok: false, mode: 'LIVE_AI_INFERENCE_DIAGNOSTIC', status: 'CREDENTIAL_MISSING' }, 503);
        }
        try {
          const result = await callVictorModel(
            env,
            'You are Victor runtime diagnostic. Return one short harmless confirmation sentence only. Do not mention or expose any credential, token, secret, or key.',
            'Reply exactly with a brief confirmation that this is a live inference response.'
          );
          const safeContent = String(result.content || '').trim().slice(0, 500);
          const reply = [
            'Live AI inference: VERIFIED',
            `Task type: ${result.task || 'unknown'}`,
            `Selected model: ${result.model || 'unknown'}`,
            `Bedrock model discovery: ${result.discovery_status || 'unknown'}`,
            `Fallback attempts: ${result.failures?.length || 0}`,
            `Live response: ${safeContent}`,
            'Secrets exposed: no',
          ].join('\\n');
          await sendTelegramMessage(env, chatId, reply, message.message_id);
          return json({
            ok: true,
            mode: 'LIVE_AI_INFERENCE_DIAGNOSTIC',
            status: 'VERIFIED',
            task: result.task || null,
            model: result.model || null,
            discovery_status: result.discovery_status || null,
            fallback_attempts: result.failures?.length || 0,
            secrets_exposed: false,
          });
        } catch (error) {
          const code = error?.code || 'AI_MODEL_ROUTER_EXHAUSTED';
          await sendTelegramMessage(env, chatId, `Live AI inference FAILED. Runtime code: ${code}. Main generic GitHub status se is failure ko cover nahi karunga.`, message.message_id);
          return json({ ok: false, mode: 'LIVE_AI_INFERENCE_DIAGNOSTIC', status: 'FAILED', code, secrets_exposed: false }, 503);
        }
      }

"""
if "mode: 'LIVE_COGNEE_INFERENCE_DIAGNOSTIC'" not in text:
    if fact_gateway_anchor not in text:
        raise SystemExit('fact gateway anchor missing')
    text = text.replace(fact_gateway_anchor, cognee_diag_block + fact_gateway_anchor, 1)

if "mode: 'LIVE_AI_INFERENCE_DIAGNOSTIC'" not in text:
    if fact_gateway_anchor not in text:
        raise SystemExit('fact gateway anchor missing')
    text = text.replace(fact_gateway_anchor, inference_diag_block + fact_gateway_anchor, 1)

# 6) Inject anti-repetition contract into governed system prompt.
prompt_anchor = "${memory.prompt}\n\nRUNTIME RULES:"
prompt_repl = "${memory.prompt}\n\n${buildNonRepetitionDirective(activeSession)}\n\nRUNTIME RULES:"
if "${buildNonRepetitionDirective(activeSession)}" not in text:
    if prompt_anchor not in text:
        raise SystemExit('non-repetition prompt anchor missing')
    text = text.replace(prompt_anchor, prompt_repl, 1)

# 7) Every AI-generated Victor reply is bound to an independent-evidence integrity lock.
start_marker = "async function askModel(env, system, userMessage) {\n"
end_marker = "\nfunction codedError(code, message) {"
start = text.find(start_marker)
end = text.find(end_marker, start if start >= 0 else 0)
if start < 0 or end < 0:
    raise SystemExit('askModel replacement anchors missing')
new_ask = """async function askModel(env, system, userMessage) {
  const integritySystem = `${system}\n\nINDEPENDENT RESPONSE INTEGRITY LOCK — MANDATORY:\n- Report evidence exactly as observed; never change, soften, amplify, or reframe evidence to make an outcome look better or worse.\n- Never turn an assumption, absence of an error, configured credential, empty target list, cached state, historical record, or model-generated statement into PASS/SUCCESS/ACTIVE/VERIFIED.\n- If a requested fact was not independently observed, say UNVERIFIED / NOT OBSERVED / UNKNOWN.\n- Keep raw evidence and interpretation separate. If they conflict, raw fresh evidence wins.\n- Never invent a selected model, response, 2xx status, timestamp, target, receipt, heartbeat, deployment state, or business outcome.\n- A self-report by Victor, a department, memory, or another model is not independent proof of external runtime state.\n- If something is wrong, state what is wrong; do not cosmetically rewrite the result. Fixing happens as a separate action, never by manipulating the report.\n- Never expose credentials or secrets.`;
  try {
    const result = await callVictorModel(env, integritySystem, userMessage);
    const content = String(result.content || '').trim();
    const claimsSuccess = /\\b(pass|passed|success|successful|verified|active|healthy|live)\\b/i.test(content);
    const assumptionEvidence = /\\b(assum(?:e|ed|ing)|assume kiya|no error|error nahi|error not seen|error nahi dikh)\\b/i.test(content);
    const nullEvidence = /\\b(?:selected model|model|result|inference result)\\s*:\\s*(?:null|unknown|not specified|none)\\b/i.test(content);
    if (claimsSuccess && (assumptionEvidence || nullEvidence)) {
      throw Object.assign(new Error('Success claim is not independently supported by observed evidence'), {
        code: 'INDEPENDENT_EVIDENCE_REQUIRED',
      });
    }
    console.log(JSON.stringify({
      event: 'VICTOR_MODEL_ROUTE',
      task: result.task,
      model: result.model,
      discovery_status: result.discovery_status,
      fallback_attempts: result.failures?.length || 0,
      response_integrity: 'INDEPENDENT_EVIDENCE_LOCK_V1',
      secrets_exposed: false,
    }));
    return content;
  } catch (error) {
    if (error?.code === 'AI_CREDENTIAL_MISSING') throw codedError('AI_CREDENTIAL_MISSING', 'API_VICTOR is not configured');
    if (error?.code === 'INDEPENDENT_EVIDENCE_REQUIRED') {
      throw codedError('INDEPENDENT_EVIDENCE_REQUIRED', 'Victor draft blocked because the claimed outcome was not independently supported by observed evidence');
    }
    const routed = codedError(error?.code || 'AI_MODEL_ROUTER_EXHAUSTED', 'Victor specialist model router could not obtain a verified response');
    if (Array.isArray(error?.modelFailures)) routed.modelFailures = error.modelFailures;
    throw routed;
  }
}
"""
text = text[:start] + new_ask + text[end:]

# 8) Add user-facing error categories.
msg_anchor = "    AI_UPSTREAM_EMPTY_RESPONSE: 'Victor ke AI provider se blank response mila.',\n"
msg_repl = msg_anchor + "    AI_MODEL_ROUTER_EXHAUSTED: 'Victor ne available specialist models try kiye, lekin koi verified compatible response nahi mila.',\n" + "    INDEPENDENT_EVIDENCE_REQUIRED: 'Victor ka draft block hua kyunki claimed result independent fresh evidence se prove nahi tha.',\n"
if "INDEPENDENT_EVIDENCE_REQUIRED:" not in text:
    if msg_anchor not in text:
        raise SystemExit('router error message anchor missing')
    if "AI_MODEL_ROUTER_EXHAUSTED:" in text:
        text = text.replace("    AI_MODEL_ROUTER_EXHAUSTED: 'Victor ne available specialist models try kiye, lekin koi verified compatible response nahi mila.',\n", "    AI_MODEL_ROUTER_EXHAUSTED: 'Victor ne available specialist models try kiye, lekin koi verified compatible response nahi mila.',\n    INDEPENDENT_EVIDENCE_REQUIRED: 'Victor ka draft block hua kyunki claimed result independent fresh evidence se prove nahi tha.',\n", 1)
    else:
        text = text.replace(msg_anchor, msg_repl, 1)

worker.write_text(text, encoding='utf-8')
print('MODEL_TRUTH_RUNTIME_APPLIED')
