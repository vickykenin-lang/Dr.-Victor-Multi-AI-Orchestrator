from pathlib import Path

worker = Path('victor-telegram-worker/worker.js')
text = worker.read_text(encoding='utf-8')

health_anchor = "        cognee_inference_runtime: 'DEDICATED_OPENAI_PATH_V1',\n"
health_line = "        cognee_auth_circuit_breaker: 'AUTH_401_403_HOLD_UNTIL_CREDENTIAL_CHANGE_V1',\n"
if "cognee_auth_circuit_breaker: 'AUTH_401_403_HOLD_UNTIL_CREDENTIAL_CHANGE_V1'" not in text:
    if health_anchor not in text:
        raise SystemExit('Cognee health anchor missing')
    text = text.replace(health_anchor, health_anchor + health_line, 1)

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
            secrets_exposed: false,
          }, 200);
        }
"""

if old in text:
    text = text.replace(old, new, 1)
elif "notification_suppressed: suppressed" not in text:
    raise SystemExit('Cognee diagnostic catch anchor missing')

worker.write_text(text, encoding='utf-8')
print('COGNEE_AUTH_CIRCUIT_BREAKER_APPLIED')
