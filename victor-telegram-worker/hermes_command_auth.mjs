export const HERMES_AUTH_VERSION = 'HERMES_COMMAND_AUTH_V1';
export const DEFAULT_MAX_SKEW_SECONDS = 300;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function encoder() {
  return new TextEncoder();
}

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeStringEqual(a, b) {
  const left = clean(a);
  const right = clean(b);
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export function parseBearerToken(header = '') {
  const match = /^Bearer\s+(.+)$/i.exec(clean(header));
  return match ? match[1].trim() : '';
}

export function verifyBearerToken(provided, expected) {
  return constantTimeStringEqual(provided, expected);
}

async function hmacHex(secret, material) {
  const key = clean(secret);
  if (!key) throw new Error('HERMES_WEBHOOK_SECRET_REQUIRED');
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder().encode(material));
  return bytesToHex(new Uint8Array(signature));
}

export async function computeHermesSignature(secret, timestamp, rawBody) {
  const canonical = `${timestamp}.${rawBody}`;
  return `sha256=${await hmacHex(secret, canonical)}`;
}

export async function verifyHermesSignature({ secret, timestamp, rawBody, signature }) {
  try {
    const expected = await computeHermesSignature(secret, timestamp, rawBody);
    return constantTimeStringEqual(signature, expected);
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

export async function buildReplayKey({ signature, timestamp, idempotencyKey }) {
  const material = `${clean(signature)}|${clean(String(timestamp))}|${clean(idempotencyKey)}`;
  return hmacHex('hermes-replay-key-v1', material);
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

  if (!(await verifyHermesSignature({ secret: webhookSecret, timestamp, rawBody, signature }))) {
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

  const replayKey = await buildReplayKey({ signature, timestamp, idempotencyKey });
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
