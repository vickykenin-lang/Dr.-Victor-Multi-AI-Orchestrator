import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticateHermesRequest,
  computeHermesSignature,
  parseBearerToken,
  verifyBearerToken,
  verifyHermesSignature,
  verifyTimestampFreshness,
} from './hermes_command_auth.mjs';

function memoryReplayStore() {
  const map = new Map();
  return {
    async get(key) { return map.get(key) || null; },
    async put(key, value) { map.set(key, value); },
  };
}

test('bearer parsing and constant-time compare accept exact token', () => {
  assert.equal(parseBearerToken('Bearer abc123'), 'abc123');
  assert.equal(verifyBearerToken('abc123', 'abc123'), true);
  assert.equal(verifyBearerToken('abc123', 'abc124'), false);
});

test('HMAC signature verifies canonical timestamp.body payload', () => {
  const secret = 'secret';
  const timestamp = '1790910300';
  const rawBody = '{"hello":"world"}';
  const signature = computeHermesSignature(secret, timestamp, rawBody);
  assert.equal(verifyHermesSignature({ secret, timestamp, rawBody, signature }), true);
  assert.equal(verifyHermesSignature({ secret, timestamp, rawBody: '{}', signature }), false);
});

test('timestamp freshness fails closed outside five minute window', () => {
  const nowMs = 1_790_910_300_000;
  assert.equal(verifyTimestampFreshness('1790910300', { nowMs }).ok, true);
  const stale = verifyTimestampFreshness('1790900000', { nowMs });
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, 'TIMESTAMP_OUTSIDE_WINDOW');
});

test('full auth accepts first request and blocks replay', async () => {
  const expectedBearerToken = 'token-1';
  const webhookSecret = 'hook-secret';
  const timestamp = '1790910300';
  const rawBody = '{"command_id":"cmd_1"}';
  const signature = computeHermesSignature(webhookSecret, timestamp, rawBody);
  const replayStore = memoryReplayStore();
  const base = {
    authorizationHeader: 'Bearer token-1',
    expectedBearerToken,
    timestamp,
    rawBody,
    signature,
    idempotencyKey: 'idem-1',
    webhookSecret,
    replayStore,
    nowMs: 1_790_910_300_000,
  };

  const first = await authenticateHermesRequest(base);
  assert.equal(first.ok, true);

  const second = await authenticateHermesRequest(base);
  assert.equal(second.ok, false);
  assert.deepEqual(second.reasons, ['REPLAY_DETECTED']);
});

test('full auth rejects missing or invalid security material before replay write', async () => {
  const result = await authenticateHermesRequest({
    authorizationHeader: 'Bearer wrong',
    expectedBearerToken: 'expected',
    timestamp: '1',
    rawBody: '{}',
    signature: 'sha256=bad',
    idempotencyKey: '',
    webhookSecret: 'secret',
    replayStore: memoryReplayStore(),
    nowMs: 1_790_910_300_000,
  });
  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes('BEARER_INVALID'));
  assert.ok(result.reasons.includes('TIMESTAMP_OUTSIDE_WINDOW'));
  assert.ok(result.reasons.includes('SIGNATURE_INVALID'));
  assert.ok(result.reasons.includes('IDEMPOTENCY_KEY_REQUIRED'));
  assert.equal(result.replay_checked, false);
});
