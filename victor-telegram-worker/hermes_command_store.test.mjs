import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCommandState,
  getIdempotencyRecord,
  getReceipt,
  hermesStoreCapability,
  persistCommandAcceptance,
  putCommandState,
  putReceipt,
  reserveIdempotency,
} from './hermes_command_store.mjs';

function memoryKv() {
  const map = new Map();
  return {
    async get(key, options = {}) {
      const raw = map.get(key);
      if (raw == null) return null;
      return options?.type === 'json' ? JSON.parse(raw) : raw;
    },
    async put(key, value) { map.set(key, value); },
  };
}

function env() {
  return { HERMES_COMMAND_STORE: memoryKv() };
}

const command = {
  command_id: 'cmd_1',
  source: 'chatgpt',
  actor: 'founder_authorized_assistant',
  target: 'rio',
  action: 'rio.generate_product_flyer',
  idempotency_key: 'idem_1',
  payload: { product_reference: 'B0ABC123' },
};

const receipt = {
  receipt_id: 'rcpt_1',
  command_id: 'cmd_1',
  status: 'RECEIVED',
  validation: 'PASS',
  execution: 'NOT_STARTED',
  live_request_verified: false,
  real_output_verified: false,
  business_outcome_verified: false,
};

test('store capability requires durable KV-like binding', () => {
  assert.equal(hermesStoreCapability({}).durable, false);
  assert.equal(hermesStoreCapability(env()).durable, true);
});

test('idempotency reservation accepts once and then reports duplicate', async () => {
  const e = env();
  const first = await reserveIdempotency(e, { key: 'idem_1', commandId: 'cmd_1' });
  assert.equal(first.accepted, true);
  const second = await reserveIdempotency(e, { key: 'idem_1', commandId: 'cmd_2' });
  assert.equal(second.accepted, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.existing.command_id, 'cmd_1');
  const stored = await getIdempotencyRecord(e, 'idem_1');
  assert.equal(stored.command_id, 'cmd_1');
});

test('command state persists and supports status updates', async () => {
  const e = env();
  await putCommandState(e, command, { status: 'QUEUED', validation: 'PASS' });
  await putCommandState(e, command, { status: 'COMPLETED', execution: 'PASS', result: { ok: true } });
  const result = await getCommandState(e, 'cmd_1');
  assert.equal(result.found, true);
  assert.equal(result.state.status, 'COMPLETED');
  assert.equal(result.state.execution, 'PASS');
  assert.deepEqual(result.state.result, { ok: true });
});

test('receipt evidence fields persist independently', async () => {
  const e = env();
  await putReceipt(e, receipt);
  await putReceipt(e, { ...receipt, execution: 'PASS', live_request_verified: true, real_output_verified: false });
  const result = await getReceipt(e, 'rcpt_1');
  assert.equal(result.found, true);
  assert.equal(result.receipt.execution, 'PASS');
  assert.equal(result.receipt.live_request_verified, true);
  assert.equal(result.receipt.real_output_verified, false);
  assert.equal(result.receipt.business_outcome_verified, false);
});

test('acceptance transaction reserves idempotency then writes receipt and command state', async () => {
  const e = env();
  const accepted = await persistCommandAcceptance(e, { command, receipt });
  assert.equal(accepted.accepted, true);

  const commandRecord = await getCommandState(e, 'cmd_1');
  const receiptRecord = await getReceipt(e, 'rcpt_1');
  assert.equal(commandRecord.state.receipt_id, 'rcpt_1');
  assert.equal(receiptRecord.receipt.command_id, 'cmd_1');

  const duplicate = await persistCommandAcceptance(e, {
    command: { ...command, command_id: 'cmd_other' },
    receipt: { ...receipt, receipt_id: 'rcpt_other', command_id: 'cmd_other' },
  });
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.existing_command_id, 'cmd_1');
});

test('store fails closed when durable binding is missing', async () => {
  await assert.rejects(
    () => putCommandState({}, command, { status: 'QUEUED' }),
    /HERMES_COMMAND_STORE_UNAVAILABLE/,
  );
});
