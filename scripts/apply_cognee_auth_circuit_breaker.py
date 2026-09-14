from pathlib import Path

worker = Path('victor-telegram-worker/worker.js')
text = worker.read_text(encoding='utf-8')

health_anchor = "        cognee_inference_runtime: 'DEDICATED_OPENAI_PATH_V1',\n"
health_line = "        cognee_auth_circuit_breaker: 'AUTH_401_403_HOLD_UNTIL_CREDENTIAL_CHANGE_V1',\n"
if "cognee_auth_circuit_breaker: 'AUTH_401_403_HOLD_UNTIL_CREDENTIAL_CHANGE_V1'" not in text:
    if health_anchor not in text:
        raise SystemExit('Cognee health anchor missing')
    text = text.replace(health_anchor, health_anchor + health_line, 1)

ack_health_anchor = "        cognee_auth_circuit_breaker: 'AUTH_401_403_HOLD_UNTIL_CREDENTIAL_CHANGE_V1',\n"
ack_health_line = "        telegram_webhook_ack_policy: 'HANDLED_ERRORS_HTTP_200_V1',\n"
if "telegram_webhook_ack_policy: 'HANDLED_ERRORS_HTTP_200_V1'" not in text:
    if ack_health_anchor not in text:
        raise SystemExit('Telegram ack health anchor missing')
    text = text.replace(ack_health_anchor, ack_health_anchor + ack_health_line, 1)

# Add a safe Telegram webhook health endpoint. It calls Telegram getWebhookInfo
# using the runtime bot token but never returns or logs the token itself.
webhook_route_anchor = "    if (request.method === 'GET' && ['/aura3-bridge-health', '/aura3-bridge-health/', '/aura3-health', '/aura3-health/'].includes(url.pathname)) {\n"
webhook_route = """    if (request.method === 'GET' && ['/telegram-webhook-health', '/telegram-webhook-health/'].includes(url.pathname)) {
      if (!env.TELEGRAM_BOT_TOKEN_VICTOR) {
        return json({
          service: 'telegram-webhook-health',
          status: 'TOKEN_NOT_CONFIGURED',
          bot_token_configured: false,
          secrets_exposed: false,
        }, 503);
      }
      try {
        const response = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN_VICTOR}/getWebhookInfo`, {
          method: 'GET',
          headers: { 'User-Agent': 'Dr-Victor-Telegram-Webhook-Health/1.0' },
        });
        const body = await response.json().catch(() => null);
        const info = body?.result || {};
        const configuredUrl = typeof info.url === 'string' ? info.url : '';
        const expectedUrl = `${url.origin}/telegram`;
        const urlMatches = Boolean(configuredUrl) && configuredUrl === expectedUrl;
        const telegramOk = response.ok && body?.ok === true;
        const status = !telegramOk
          ? 'TELEGRAM_API_ERROR'
          : !configuredUrl
            ? 'WEBHOOK_NOT_SET'
            : urlMatches
              ? 'WEBHOOK_CONFIGURED_MATCHING'
              : 'WEBHOOK_URL_MISMATCH';
        console.log(JSON.stringify({
          event: 'VICTOR_TELEGRAM_WEBHOOK_HEALTH',
          status,
          telegram_http_status: response.status,
          webhook_url_matches_expected: urlMatches,
          pending_update_count: Number(info.pending_update_count || 0),
          last_error_date: info.last_error_date || null,
          secrets_exposed: false,
        }));
        return json({
          service: 'telegram-webhook-health',
          status,
          telegram_api_ok: telegramOk,
          telegram_http_status: response.status,
          webhook_configured: Boolean(configuredUrl),
          webhook_url: configuredUrl || null,
          expected_webhook_url: expectedUrl,
          webhook_url_matches_expected: urlMatches,
          pending_update_count: Number(info.pending_update_count || 0),
          last_error_date: info.last_error_date || null,
          last_error_message: info.last_error_message || null,
          max_connections: info.max_connections || null,
          ip_address: info.ip_address || null,
          bot_token_configured: true,
          secrets_exposed: false,
        }, telegramOk && urlMatches ? 200 : 503);
      } catch (error) {
        console.error(JSON.stringify({
          event: 'VICTOR_TELEGRAM_WEBHOOK_HEALTH_FAILED',
          error_name: error?.name || 'Error',
          error_message: String(error?.message || 'unknown').slice(0, 300),
          secrets_exposed: false,
        }));
        return json({
          service: 'telegram-webhook-health',
          status: 'CHECK_FAILED',
          bot_token_configured: true,
          secrets_exposed: false,
        }, 503);
      }
    }

"""
if "service: 'telegram-webhook-health'" not in text:
    if webhook_route_anchor not in text:
        raise SystemExit('Telegram webhook health route anchor missing')
    text = text.replace(webhook_route_anchor, webhook_route + webhook_route_anchor, 1)

# Cognee-specific smoke-test commands must never be consumed by the generic
# inference diagnostic first. Keep the existing ordering safe by excluding any
# message that explicitly names Cognee from the generic matcher.
generic_old = "      const explicitInferenceDiagnostic = /\\b(live ai inference|ai inference test|inference test|bedrock model discovery|selected model|model discovery status|test bedrock|bedrock test)\\b/i.test(text);\n"
generic_new = "      const explicitInferenceDiagnostic = !/\\bcognee\\b/i.test(text) && /\\b(live ai inference|ai inference test|inference test|bedrock model discovery|selected model|model discovery status|test bedrock|bedrock test)\\b/i.test(text);\n"
if generic_old in text:
    text = text.replace(generic_old, generic_new, 1)
elif generic_new not in text:
    raise SystemExit('Generic inference diagnostic anchor missing')

# Log accepted Telegram messages without storing the Founder text or secrets.
trace_anchor = "    const traceId = buildTraceId(update?.update_id, message.message_id);\n"
trace_log = """    console.log(JSON.stringify({
      event: 'VICTOR_TELEGRAM_MESSAGE_ACCEPTED',
      trace_id: traceId,
      message_id: message.message_id,
      chat_authorized: true,
      secrets_exposed: false,
    }));
"""
if "event: 'VICTOR_TELEGRAM_MESSAGE_ACCEPTED'" not in text:
    if trace_anchor not in text:
        raise SystemExit('Telegram trace anchor missing')
    text = text.replace(trace_anchor, trace_anchor + trace_log, 1)

# A handled webhook failure must be acknowledged with HTTP 200 so Telegram does
# not redeliver the same update. The failure remains explicit in the JSON body
# and in structured logs.
text = text.replace(
    "return json({ ok: false, mode: 'LIVE_AI_INFERENCE_DIAGNOSTIC', status: 'INFERENCE_DISABLED' }, 503);",
    "return json({ ok: false, mode: 'LIVE_AI_INFERENCE_DIAGNOSTIC', status: 'INFERENCE_DISABLED', acknowledged: true }, 200);",
)
text = text.replace(
    "return json({ ok: false, mode: 'LIVE_AI_INFERENCE_DIAGNOSTIC', status: 'CREDENTIAL_MISSING' }, 503);",
    "return json({ ok: false, mode: 'LIVE_AI_INFERENCE_DIAGNOSTIC', status: 'CREDENTIAL_MISSING', acknowledged: true }, 200);",
)
text = text.replace(
    "return json({ ok: false, mode: 'LIVE_AI_INFERENCE_DIAGNOSTIC', status: 'FAILED', code, secrets_exposed: false }, 503);",
    "return json({ ok: false, mode: 'LIVE_AI_INFERENCE_DIAGNOSTIC', status: 'FAILED', code, acknowledged: true, secrets_exposed: false }, 200);",
)
text = text.replace(
    "return json({ ok: false, mode: 'LIVE_COGNEE_INFERENCE_DIAGNOSTIC', status: 'CREDENTIAL_MISSING', credential_source: 'VICTOR_COGNEE_API' }, 503);",
    "return json({ ok: false, mode: 'LIVE_COGNEE_INFERENCE_DIAGNOSTIC', status: 'CREDENTIAL_MISSING', credential_source: 'VICTOR_COGNEE_API', acknowledged: true }, 200);",
)

# Emit a deterministic route-entry event before any upstream Cognee call. This
# proves that Victor classified and began processing the command even if Bedrock
# later rejects the credential.
cognee_try_anchor = """        try {
          const result = await callCogneeInference(
"""
cognee_route_log = """        try {
          console.log(JSON.stringify({
            event: 'VICTOR_COGNEE_DIAGNOSTIC_MATCHED',
            trace_id: traceId,
            credential_source: 'VICTOR_COGNEE_API',
            api_victor_fallback: false,
            secrets_exposed: false,
          }));
          const result = await callCogneeInference(
"""
if "event: 'VICTOR_COGNEE_DIAGNOSTIC_MATCHED'" not in text:
    if cognee_try_anchor not in text:
        raise SystemExit('Cognee route anchor missing')
    text = text.replace(cognee_try_anchor, cognee_route_log, 1)

old = """        } catch (error) {
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
"""

new = """        } catch (error) {
          const code = error?.code || 'COGNEE_INFERENCE_FAILED';
          const detail = error?.httpStatus ? ` HTTP ${error.httpStatus}.` : '';
          const suppressed = Boolean(error?.suppressNotification);
          if (!suppressed) {
            const messageText = code === 'COGNEE_AUTH_BLOCKED'
              ? `Cognee auth blocked.${detail} Same credential par retries hold kar diye gaye hain; VICTOR_COGNEE_API change hone ke baad automatically retry allow hoga. API_VICTOR fallback nahi kiya gaya.`
              : `Cognee live inference FAILED. Runtime code: ${code}.${detail} API_VICTOR fallback nahi kiya gaya.`;
            await sendTelegramMessage(env, chatId, messageText, message.message_id);
          }
          console.log(JSON.stringify({
            event: 'VICTOR_COGNEE_INFERENCE_BLOCKED',
            trace_id: traceId,
            code,
            http_status: error?.httpStatus || null,
            notification_suppressed: suppressed,
            credential_change_required: Boolean(error?.credentialChangeRequired),
            secrets_exposed: false,
          }));
          return json({
            ok: false,
            mode: 'LIVE_COGNEE_INFERENCE_DIAGNOSTIC',
            status: code === 'COGNEE_AUTH_BLOCKED' ? 'AUTH_BLOCKED' : 'FAILED',
            code,
            http_status: error?.httpStatus || null,
            discovery_status: error?.discoveryStatus || null,
            credential_source: 'VICTOR_COGNEE_API',
            api_victor_fallback: false,
            notification_suppressed: suppressed,
            credential_change_required: Boolean(error?.credentialChangeRequired),
            acknowledged: true,
            secrets_exposed: false,
          }, 200);
        }
"""

if old in text:
    text = text.replace(old, new, 1)
else:
    # Existing circuit-breaker block: enrich it with trace/ack evidence if needed.
    if "event: 'VICTOR_COGNEE_INFERENCE_BLOCKED'" not in text:
        raise SystemExit('Cognee diagnostic catch anchor missing')
    text = text.replace(
        "            event: 'VICTOR_COGNEE_INFERENCE_BLOCKED',\n            code,",
        "            event: 'VICTOR_COGNEE_INFERENCE_BLOCKED',\n            trace_id: traceId,\n            code,",
        1,
    )
    text = text.replace(
        "            credential_change_required: Boolean(error?.credentialChangeRequired),\n            secrets_exposed: false,",
        "            credential_change_required: Boolean(error?.credentialChangeRequired),\n            acknowledged: true,\n            secrets_exposed: false,",
        1,
    )

worker.write_text(text, encoding='utf-8')
print('COGNEE_AUTH_CIRCUIT_BREAKER_TELEGRAM_ACK_AND_WEBHOOK_HEALTH_APPLIED')
