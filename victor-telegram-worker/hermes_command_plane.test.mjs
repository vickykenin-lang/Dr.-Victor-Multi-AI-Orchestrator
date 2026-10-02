import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HERMES_RISK_CLASS,
  buildHermesReceipt,
  classifyHermesAction,
  parseHermesTelegramCommand,
  validateHermesCommandEnvelope,
} from './hermes_command_plane.mjs';

test('registered read-only action validates', () => {
  const result = validateHermesCommandEnvelope({
    command_id: 'cmd_1',
    source: 'chatgpt',
    actor: 'founder_authorized_assistant',
    target: 'rio',
    action: 'rio.status',
    execution_mode: 'manual',
    idempotency_key: 'rio-status-1',
    payload: {},
  });
  assert.equal(result.ok, true);
  assert.equal(result.classification.risk, HERMES_RISK_CLASS.READ_ONLY);
});

test('flyer preflight is registered as safe execution', () => {
  const result = validateHermesCommandEnvelope({
    command_id: 'cmd_preflight',
    source: 'chatgpt',
    actor: 'founder_authorized_assistant',
    target: 'rio',
    action: 'rio.flyer_preflight',
    execution_mode: 'manual',
    idempotency_key: 'rio-preflight-1',
    payload: {},
  });
  assert.equal(result.ok, true);
  assert.equal(result.classification.risk, HERMES_RISK_CLASS.SAFE_EXECUTION);
});

test('unknown action fails closed', () => {
  const result = validateHermesCommandEnvelope({
    command_id: 'cmd_2',
    source: 'telegram',
    actor: 'founder',
    target: 'rio',
    action: 'rio.unknown_action',
    execution_mode: 'manual',
    idempotency_key: 'unknown-1',
  });
  assert.equal(result.ok, false);
  assert.equal(result.classification.risk, HERMES_RISK_CLASS.SAFE_STOP);
  assert.ok(result.errors.includes('ACTION_NOT_REGISTERED'));
});

test('target mismatch is rejected', () => {
  const result = validateHermesCommandEnvelope({
    command_id: 'cmd_3',
    source: 'dashboard',
    actor: 'founder',
    target: 'victor',
    action: 'rio.status',
    execution_mode: 'manual',
    idempotency_key: 'mismatch-1',
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('TARGET_ACTION_MISMATCH'));
});

test('telegram rio flyer command keeps exact reference and optional image URL separate', () => {
  const parsed = parseHermesTelegramCommand('/rio flyer B0ABC123 https://images.example.com/product.jpg');
  assert.deepEqual(parsed, {
    target: 'rio',
    action: 'rio.generate_product_flyer',
    payload: {
      product_reference: 'B0ABC123',
      product_image_url: 'https://images.example.com/product.jpg',
    },
  });
});

test('telegram rio preflight normalizes into no-spend transport action', () => {
  const parsed = parseHermesTelegramCommand('/rio preflight PRE-FLIGHT-FIXTURE https://example.invalid/reference.jpg');
  assert.deepEqual(parsed, {
    target: 'rio',
    action: 'rio.flyer_preflight',
    payload: {
      product_reference: 'PRE-FLIGHT-FIXTURE',
      product_image_url: 'https://example.invalid/reference.jpg',
    },
  });
});

test('telegram flyer without image remains parseable and later fails closed at execution gate', () => {
  const parsed = parseHermesTelegramCommand('/rio flyer B0ABC123');
  assert.deepEqual(parsed, {
    target: 'rio',
    action: 'rio.generate_product_flyer',
    payload: { product_reference: 'B0ABC123' },
  });
});

test('telegram hermes audit normalizes into read-only audit action', () => {
  const parsed = parseHermesTelegramCommand('/hermes audit');
  assert.deepEqual(parsed, { target: 'hermes', action: 'hermes.audit', payload: {} });
});

test('receipt keeps evidence states separate', () => {
  const receipt = buildHermesReceipt({
    command: {
      command_id: 'cmd_4',
      source: 'chatgpt',
      actor: 'founder_authorized_assistant',
      target: 'rio',
      action: 'rio.generate_product_flyer',
    },
    receiptId: 'rcpt_4',
    now: '2026-10-02T05:00:00.000Z',
  });
  assert.equal(receipt.live_request_verified, false);
  assert.equal(receipt.real_output_verified, false);
  assert.equal(receipt.business_outcome_verified, false);
});
