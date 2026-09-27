const EDGE_PROXY_WEBHOOK_URL = 'https://victor-edge-proxy.vickykenin.workers.dev/telegram';
const PRIMARY_WEBHOOK_URL = 'https://victor-telegram-webhook.vickykenin.workers.dev/telegram';

export function parseEdgeProxyControlCommand(text = '') {
  const value = String(text || '').trim().toUpperCase();
  if (value === 'VICTOR EDGE PROXY CUTOVER') return { action: 'CUTOVER', target_url: EDGE_PROXY_WEBHOOK_URL };
  if (value === 'VICTOR EDGE PROXY ROLLBACK') return { action: 'ROLLBACK', target_url: PRIMARY_WEBHOOK_URL };
  return null;
}

function safeTelegramDescription(body) {
  const value = typeof body?.description === 'string' ? body.description.trim() : '';
  if (!value) return null;
  return value.slice(0, 240).replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot[REDACTED]');
}

export async function applyEdgeProxyControl(env, command, fetchImpl = fetch) {
  if (!command?.target_url) return { ok: false, status: 'INVALID_COMMAND', secrets_exposed: false };
  if (!env?.TELEGRAM_BOT_TOKEN_VICTOR || !env?.TELEGRAM_WEBHOOK_SECRET) {
    return { ok: false, status: 'CONFIGURATION_INCOMPLETE', secrets_exposed: false };
  }

  let response;
  try {
    response = await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN_VICTOR}/setWebhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Victor-Edge-Proxy-Control/1.0',
      },
      body: JSON.stringify({
        url: command.target_url,
        secret_token: env.TELEGRAM_WEBHOOK_SECRET,
        max_connections: 40,
        drop_pending_updates: false,
      }),
    });
  } catch {
    return { ok: false, status: 'TELEGRAM_API_UNREACHABLE', secrets_exposed: false };
  }

  const body = await response.json().catch(() => null);
  const ok = response.ok && body?.ok === true;
  return {
    ok,
    status: ok ? `EDGE_PROXY_${command.action}_APPLIED` : 'TELEGRAM_SET_WEBHOOK_FAILED',
    action: command.action,
    target_url: command.target_url,
    telegram_http_status: response.status,
    telegram_ok: body?.ok === true,
    telegram_error_code: Number.isFinite(Number(body?.error_code)) ? Number(body.error_code) : null,
    telegram_description: ok ? null : safeTelegramDescription(body),
    secrets_exposed: false,
  };
}

export { EDGE_PROXY_WEBHOOK_URL, PRIMARY_WEBHOOK_URL, safeTelegramDescription };
