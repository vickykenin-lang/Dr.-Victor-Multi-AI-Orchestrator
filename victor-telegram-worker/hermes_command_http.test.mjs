import test from 'node:test';
import assert from 'node:assert/strict';
import { computeHermesSignature } from './hermes_command_auth.mjs';
import { handleHermesHttpRequest } from './hermes_command_http.mjs';

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

function env() {
  return {
    HERMES_COMMAND_TOKEN: 'cmd-token',
    HERMES_WEBHOOK_SECRET: 'cmd-secret',
    HERMES_COMMAND_STORE: memoryKv(),
    TELEGRAM_WEBHOOK_SECRET: 'tg-secret',
    VICTOR_FOUNDER_CHAT_ID: '12345',
  };
}

test('health reports ready when auth and store are configured', async () => {
  const response = await handleHermesHttpRequest(new Request('https://example.com/v1/health'), env());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ready_for_authenticated_commands, true);
});

test('authenticated POST /v1/commands accepts and persists command', async () => {
  const runtime = env();
  const input = {
    command_id: 'cmd_test_1',
    source: 'chatgpt',
    actor: 'founder_authorized_assistant',
    target: 'rio',
    action: 'rio.status',
    payload: {},
    execution_mode: 'manual',
    idempotency_key: 'idem-test-1',
  };
  const raw = JSON.stringify(input);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await computeHermesSignature(runtime.HERMES_WEBHOOK_SECRET, timestamp, raw);
  const request = new Request('https://example.com/v1/commands', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer cmd-token',
      'X-Hermes-Timestamp': timestamp,
      'X-Hermes-Signature': signature,
      'X-Idempotency-Key': input.idempotency_key,
      'content-type': 'application/json',
    },
    body: raw,
  });

  const response = await handleHermesHttpRequest(request, runtime);
  assert.equal(response.status, 202);
  const accepted = await response.json();
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.execution, 'NOT_STARTED');

  const read = await handleHermesHttpRequest(new Request('https://example.com/v1/commands/cmd_test_1', {
    headers: { Authorization: 'Bearer cmd-token' },
  }), runtime);
  assert.equal(read.status, 200);
  const record = await read.json();
  assert.equal(record.command.action, 'rio.status');
});

test('invalid external auth is rejected', async () => {
  const runtime = env();
  const request = new Request('https://example.com/v1/commands', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer wrong',
      'X-Hermes-Timestamp': '1',
      'X-Hermes-Signature': 'sha256=bad',
      'X-Idempotency-Key': 'bad-1',
    },
    body: '{}',
  });
  const response = await handleHermesHttpRequest(request, runtime);
  assert.equal(response.status, 401);
});

test('telegram adapter accepts founder command and only persists it', async () => {
  const runtime = env();
  const update = {
    message: {
      message_id: 99,
      chat: { id: 12345 },
      from: { id: 12345 },
      text: '/rio status',
    },
  };
  const response = await handleHermesHttpRequest(new Request('https://example.com/integrations/telegram/webhook', {
    method: 'POST',
    headers: { 'X-Telegram-Bot-Api-Secret-Token': 'tg-secret' },
    body: JSON.stringify(update),
  }), runtime);
  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.accepted, true);
  assert.equal(body.execution, 'NOT_STARTED');
});
