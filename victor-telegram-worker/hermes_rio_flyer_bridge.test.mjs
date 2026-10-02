import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchRioFlyerTask, readRioFlyerResult, rioFlyerBridgeCapability, validateRioFlyerPayload } from './hermes_rio_flyer_bridge.mjs';

test('bridge requires explicit feature flag and github token', () => {
  assert.equal(rioFlyerBridgeCapability({}).ready_for_dispatch, false);
  assert.equal(rioFlyerBridgeCapability({ GITHUB_ORCHESTRATION_TOKEN: 'x', RIO_FLYER_TRANSPORT_ENABLED: 'true' }).ready_for_dispatch, true);
  assert.equal(rioFlyerBridgeCapability({}).result_readback_implemented, true);
});

test('flyer payload requires exact product reference and https image', () => {
  assert.equal(validateRioFlyerPayload({ payload: {} }).ok, false);
  const good = validateRioFlyerPayload({ payload: { product_reference: 'B0ABC123', product_image_url: 'https://example.com/p.jpg' } });
  assert.equal(good.ok, true);
});

test('dispatch posts exact workflow inputs and reports verified dispatch only on 204', async () => {
  const original = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url, init, body: JSON.parse(init.body) };
    return { status: 204, text: async () => '' };
  };
  try {
    const out = await dispatchRioFlyerTask({ GITHUB_ORCHESTRATION_TOKEN: 'token', RIO_FLYER_TRANSPORT_ENABLED: 'true' }, {
      command_id: 'cmd-1', actor: 'founder_authorized_assistant', action: 'rio.generate_product_flyer',
      payload: { product_reference: 'B0ABC123', product_image_url: 'https://example.com/p.jpg', title: 'Socket Cover' },
    });
    assert.equal(out.status, 'DISPATCHED');
    assert.equal(out.live_request_verified, true);
    assert.equal(out.preflight_only, false);
    assert.match(seen.url, /hermes-rio-flyer-transport\.yml\/dispatches$/);
    assert.equal(seen.body.ref, 'main');
    assert.equal(seen.body.inputs.product_reference, 'B0ABC123');
    assert.equal(seen.body.inputs.preflight_only, 'false');
    const payload = JSON.parse(seen.body.inputs.payload);
    assert.equal(payload.product_image_url, 'https://example.com/p.jpg');
    assert.equal(payload.preflight_only, false);
  } finally {
    globalThis.fetch = original;
  }
});

test('preflight command dispatches same workflow with provider inference disabled', async () => {
  const original = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url, body: JSON.parse(init.body) };
    return { status: 204, text: async () => '' };
  };
  try {
    const out = await dispatchRioFlyerTask({ GITHUB_ORCHESTRATION_TOKEN: 'token', RIO_FLYER_TRANSPORT_ENABLED: 'true' }, {
      command_id: 'cmd-preflight', actor: 'founder_authorized_assistant', action: 'rio.flyer_preflight',
      payload: { product_reference: 'PRE-FLIGHT-FIXTURE', product_image_url: 'https://example.invalid/reference.jpg' },
    });
    assert.equal(out.status, 'DISPATCHED');
    assert.equal(out.preflight_only, true);
    assert.equal(seen.body.inputs.preflight_only, 'true');
    assert.match(seen.body.inputs.task_id, /^hermes-rio-preflight-/);
    const payload = JSON.parse(seen.body.inputs.payload);
    assert.equal(payload.preflight_only, true);
  } finally {
    globalThis.fetch = original;
  }
});

test('result readback returns persisted downstream evidence without upgrading proof states', async () => {
  const original = globalThis.fetch;
  const taskId = 'hermes-rio-preflight-123-cmd';
  const downstream = {
    task_id: taskId,
    status: 'SAFE_STOP',
    error_code: 'CLOUDFLARE_CREDENTIALS_NOT_CONFIGURED',
    live_request_verified: false,
    real_output_verified: false,
    business_outcome_verified: false,
  };
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      sha: 'blob123',
      content: Buffer.from(JSON.stringify(downstream), 'utf8').toString('base64'),
    }),
  });
  try {
    const out = await readRioFlyerResult({ GITHUB_ORCHESTRATION_TOKEN: 'token' }, taskId);
    assert.equal(out.status, 'FOUND');
    assert.equal(out.live_request_verified, true);
    assert.equal(out.real_output_verified, false);
    assert.equal(out.business_outcome_verified, false);
    assert.equal(out.result.error_code, 'CLOUDFLARE_CREDENTIALS_NOT_CONFIGURED');
    assert.equal(out.blob_sha, 'blob123');
  } finally {
    globalThis.fetch = original;
  }
});

test('result readback reports not found rather than inventing completion', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  try {
    const out = await readRioFlyerResult({}, 'valid-task-1');
    assert.equal(out.status, 'NOT_FOUND');
    assert.equal(out.error_code, 'RIO_RESULT_NOT_FOUND');
    assert.equal(out.live_request_verified, true);
    assert.equal(out.result, null);
  } finally {
    globalThis.fetch = original;
  }
});
