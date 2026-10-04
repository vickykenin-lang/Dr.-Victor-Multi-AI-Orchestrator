function clean(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function configured(value) {
  return Boolean(clean(String(value ?? '')));
}

function callbackToken(env = {}) {
  return env.GULABO_HERMES_CALLBACK_TOKEN || env.API_VICTOR || '';
}

function callbackSecret(env = {}) {
  return env.GULABO_HERMES_CALLBACK_SECRET || env.TELEGRAM_WEBHOOK_SECRET || '';
}

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(secret, material) {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(material));
  return bytesToHex(signed);
}

export function gulaboBridgeSnapshot(env = {}) {
  const token = callbackToken(env);
  const secret = callbackSecret(env);
  return {
    service: 'gulabo-image-agent',
    api_base_url_configured: configured(env.GULABO_API_BASE_URL),
    callback_token_configured: configured(token),
    callback_secret_configured: configured(secret),
    callback_token_source: env.GULABO_HERMES_CALLBACK_TOKEN ? 'GULABO_HERMES_CALLBACK_TOKEN' : env.API_VICTOR ? 'API_VICTOR_FALLBACK' : 'NONE',
    callback_secret_source: env.GULABO_HERMES_CALLBACK_SECRET ? 'GULABO_HERMES_CALLBACK_SECRET' : env.TELEGRAM_WEBHOOK_SECRET ? 'TELEGRAM_WEBHOOK_SECRET_FALLBACK' : 'NONE',
    production_deployed: false,
    live_request_verified: false,
  };
}

export async function postGulaboCallback(env, path, payload, options = {}) {
  const baseUrl = clean(env.GULABO_API_BASE_URL, 1000).replace(/\/$/, '');
  const token = clean(callbackToken(env), 1000);
  const secret = clean(callbackSecret(env), 1000);
  if (!baseUrl || !token || !secret) {
    return {
      ok: false,
      http_status: null,
      body: null,
      error_code: 'GULABO_CALLBACK_NOT_CONFIGURED',
      live_request_verified: false,
    };
  }

  const raw = JSON.stringify(payload ?? {});
  const timestamp = String(Math.floor((options.nowMs ?? Date.now()) / 1000));
  const digest = await hmacSha256Hex(secret, `${timestamp}.${raw}`);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('GULABO_FETCH_UNAVAILABLE');

  const response = await fetchImpl(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Gulabo-Timestamp': timestamp,
      'X-Gulabo-Signature': `sha256=${digest}`,
    },
    body: raw,
  });

  let body;
  try {
    body = await response.json();
  } catch {
    body = { raw: String(await response.text()).slice(0, 1000) };
  }
  return {
    ok: response.ok,
    http_status: response.status,
    body,
    error_code: response.ok ? null : `GULABO_CALLBACK_HTTP_${response.status}`,
    live_request_verified: true,
  };
}
