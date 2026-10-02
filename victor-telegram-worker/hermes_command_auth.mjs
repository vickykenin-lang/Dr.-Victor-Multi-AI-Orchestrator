import { timingSafeEqual, createHmac } from 'node:crypto';

export const HERMES_AUTH_VERSION = 'HERMES_COMMAND_AUTH_V1';
export const DEFAULT_MAX_SKEW_SECONDS = 300;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toBuffer(value) {
  return Buffer.from(value, 'utf8');
}

export function parseBearerToken(header = '') {
  const match = /^Bearer\s+(.+)$/i.exec(clean(header));
  return match ? match[1].trim() : '';
}

export function verifyBearerToken(provided, expected) {
  const a = clean(provided);
  const b = clean(expected);
  if (!a || !b) return false;
  const ab = toBuffer(a);
  const bb = toBuffer(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function computeHermesSignature(secret, timestamp, rawBody) {
  const key = clean(secret);
  if (!key) throw new Error('HERMES_WEBHOOK_SECRET_REQUIRED');
  const canonical = `${timestamp}.${rawBody}`;
  return `sha256=${createHmac('sha256', key).update(canonical, 'utf8').digest('hex')}`;
}

export function verifyHermesSignature({ secret, timestamp, rawBody, signature }) {
  try {
    const expected = computeHermesSignature(secret, timestamp, rawBody);
    const provided = clean(signature);
    const a = toBuffer(provided);
    const b = toBuffer(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyTimestampFreshness(timestamp, { nowMs = Date.now(), maxSkewSeconds = DEFAULT_MAX_SKEW_SECONDS } = {}) {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return { ok: false, reason: 'TIMESTAMP_INVALID' };
  }
  const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - Math.floor(seconds));
  if (ageSeconds > maxSkewSeconds) {
    return { ok: false, reason: 'TIMESTAMP_OUTSIDE_WINDOW', age_seconds: ageSeconds };
  }
  return { ok: true, reason: 'TIMESTAMP_FRESH', age_seconds: ageSeconds };
}

export function buildReplayKey({ signature, timestamp, idempotencyKey }) {
  const material = `${clean(signature)}|${clean(String(timestamp))}|${clean(idempotencyKey)}`;
  return createHmac('sha256', 'hermes-replay-key-v1').update(material).digest('hex');
}

export async function checkReplayProtection({ store, replayKey, ttlSeconds = DEFAULT_MAX_SKEW_SECONDS }) {
  if (!store || typeof store.get !== 'function' || typeof store.put !== 'function') {
    return { ok: false, reason: 'REPLAY_STORE_NOT_CONFIGURED' };
  }
  const existing = await store.get(replayKey);
  if (existing) return { ok: false, reason: 'REPLAY_DETECTED' };
  await store.put(replayKey, '1', { expirationTtl: ttlSeconds });
  return { ok: true, reason: 'REPLAY_KEY_ACCEPTED' };
}

export async function authenticateHermesRequest({
  authorizationHeader,
  expectedBearerToken,
  timestamp,
  rawBody,
  signature,
  idempotencyKey,
  webhookSecret,
  replayStore,
  nowMs = Date.now(),
  maxSkewSeconds = DEFAULT_MAX_SKEW_SECONDS,
}) {
  const reasons = [];

  const bearer = parseBearerToken(authorizationHeader);
  if (!verifyBearerToken(bearer, expectedBearerToken)) reasons.push('BEARER_INVALID');

  const freshness = verifyTimestampFreshness(timestamp, { nowMs, maxSkewSeconds });
  if (!freshness.ok) reasons.push(freshness.reason);

  if (!verifyHermesSignature({ secret: webhookSecret, timestamp, rawBody, signature })) {
    reasons.push('SIGNATURE_INVALID');
  }

  if (!clean(idempotencyKey)) reasons.push('IDEMPOTENCY_KEY_REQUIRED');

  if (reasons.length) {
    return {
      ok: false,
      reasons,
      auth_version: HERMES_AUTH_VERSION,
      replay_checked: false,
    };
  }

  const replayKey = buildReplayKey({ signature, timestamp, idempotencyKey });
  const replay = await checkReplayProtection({ store: replayStore, replayKey, ttlSeconds: maxSkewSeconds });
  if (!replay.ok) {
    return {
      ok: false,
      reasons: [replay.reason],
      auth_version: HERMES_AUTH_VERSION,
      replay_checked: true,
    };
  }

  return {
    ok: true,
    reasons: [],
    auth_version: HERMES_AUTH_VERSION,
    replay_checked: true,
    replay_key: replayKey,
  };
}
