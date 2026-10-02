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

test('telegram rio flyer command normalizes into canonical action', () => {
  const parsed = parseHermesTelegramCommand('/rio flyer B0ABC123');
  assert.deepEqual(parsed, {
    target: 'rio',
    action: 'rio.generate_product_flyer',
    payload: { product_reference: 'B0ABC123' },
  });
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
