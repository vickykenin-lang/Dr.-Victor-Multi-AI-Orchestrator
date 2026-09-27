import primaryWorker from './worker.js';
import { applyEdgeProxyControl, parseEdgeProxyControlCommand } from './edge_proxy_control.mjs';

const TELEGRAM_API = 'https://api.telegram.org';

function constantTimeEqual(a, b) {
  const left = new TextEncoder().encode(String(a || ''));
  const right = new TextEncoder().encode(String(b || ''));
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

function founderAuthorized(env, chatId, senderId) {
  const founder = String(env?.VICTOR_FOUNDER_CHAT_ID || '').trim();
  return Boolean(founder) && String(chatId || '') === founder && String(senderId || '') === founder;
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

export default {
  scheduled(controller, env, ctx) {
    return primaryWorker.scheduled(controller, env, ctx);
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/telegram' && env?.TELEGRAM_WEBHOOK_SECRET) {
      const supplied = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
      if (constantTimeEqual(supplied, env.TELEGRAM_WEBHOOK_SECRET)) {
        try {
          const update = await request.clone().json();
          const message = update?.message;
          const command = parseEdgeProxyControlCommand(message?.text || '');
          const chatId = String(message?.chat?.id ?? '');
          const senderId = String(message?.from?.id ?? '');

          if (command && founderAuthorized(env, chatId, senderId)) {
            const result = await applyEdgeProxyControl(env, command);
            const safeText = result.ok
              ? command.action === 'CUTOVER'
                ? 'Victor edge proxy cutover applied. Telegram webhook ab governed edge ingress par hai.'
                : 'Victor edge proxy rollback applied. Telegram webhook direct primary ingress par restore ho gaya.'
              : `Victor edge proxy ${command.action.toLowerCase()} failed: ${result.status}. No success claimed.`;

            await acknowledge(env, chatId, message?.message_id, safeText);
            return json({
              ok: result.ok,
              mode: 'EDGE_PROXY_CONTROL',
              status: result.status,
              action: command.action,
              target_url: result.target_url || command.target_url,
              telegram_http_status: result.telegram_http_status || null,
              production_autonomy_changed: false,
              secrets_exposed: false,
            }, 200);
          }
        } catch {
          // Preserve the primary Worker's original validation/error behavior.
        }
      }
    }

    return primaryWorker.fetch(request, env, ctx);
  },
};

export { constantTimeEqual, founderAuthorized };
