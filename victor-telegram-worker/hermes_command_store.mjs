export const HERMES_STORE_VERSION = 'HERMES_COMMAND_STORE_V1';
export const HERMES_STORE_BINDING = 'HERMES_COMMAND_STORE';

function clean(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function requireStore(env = {}) {
  const store = env[HERMES_STORE_BINDING];
  if (!store || typeof store.get !== 'function' || typeof store.put !== 'function') {
    throw new Error('HERMES_COMMAND_STORE_UNAVAILABLE');
  }
  return store;
}

function commandKey(commandId) {
  const id = clean(commandId, 128);
  if (!id) throw new Error('COMMAND_ID_REQUIRED');
  return `command:${id}`;
}

function receiptKey(receiptId) {
  const id = clean(receiptId, 128);
  if (!id) throw new Error('RECEIPT_ID_REQUIRED');
  return `receipt:${id}`;
}

function idempotencyKey(key) {
  const id = clean(key, 160);
  if (!id) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  return `idempotency:${id}`;
}

async function readJson(store, key) {
  const raw = await store.get(key, { type: 'json' });
  return raw && typeof raw === 'object' ? raw : null;
}

export function hermesStoreCapability(env = {}) {
  const store = env[HERMES_STORE_BINDING];
  const durable = Boolean(store && typeof store.get === 'function' && typeof store.put === 'function');
  return {
    mode: durable ? 'DURABLE_KV' : 'UNAVAILABLE',
    durable,
    binding: durable ? HERMES_STORE_BINDING : null,
    reason: durable ? 'KV_LIKE_GET_PUT_BINDING_AVAILABLE' : 'NO_DURABLE_HERMES_COMMAND_STORE_CONFIGURED',
    store_version: HERMES_STORE_VERSION,
  };
}

export async function reserveIdempotency(env, { key, commandId, ttlSeconds = 60 * 60 * 24 * 35 } = {}) {
  const store = requireStore(env);
  const storageKey = idempotencyKey(key);
  const existing = await readJson(store, storageKey);
  if (existing) {
    return {
      accepted: false,
      duplicate: true,
      existing,
      store_version: HERMES_STORE_VERSION,
    };
  }
  const record = {
    idempotency_key: clean(key, 160),
    command_id: clean(commandId, 128),
    reserved_at: new Date().toISOString(),
  };
  await store.put(storageKey, JSON.stringify(record), { expirationTtl: ttlSeconds });
  return {
    accepted: true,
    duplicate: false,
    record,
    store_version: HERMES_STORE_VERSION,
  };
}

export async function getIdempotencyRecord(env, key) {
  const store = requireStore(env);
  return readJson(store, idempotencyKey(key));
}

export async function putCommandState(env, command, patch = {}) {
  const store = requireStore(env);
  const commandId = clean(command?.command_id, 128);
  const key = commandKey(commandId);
  const current = await readJson(store, key);
  const now = new Date().toISOString();
  const next = {
    ...(current || {}),
    command_id: commandId,
    source: clean(command?.source, 32) || current?.source || null,
    actor: clean(command?.actor, 64) || current?.actor || null,
    target: clean(command?.target, 64) || current?.target || null,
    action: clean(command?.action, 128) || current?.action || null,
    idempotency_key: clean(command?.idempotency_key, 160) || current?.idempotency_key || null,
    payload: command?.payload && typeof command.payload === 'object' ? command.payload : current?.payload || {},
    status: patch.status || current?.status || 'RECEIVED',
    validation: patch.validation || current?.validation || 'PENDING',
    execution: patch.execution || current?.execution || 'NOT_STARTED',
    error_code: patch.error_code ?? current?.error_code ?? null,
    result: patch.result ?? current?.result ?? null,
    receipt_id: patch.receipt_id ?? current?.receipt_id ?? null,
    created_at: current?.created_at || now,
    updated_at: now,
    store_version: HERMES_STORE_VERSION,
  };
  await store.put(key, JSON.stringify(next));
  return { state: next, persisted: true, capability: hermesStoreCapability(env) };
}

export async function getCommandState(env, commandId) {
  const store = requireStore(env);
  const state = await readJson(store, commandKey(commandId));
  return {
    state,
    found: Boolean(state),
    capability: hermesStoreCapability(env),
  };
}

export async function putReceipt(env, receipt) {
  const store = requireStore(env);
  const receiptId = clean(receipt?.receipt_id, 128);
  const key = receiptKey(receiptId);
  const current = await readJson(store, key);
  const now = new Date().toISOString();
  const next = {
    ...(current || {}),
    ...(receipt || {}),
    receipt_id: receiptId,
    created_at: current?.created_at || now,
    updated_at: now,
    store_version: HERMES_STORE_VERSION,
  };
  await store.put(key, JSON.stringify(next));
  return { receipt: next, persisted: true, capability: hermesStoreCapability(env) };
}

export async function getReceipt(env, receiptId) {
  const store = requireStore(env);
  const receipt = await readJson(store, receiptKey(receiptId));
  return {
    receipt,
    found: Boolean(receipt),
    capability: hermesStoreCapability(env),
  };
}

export async function persistCommandAcceptance(env, { command, receipt }) {
  if (!command?.command_id) throw new Error('COMMAND_ID_REQUIRED');
  if (!command?.idempotency_key) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  if (!receipt?.receipt_id) throw new Error('RECEIPT_ID_REQUIRED');

  const reservation = await reserveIdempotency(env, {
    key: command.idempotency_key,
    commandId: command.command_id,
  });
  if (!reservation.accepted) {
    return {
      accepted: false,
      duplicate: true,
      existing_command_id: reservation.existing?.command_id || null,
      store_version: HERMES_STORE_VERSION,
    };
  }

  await putReceipt(env, receipt);
  await putCommandState(env, command, {
    status: receipt.status || 'RECEIVED',
    validation: receipt.validation || 'PENDING',
    execution: receipt.execution || 'NOT_STARTED',
    receipt_id: receipt.receipt_id,
  });

  return {
    accepted: true,
    duplicate: false,
    command_id: command.command_id,
    receipt_id: receipt.receipt_id,
    store_version: HERMES_STORE_VERSION,
  };
}
