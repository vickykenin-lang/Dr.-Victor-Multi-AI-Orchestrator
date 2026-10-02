import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchRioFlyerTask, rioFlyerBridgeCapability, validateRioFlyerPayload } from './hermes_rio_flyer_bridge.mjs';

test('bridge requires explicit feature flag and github token', () => {
  assert.equal(rioFlyerBridgeCapability({}).ready_for_dispatch, false);
  assert.equal(rioFlyerBridgeCapability({ GITHUB_ORCHESTRATION_TOKEN: 'x', RIO_FLYER_TRANSPORT_ENABLED: 'true' }).ready_for_dispatch, true);
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
      command_id: 'cmd-1', actor: 'founder_authorized_assistant',
      payload: { product_reference: 'B0ABC123', product_image_url: 'https://example.com/p.jpg', title: 'Socket Cover' },
    });
    assert.equal(out.status, 'DISPATCHED');
    assert.equal(out.live_request_verified, true);
    assert.match(seen.url, /hermes-rio-flyer-transport\.yml\/dispatches$/);
    assert.equal(seen.body.ref, 'main');
    assert.equal(seen.body.inputs.product_reference, 'B0ABC123');
    const payload = JSON.parse(seen.body.inputs.payload);
    assert.equal(payload.product_image_url, 'https://example.com/p.jpg');
  } finally {
    globalThis.fetch = original;
  }
});
