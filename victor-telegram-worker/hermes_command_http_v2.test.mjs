import test from 'node:test';
import assert from 'node:assert/strict';
import { handleHermesHttpRequestV2, hermesHttpCapabilityV2 } from './hermes_command_http_v2.mjs';

function memoryKv() {
  const map = new Map();
  return {
    async get(key, options = {}) {
      const value = map.get(key);
      if (value == null) return null;
      if (options?.type === 'json') return JSON.parse(value);
      return value;
    },
    async put(key, value) { map.set(key, value); },
  };
}

function runtimeEnv() {
  return {
    API_VICTOR: 'existing-command-token',
    TELEGRAM_WEBHOOK_SECRET: 'tg-secret',
    TELEGRAM_BOT_TOKEN_VICTOR: 'tg-bot-token',
    VICTOR_FOUNDER_CHAT_ID: '12345',
    HERMES_COMMAND_STORE: memoryKv(),
    RIO_FLYER_TRANSPORT_ENABLED: 'false',
  };
}

function telegramRequest(text, secret = 'tg-secret', messageId = 101) {
  return new Request('https://example.com/telegram', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': secret,
    },
    body: JSON.stringify({
      update_id: messageId,
      message: {
        message_id: messageId,
        chat: { id: 12345 },
        from: { id: 12345 },
        text,
      },
    }),
  });
}

test('health can use existing production secrets during controlled cutover', () => {
  const capability = hermesHttpCapabilityV2(runtimeEnv());
  assert.equal(capability.ready_for_authenticated_commands, true);
  assert.equal(capability.command_token_source, 'API_VICTOR_FALLBACK');
  assert.equal(capability.webhook_secret_source, 'TELEGRAM_WEBHOOK_SECRET_FALLBACK');
});

test('ordinary Telegram conversation passes through to existing Victor runtime', async () => {
  const response = await handleHermesHttpRequestV2(telegramRequest('normal Victor conversation'), runtimeEnv());
  assert.equal(response, null);
});

test('Hermes slash command is handled on the existing /telegram webhook and replies to founder', async (t) => {
  const originalFetch = globalThis.fetch;
  let outbound = null;
  globalThis.fetch = async (url, init) => {
    outbound = { url: String(url), init };
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await handleHermesHttpRequestV2(telegramRequest('/rio status'), runtimeEnv());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.accepted, true);
  assert.equal(body.execution, 'COMPLETED');
  assert.equal(body.telegram_reply_sent, true);
  assert.match(outbound.url, /api\.telegram\.org\/bottg-bot-token\/sendMessage$/);
  const telegramBody = JSON.parse(outbound.init.body);
  assert.equal(String(telegramBody.chat_id), '12345');
  assert.match(telegramBody.text, /Hermes • rio\.status/);
  assert.match(telegramBody.text, /Flyer transport:/);
});

test('matched Hermes command with wrong Telegram secret is rejected before execution', async () => {
  const response = await handleHermesHttpRequestV2(telegramRequest('/hermes status', 'wrong-secret'), runtimeEnv());
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error, 'unauthorized');
});

test('flyer command keeps missing verified image fail-closed', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await handleHermesHttpRequestV2(telegramRequest('/rio flyer B0ABC123', 'tg-secret', 102), runtimeEnv());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.accepted, true);
  assert.equal(body.execution, 'BLOCKED');
  assert.equal(body.error_code, 'VERIFIED_PRODUCT_IMAGE_URL_REQUIRED');
});
