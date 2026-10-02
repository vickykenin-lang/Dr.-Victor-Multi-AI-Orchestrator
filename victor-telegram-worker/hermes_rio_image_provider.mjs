const MODEL = '@cf/black-forest-labs/flux-2-klein-9b';
const USAGE_VERSION = 'HERMES_RIO_IMAGE_USAGE_V1';
const ASSET_PREFIX = 'rio:flyer:asset:';
const RESULT_PREFIX = 'rio:flyer:result:';
const USAGE_PREFIX = 'rio:image:usage:';

export const HERMES_RIO_IMAGE_PROVIDER_VERSION = 'HERMES_RIO_CENTRAL_IMAGE_PROVIDER_V1';

function clean(value, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function numberEnv(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function safeId(value, max = 180) {
  const id = clean(value, max);
  return /^[A-Za-z0-9._-]+$/.test(id) ? id : '';
}

function randomId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function isPrivateIpv4(hostname) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!m) return false;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function validateCentralProductImageUrl(value) {
  const raw = clean(value, 1500);
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:') return { ok: false, error_code: 'VERIFIED_PRODUCT_IMAGE_URL_REQUIRED' };
    if (!host || host === 'localhost' || host.endsWith('.local') || isPrivateIpv4(host)) {
      return { ok: false, error_code: 'PRODUCT_IMAGE_HOST_NOT_ALLOWED' };
    }
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false, error_code: 'VERIFIED_PRODUCT_IMAGE_URL_REQUIRED' };
  }
}

export function centralRioImageCapability(env = {}) {
  const ai = Boolean(env.AI && typeof env.AI.run === 'function');
  const store = Boolean(env.HERMES_COMMAND_STORE && typeof env.HERMES_COMMAND_STORE.get === 'function' && typeof env.HERMES_COMMAND_STORE.put === 'function');
  const limit = numberEnv(env.RIO_IMAGE_MONTHLY_PROVIDER_CALL_LIMIT, 30);
  return {
    provider_version: HERMES_RIO_IMAGE_PROVIDER_VERSION,
    provider_mode: 'CENTRAL_WORKERS_AI_BINDING',
    provider: 'cloudflare-workers-ai',
    model: MODEL,
    workers_ai_binding_configured: ai,
    asset_store_configured: store,
    credential_transfer_required: false,
    credential_transfer_performed: false,
    monthly_provider_call_limit: limit,
    quota_counter_atomic: false,
    ready_for_preflight: ai && store,
    ready_for_generation: ai && store,
  };
}

function pngDimensions(bytes) {
  if (bytes.length < 24) return null;
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!sig.every((v, i) => bytes[i] === v)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false), format: 'png' };
}

function gifDimensions(bytes) {
  if (bytes.length < 10) return null;
  const header = String.fromCharCode(...bytes.slice(0, 6));
  if (header !== 'GIF87a' && header !== 'GIF89a') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint16(6, true), height: view.getUint16(8, true), format: 'gif' };
}

function jpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 1 >= bytes.length) break;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    if (sof.has(marker) && length >= 7) {
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return { width, height, format: 'jpeg' };
    }
    offset += length;
  }
  return null;
}

export function detectImageDimensions(arrayBuffer, contentType = '') {
  const bytes = new Uint8Array(arrayBuffer);
  const mime = clean(contentType, 80).toLowerCase();
  if (mime.includes('png')) return pngDimensions(bytes);
  if (mime.includes('gif')) return gifDimensions(bytes);
  if (mime.includes('jpeg') || mime.includes('jpg')) return jpegDimensions(bytes);
  return pngDimensions(bytes) || jpegDimensions(bytes) || gifDimensions(bytes);
}

function mimeForFormat(format) {
  if (format === 'png') return 'image/png';
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'gif') return 'image/gif';
  return 'application/octet-stream';
}

function buildPrompt(payload = {}) {
  const title = clean(payload.title, 180);
  const category = clean(payload.category, 100);
  const angle = clean(payload.creative_angle || 'clean premium product promotion', 240);
  const audience = clean(payload.target_audience, 160);
  return [
    'Use input image 0 as the exact factual product reference.',
    'Preserve the product identity, geometry, proportions, colors, visible branding and physical features.',
    'Do not substitute or redesign the product and do not invent accessories that are not visible in the reference.',
    `Create a polished commercial lifestyle promotional visual for ${title || 'this product'}${category ? ` in the ${category} category` : ''}.`,
    `Creative direction: ${angle}.`,
    audience ? `Target audience: ${audience}.` : '',
    'Use realistic lighting, a clear focal hierarchy and generous negative space for a deterministic text overlay added later.',
    'Do not render prices, discount badges, QR codes, captions, claims, logos or other typography in the generated image.',
  ].filter(Boolean).join(' ');
}

function base64ToArrayBuffer(value) {
  const raw = atob(String(value || '').replace(/\s+/g, ''));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

function extractImageBase64(output) {
  if (output && typeof output.image === 'string') return output.image;
  if (output?.result && typeof output.result.image === 'string') return output.result.image;
  return null;
}

async function loadUsage(env, month = monthKey()) {
  const key = `${USAGE_PREFIX}${month}`;
  let state = null;
  try { state = await env.HERMES_COMMAND_STORE.get(key, { type: 'json' }); } catch {}
  if (!state || typeof state !== 'object') {
    state = { version: USAGE_VERSION, month, provider_calls: 0, generated_assets: 0, last_updated_at: null };
  }
  return { key, state };
}

async function saveUsage(env, key, state) {
  await env.HERMES_COMMAND_STORE.put(key, JSON.stringify(state));
}

export async function readCentralRioImageUsage(env = {}) {
  const capability = centralRioImageCapability(env);
  if (!capability.asset_store_configured) {
    return { ok: false, error_code: 'HERMES_COMMAND_STORE_NOT_CONFIGURED', capability, usage: null };
  }
  const { state } = await loadUsage(env);
  return { ok: true, error_code: null, capability, usage: state, counter_live_read_verified: true };
}

async function persistTaskResult(env, taskId, result) {
  await env.HERMES_COMMAND_STORE.put(`${RESULT_PREFIX}${taskId}`, JSON.stringify(result), { expirationTtl: 90 * 24 * 60 * 60 });
}

export async function readCentralRioFlyerResult(env = {}, taskIdInput) {
  const taskId = safeId(taskIdInput);
  if (!taskId || !env.HERMES_COMMAND_STORE) return { status: 'NOT_FOUND', task_id: taskId || null, result: null };
  const result = await env.HERMES_COMMAND_STORE.get(`${RESULT_PREFIX}${taskId}`, { type: 'json' });
  return result ? { status: 'FOUND', task_id: taskId, result, live_request_verified: true, real_output_verified: result.real_output_verified === true, business_outcome_verified: result.business_outcome_verified === true } : { status: 'NOT_FOUND', task_id: taskId, result: null, live_request_verified: true };
}

export async function getCentralRioFlyerAsset(env = {}, assetIdInput) {
  const assetId = safeId(assetIdInput);
  if (!assetId || !env.HERMES_COMMAND_STORE) return { found: false, asset_id: assetId || null };
  const record = await env.HERMES_COMMAND_STORE.getWithMetadata(`${ASSET_PREFIX}${assetId}`, { type: 'arrayBuffer' });
  if (!record?.value) return { found: false, asset_id: assetId };
  return { found: true, asset_id: assetId, bytes: record.value, metadata: record.metadata || {} };
}

export async function executeCentralRioFlyer(env = {}, command = {}, { preflightOnly = false } = {}) {
  const capability = centralRioImageCapability(env);
  const taskId = randomId(preflightOnly ? 'hermes-rio-central-preflight' : 'hermes-rio-central-flyer');
  const productReference = clean(command?.payload?.product_reference, 300);
  const imageCheck = validateCentralProductImageUrl(command?.payload?.product_image_url);

  const base = {
    task_id: taskId,
    task_type: 'PRODUCT_FLYER_GENERATE',
    sender: 'hermes-central-image-provider',
    recipient: 'rio',
    product_reference: productReference,
    provider: capability.provider,
    model: capability.model,
    provider_mode: capability.provider_mode,
    credential_transfer_performed: false,
    public_action_performed: false,
    objective_changed: false,
    live_request_verified: false,
    real_output_verified: false,
    qa_approved: false,
    business_outcome_verified: false,
    created_at: new Date().toISOString(),
  };

  if (!productReference) return { ...base, status: 'SAFE_STOP', execution_status: 'BLOCKED', error_code: 'PRODUCT_REFERENCE_REQUIRED' };
  if (!imageCheck.ok) return { ...base, status: 'SAFE_STOP', execution_status: 'BLOCKED', error_code: imageCheck.error_code };
  if (!capability.ready_for_preflight) {
    return { ...base, status: 'SAFE_STOP', execution_status: 'BLOCKED', error_code: !capability.workers_ai_binding_configured ? 'WORKERS_AI_BINDING_NOT_CONFIGURED' : 'HERMES_COMMAND_STORE_NOT_CONFIGURED', capability };
  }

  const { key: usageKey, state: usage } = await loadUsage(env);
  const limit = capability.monthly_provider_call_limit;
  const currentCalls = Number(usage.provider_calls || 0);
  if (currentCalls >= limit) {
    const result = { ...base, status: 'SAFE_STOP', execution_status: 'BLOCKED', error_code: 'MONTHLY_IMAGE_PROVIDER_CALL_LIMIT_REACHED', provider_calls_this_month: currentCalls, monthly_provider_call_limit: limit };
    await persistTaskResult(env, taskId, result);
    return result;
  }

  if (preflightOnly) {
    const result = {
      ...base,
      status: 'PREFLIGHT_READY',
      execution_status: 'COMPLETED',
      error_code: null,
      preflight_only: true,
      workers_ai_binding_configured: true,
      asset_store_configured: true,
      provider_call_attempted: false,
      provider_call_counted: false,
      provider_calls_this_month: currentCalls,
      monthly_provider_call_limit: limit,
      quota_counter_atomic: false,
      reference_image_fetch_attempted: false,
      note: 'Central Workers AI binding, durable result/asset store and monthly call gate verified without image fetch or inference.',
    };
    await persistTaskResult(env, taskId, result);
    return result;
  }

  let response;
  try {
    response = await fetch(imageCheck.url, { headers: { 'User-Agent': 'Hermes-RIO-Central-Image-Provider/1.0' }, redirect: 'follow' });
  } catch (error) {
    const result = { ...base, status: 'SAFE_STOP', execution_status: 'BLOCKED', error_code: 'PRODUCT_IMAGE_FETCH_FAILED', detail: clean(error?.message || error, 240) };
    await persistTaskResult(env, taskId, result);
    return result;
  }
  if (!response.ok) {
    const result = { ...base, status: 'SAFE_STOP', execution_status: 'BLOCKED', error_code: 'PRODUCT_IMAGE_FETCH_HTTP_ERROR', product_image_http_status: response.status };
    await persistTaskResult(env, taskId, result);
    return result;
  }

  const finalUrlCheck = validateCentralProductImageUrl(response.url || imageCheck.url);
  if (!finalUrlCheck.ok) {
    const result = { ...base, status: 'SAFE_STOP', execution_status: 'BLOCKED', error_code: 'PRODUCT_IMAGE_REDIRECT_TARGET_NOT_ALLOWED' };
    await persistTaskResult(env, taskId, result);
    return result;
  }

  const contentType = clean((response.headers.get('content-type') || '').split(';')[0], 80).toLowerCase();
  if (!contentType.startsWith('image/')) {
    const result = { ...base, status: 'SAFE_STOP', execution_status: 'BLOCKED', error_code: 'PRODUCT_IMAGE_CONTENT_TYPE_INVALID', source_content_type: contentType || null };
    await persistTaskResult(env, taskId, result);
    return result;
  }

  const reference = await response.arrayBuffer();
  if (reference.byteLength < 1024 || reference.byteLength > 8 * 1024 * 1024) {
    const result = { ...base, status: 'SAFE_STOP', execution_status: 'BLOCKED', error_code: 'PRODUCT_IMAGE_SIZE_INVALID', reference_bytes: reference.byteLength };
    await persistTaskResult(env, taskId, result);
    return result;
  }

  const dimensions = detectImageDimensions(reference, contentType);
  if (!dimensions) {
    const result = { ...base, status: 'SAFE_STOP', execution_status: 'BLOCKED', error_code: 'REFERENCE_IMAGE_DIMENSIONS_UNVERIFIED', source_content_type: contentType };
    await persistTaskResult(env, taskId, result);
    return result;
  }
  if (dimensions.width >= 512 || dimensions.height >= 512) {
    const result = { ...base, status: 'SAFE_STOP', execution_status: 'BLOCKED', error_code: 'REFERENCE_IMAGE_DIMENSIONS_EXCEED_MODEL_LIMIT', reference_dimensions: [dimensions.width, dimensions.height], required_max_dimension: 511 };
    await persistTaskResult(env, taskId, result);
    return result;
  }

  // Count before inference so a failed or billable provider request remains bounded and auditable.
  // HERMES_COMMAND_STORE is KV, so this monthly counter is intentionally reported as non-atomic.
  usage.provider_calls = currentCalls + 1;
  usage.last_updated_at = new Date().toISOString();
  await saveUsage(env, usageKey, usage);

  const form = new FormData();
  form.append('prompt', buildPrompt(command?.payload || {}));
  form.append('width', '1024');
  form.append('height', '1024');
  form.append('input_image_0', new Blob([reference], { type: contentType }), 'product-reference');
  const serialized = new Response(form);

  let output;
  try {
    output = await env.AI.run(MODEL, { multipart: { body: serialized.body, contentType: serialized.headers.get('content-type') } });
  } catch (error) {
    const result = { ...base, status: 'SAFE_STOP', execution_status: 'FAILED', error_code: 'WORKERS_AI_REQUEST_FAILED', provider_call_counted: true, provider_calls_this_month: usage.provider_calls, monthly_provider_call_limit: limit, detail: clean(error?.message || error, 240), reference_dimensions: [dimensions.width, dimensions.height] };
    await persistTaskResult(env, taskId, result);
    return result;
  }

  const imageB64 = extractImageBase64(output);
  if (!imageB64) {
    const result = { ...base, status: 'SAFE_STOP', execution_status: 'FAILED', error_code: 'WORKERS_AI_IMAGE_MISSING', provider_call_counted: true, provider_calls_this_month: usage.provider_calls, monthly_provider_call_limit: limit };
    await persistTaskResult(env, taskId, result);
    return result;
  }

  let generated;
  try { generated = base64ToArrayBuffer(imageB64); } catch {
    const result = { ...base, status: 'SAFE_STOP', execution_status: 'FAILED', error_code: 'WORKERS_AI_IMAGE_BASE64_INVALID', provider_call_counted: true, provider_calls_this_month: usage.provider_calls, monthly_provider_call_limit: limit };
    await persistTaskResult(env, taskId, result);
    return result;
  }
  if (generated.byteLength < 10000 || generated.byteLength > 24 * 1024 * 1024) {
    const result = { ...base, status: 'SAFE_STOP', execution_status: 'FAILED', error_code: 'GENERATED_IMAGE_SIZE_INVALID', provider_call_counted: true, generated_bytes: generated.byteLength };
    await persistTaskResult(env, taskId, result);
    return result;
  }

  const generatedDimensions = detectImageDimensions(generated, '');
  if (!generatedDimensions || !['png', 'jpeg'].includes(generatedDimensions.format)) {
    const result = { ...base, status: 'SAFE_STOP', execution_status: 'FAILED', error_code: 'GENERATED_IMAGE_FORMAT_UNVERIFIED', provider_call_counted: true, generated_bytes: generated.byteLength };
    await persistTaskResult(env, taskId, result);
    return result;
  }
  if (generatedDimensions.width < 512 || generatedDimensions.height < 512) {
    const result = { ...base, status: 'SAFE_STOP', execution_status: 'FAILED', error_code: 'GENERATED_IMAGE_DIMENSIONS_TOO_SMALL', provider_call_counted: true, generated_dimensions: [generatedDimensions.width, generatedDimensions.height] };
    await persistTaskResult(env, taskId, result);
    return result;
  }
  const assetContentType = mimeForFormat(generatedDimensions.format);

  const assetId = randomId('rio-flyer-asset');
  await env.HERMES_COMMAND_STORE.put(`${ASSET_PREFIX}${assetId}`, generated, {
    expirationTtl: 90 * 24 * 60 * 60,
    metadata: {
      content_type: assetContentType,
      task_id: taskId,
      product_reference: productReference.slice(0, 180),
      provider: 'cloudflare-workers-ai',
      model: MODEL,
      created_at: new Date().toISOString(),
    },
  });

  usage.generated_assets = Number(usage.generated_assets || 0) + 1;
  usage.last_updated_at = new Date().toISOString();
  await saveUsage(env, usageKey, usage);

  const result = {
    ...base,
    status: 'GENERATED_PENDING_QA',
    execution_status: 'COMPLETED',
    error_code: null,
    live_request_verified: true,
    real_output_verified: true,
    qa_approved: false,
    asset_id: assetId,
    asset_endpoint: `/v1/assets/${assetId}`,
    asset_content_type: assetContentType,
    generated_bytes: generated.byteLength,
    generated_dimensions: [generatedDimensions.width, generatedDimensions.height],
    generated_format: generatedDimensions.format,
    reference_dimensions: [dimensions.width, dimensions.height],
    provider_call_counted: true,
    provider_calls_this_month: usage.provider_calls,
    generated_assets_this_month: usage.generated_assets,
    monthly_provider_call_limit: limit,
    quota_counter_atomic: false,
    prompt_version: 'HERMES_RIO_FLYER_PROMPT_V1',
    credential_transfer_required: false,
  };
  await persistTaskResult(env, taskId, result);
  return result;
}
