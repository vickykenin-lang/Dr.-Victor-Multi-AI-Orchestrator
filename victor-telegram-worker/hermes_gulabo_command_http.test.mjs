import test from 'node:test';
import assert from 'node:assert/strict';

import { computeHermesSignature } from './hermes_command_auth.mjs';
import { authenticateGulaboCommandRequest, gulaboCommandAuthCapability } from './hermes_gulabo_command_http.mjs';

function replayStore() {
  const map = new Map();
  return {
    async get(key) { return map.get(key) ?? null; },
    async put(key, value) { map.set(key, value); },
  };
}

function freshTimestamp() {
  return String(Math.floor(Date.now() / 1000));
}

test('dedicated Gulabo command auth is isolated and fully configured', async () => {
  const env = {
    GULABO_HERMES_COMMAND_TOKEN: 'gulabo-token',
    GULABO_HERMES_COMMAND_SECRET: 'gulabo-secret',
    HERMES_COMMAND_STORE: replayStore(),
  };
  const capability = gulaboCommandAuthCapability(env);
  assert.equal(capability.token_configured, true);
  assert.equal(capability.secret_configured, true);
  assert.equal(capability.replay_store_configured, true);

  const raw = JSON.stringify({ command_id: 'cmd-1', idempotency_key: 'idem-1' });
  const timestamp = freshTimestamp();
  const signature = await computeHermesSignature('gulabo-secret', timestamp, raw);
  const request = new Request('https://example.com/v1/commands', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer gulabo-token',
      'X-Hermes-Timestamp': timestamp,
      'X-Hermes-Signature': signature,
      'X-Idempotency-Key': 'idem-1',
    },
    body: raw,
  });
  const result = await authenticateGulaboCommandRequest(request, env, raw, 'idem-1');
  assert.equal(result.ok, true);
});

test('wrong dedicated token is rejected without using primary Hermes credentials', async () => {
  const env = {
    GULABO_HERMES_COMMAND_TOKEN: 'gulabo-token',
    GULABO_HERMES_COMMAND_SECRET: 'gulabo-secret',
    API_VICTOR: 'primary-token',
    TELEGRAM_WEBHOOK_SECRET: 'primary-secret',
    HERMES_COMMAND_STORE: replayStore(),
  };
  const raw = JSON.stringify({ command_id: 'cmd-2', idempotency_key: 'idem-2' });
  const timestamp = freshTimestamp();
  const signature = await computeHermesSignature('gulabo-secret', timestamp, raw);
  const request = new Request('https://example.com/v1/commands', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer wrong-token',
      'X-Hermes-Timestamp': timestamp,
      'X-Hermes-Signature': signature,
      'X-Idempotency-Key': 'idem-2',
    },
    body: raw,
  });
  const result = await authenticateGulaboCommandRequest(request, env, raw, 'idem-2');
  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes('BEARER_INVALID'));
});
