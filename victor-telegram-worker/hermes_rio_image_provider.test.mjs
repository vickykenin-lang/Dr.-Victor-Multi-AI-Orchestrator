import test from 'node:test';
import assert from 'node:assert/strict';
import {
  centralRioImageCapability,
  detectImageDimensions,
  executeCentralRioFlyer,
  getCentralRioFlyerAsset,
  readCentralRioImageUsage,
  validateCentralProductImageUrl,
} from './hermes_rio_image_provider.mjs';

function pngBytes(width, height, size = 2048) {
  const bytes = new Uint8Array(Math.max(size, 24));
  bytes.set([137,80,78,71,13,10,26,10], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
}

function memoryStore() {
  const data = new Map();
  const metadata = new Map();
  return {
    async get(key, options = {}) {
      if (!data.has(key)) return null;
      const value = data.get(key);
      if (options?.type === 'json') return typeof value === 'string' ? JSON.parse(value) : value;
      if (options?.type === 'arrayBuffer') return value;
      return value;
    },
    async put(key, value, options = {}) {
      data.set(key, value);
      metadata.set(key, options?.metadata || null);
    },
    async getWithMetadata(key) {
      if (!data.has(key)) return { value: null, metadata: null };
      return { value: data.get(key), metadata: metadata.get(key) };
    },
    _data: data,
  };
}

function command(action = 'rio.generate_product_flyer') {
  return {
    command_id: 'cmd-test-1',
    actor: 'founder_authorized_assistant',
    action,
    payload: {
      product_reference: 'B0TEST123',
      product_image_url: 'https://images.example.com/product.png',
      title: 'Exact Product',
      category: 'home safety',
      creative_angle: 'clean premium product promotion',
      target_audience: 'Indian online shoppers',
    },
  };
}

test('central provider requires Workers AI plus durable store and never requires credential transfer', () => {
  assert.equal(centralRioImageCapability({}).ready_for_generation, false);
  const cap = centralRioImageCapability({ AI: { run() {} }, HERMES_COMMAND_STORE: memoryStore() });
  assert.equal(cap.ready_for_generation, true);
  assert.equal(cap.credential_transfer_required, false);
  assert.equal(cap.model, '@cf/black-forest-labs/flux-2-klein-9b');
});

test('product image URL gate rejects non-https and private hosts', () => {
  assert.equal(validateCentralProductImageUrl('http://example.com/a.png').ok, false);
  assert.equal(validateCentralProductImageUrl('https://127.0.0.1/a.png').error_code, 'PRODUCT_IMAGE_HOST_NOT_ALLOWED');
  assert.equal(validateCentralProductImageUrl('https://192.168.1.20/a.png').ok, false);
  assert.equal(validateCentralProductImageUrl('https://images.example.com/a.png').ok, true);
});

test('dimension reader verifies PNG input dimensions used by provider gate', () => {
  const bytes = pngBytes(500, 400);
  assert.deepEqual(detectImageDimensions(bytes.buffer, 'image/png'), { width: 500, height: 400, format: 'png' });
});

test('preflight proves central binding/store/quota without image fetch or inference', async () => {
  const store = memoryStore();
  let inferenceCalls = 0;
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCalls += 1; throw new Error('must not fetch during preflight'); };
  try {
    const out = await executeCentralRioFlyer({
      AI: { async run() { inferenceCalls += 1; return {}; } },
      HERMES_COMMAND_STORE: store,
      RIO_IMAGE_MONTHLY_PROVIDER_CALL_LIMIT: '30',
    }, command('rio.flyer_preflight'), { preflightOnly: true });
    assert.equal(out.status, 'PREFLIGHT_READY');
    assert.equal(out.provider_call_attempted, false);
    assert.equal(out.provider_call_counted, false);
    assert.equal(out.provider_calls_this_month, 0);
    assert.equal(inferenceCalls, 0);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generation uses central AI binding, stores asset, and increments governed usage once', async () => {
  const store = memoryStore();
  const reference = pngBytes(500, 500, 4096);
  const generated = pngBytes(1024, 1024, 12000);
  const originalFetch = globalThis.fetch;
  let inferenceCalls = 0;
  globalThis.fetch = async () => new Response(reference, { status: 200, headers: { 'content-type': 'image/png' } });
  try {
    const env = {
      AI: { async run(model, input) {
        inferenceCalls += 1;
        assert.equal(model, '@cf/black-forest-labs/flux-2-klein-9b');
        assert.ok(input?.multipart?.body);
        assert.match(input?.multipart?.contentType || '', /^multipart\/form-data;/);
        return { image: Buffer.from(generated).toString('base64') };
      } },
      HERMES_COMMAND_STORE: store,
      RIO_IMAGE_MONTHLY_PROVIDER_CALL_LIMIT: '30',
    };
    const out = await executeCentralRioFlyer(env, command(), { preflightOnly: false });
    assert.equal(out.status, 'GENERATED_PENDING_QA');
    assert.equal(out.real_output_verified, true);
    assert.equal(out.qa_approved, false);
    assert.equal(out.provider_calls_this_month, 1);
    assert.equal(out.credential_transfer_required, false);
    assert.equal(inferenceCalls, 1);
    assert.ok(out.asset_id);
    const asset = await getCentralRioFlyerAsset(env, out.asset_id);
    assert.equal(asset.found, true);
    assert.equal(asset.metadata.task_id, out.task_id);
    const usage = await readCentralRioImageUsage(env);
    assert.equal(usage.usage.provider_calls, 1);
    assert.equal(usage.usage.generated_assets, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('monthly provider-call limit blocks before fetch or inference', async () => {
  const store = memoryStore();
  const month = new Date().toISOString().slice(0, 7);
  await store.put(`rio:image:usage:${month}`, JSON.stringify({ version: 'HERMES_RIO_IMAGE_USAGE_V1', month, provider_calls: 30, generated_assets: 12 }));
  let inferenceCalls = 0;
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCalls += 1; return new Response(); };
  try {
    const out = await executeCentralRioFlyer({
      AI: { async run() { inferenceCalls += 1; return {}; } },
      HERMES_COMMAND_STORE: store,
      RIO_IMAGE_MONTHLY_PROVIDER_CALL_LIMIT: '30',
    }, command(), { preflightOnly: false });
    assert.equal(out.status, 'SAFE_STOP');
    assert.equal(out.error_code, 'MONTHLY_IMAGE_PROVIDER_CALL_LIMIT_REACHED');
    assert.equal(inferenceCalls, 0);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
