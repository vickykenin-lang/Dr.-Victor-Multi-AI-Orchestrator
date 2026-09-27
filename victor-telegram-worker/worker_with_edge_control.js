import primaryWorker, { isAuthorizedFounderMessage } from './worker.js';
import { applyEdgeProxyControl, parseEdgeProxyControlCommand } from './edge_proxy_control.mjs';

const TELEGRAM_API = 'https://api.telegram.org';
const TELEGRAM_PRIMARY_DEADLINE_MS = 40_000;

function constantTimeEqual(a, b) {
  const left = new TextEncoder().encode(String(a || ''));
  const right = new TextEncoder().encode(String(b || ''));
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function acknowledge(env, chatId, messageId, text) {
  if (!env?.TELEGRAM_BOT_TOKEN_VICTOR || !chatId) return;
  try {
    await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN_VICTOR}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'Victor-Edge-Proxy-Control/1.0' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_to_message_id: messageId || undefined,
        allow_sending_without_reply: true,
      }),
    });
  } catch {
    // Control result remains authoritative; acknowledgement delivery is best-effort only.
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function runPrimaryWithTelegramDeadline(request, env, ctx, message = null) {
  let timer;
  const deadline = new Promise(resolve => {
    timer = setTimeout(async () => {
      const chatId = String(message?.chat?.id ?? '');
      const senderId = String(message?.from?.id ?? '');
      if (message && isAuthorizedFounderMessage(env, chatId, senderId)) {
        await acknowledge(
          env,
          chatId,
          message?.message_id,
          'Victor ne request receive kar li, lekin processing Telegram response window ke andar complete nahi hui. Koi action completed claim nahi kiya gaya. Main silent retry loop me nahi jaunga.',
        );
      }
      console.warn(JSON.stringify({
        event: 'VICTOR_TELEGRAM_PRIMARY_DEADLINE',
        deadline_ms: TELEGRAM_PRIMARY_DEADLINE_MS,
        message_id: message?.message_id || null,
        founder_authorized: Boolean(message && isAuthorizedFounderMessage(env, chatId, senderId)),
        secrets_exposed: false,
      }));
      resolve(json({
        ok: true,
        mode: 'TELEGRAM_PROCESSING_DEADLINE',
        status: 'PROCESSING_NOT_COMPLETED_WITHIN_RESPONSE_WINDOW',
        action_completed_claimed: false,
        telegram_retry_suppressed: true,
        secrets_exposed: false,
      }, 200));
    }, TELEGRAM_PRIMARY_DEADLINE_MS);
  });

  try {
    return await Promise.race([
      primaryWorker.fetch(request, env, ctx),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export default {
  scheduled(controller, env, ctx) {
    return primaryWorker.scheduled(controller, env, ctx);
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let parsedTelegramMessage = null;

    if (request.method === 'POST' && url.pathname === '/telegram' && env?.TELEGRAM_WEBHOOK_SECRET) {
      const supplied = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
      if (constantTimeEqual(supplied, env.TELEGRAM_WEBHOOK_SECRET)) {
        try {
          const update = await request.clone().json();
          const message = update?.message;
          parsedTelegramMessage = message || null;
          const command = parseEdgeProxyControlCommand(message?.text || '');
          const chatId = String(message?.chat?.id ?? '');
          const senderId = String(message?.from?.id ?? '');

          if (command && isAuthorizedFounderMessage(env, chatId, senderId)) {
            const result = await applyEdgeProxyControl(env, command);
            const failureDetail = result.telegram_description ? ` — ${result.telegram_description}` : '';
            const safeText = result.ok
              ? command.action === 'CUTOVER'
                ? 'Victor edge proxy cutover applied. Telegram webhook ab governed edge ingress par hai.'
                : 'Victor edge proxy rollback applied. Telegram webhook direct primary ingress par restore ho gaya.'
              : `Victor edge proxy ${command.action.toLowerCase()} failed: ${result.status}${failureDetail}. No success claimed.`;

            await acknowledge(env, chatId, message?.message_id, safeText);
            return json({
              ok: result.ok,
              mode: 'EDGE_PROXY_CONTROL',
              status: result.status,
              action: command.action,
              target_url: result.target_url || command.target_url,
              telegram_http_status: result.telegram_http_status || null,
              telegram_error_code: result.telegram_error_code || null,
              telegram_description: result.telegram_description || null,
              production_autonomy_changed: false,
              secrets_exposed: false,
            }, 200);
          }
        } catch {
          // Preserve the primary Worker's original validation/error behavior.
        }
      }
    }

    if (request.method === 'POST' && url.pathname === '/telegram') {
      return runPrimaryWithTelegramDeadline(request, env, ctx, parsedTelegramMessage);
    }

    return primaryWorker.fetch(request, env, ctx);
  },
};

export { constantTimeEqual, runPrimaryWithTelegramDeadline, TELEGRAM_PRIMARY_DEADLINE_MS };
