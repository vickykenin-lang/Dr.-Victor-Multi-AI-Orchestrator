import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hermesRuntimeSnapshot,
  rioRuntimeSnapshot,
  routeHermesCommand,
} from './hermes_command_router.mjs';

function memoryStore() {
  const map = new Map();
  return {
    async get(key, options = {}) {
      const value = map.get(key);
      if (value == null) return null;
      if (options?.type === 'json') return JSON.parse(value);
      return value;
    },
    async put(key, value) { map.set(key, value); },
    map,
  };
}

function envWithStore(extra = {}) {
  return { HERMES_COMMAND_STORE: memoryStore(), ...extra };
}

function command(action, target, payload = {}) {
  return {
    command_id: `cmd_${action.replace(/\W+/g, '_')}`,
    source: 'chatgpt',
    actor: 'founder_authorized_assistant',
    target,
    action,
    payload,
    execution_mode: 'manual',
    idempotency_key: `idem_${action}`,
  };
}

test('Hermes status returns source-level evidence without claiming deployment', async () => {
  const env = envWithStore({ HERMES_COMMAND_TOKEN: 'x', HERMES_WEBHOOK_SECRET: 'y' });
  const result = await routeHermesCommand(env, command('hermes.status', 'hermes'));
  assert.equal(result.execution, 'COMPLETED');
  assert.equal(result.result.command_token_configured, true);
  assert.equal(result.result.evidence.production_deployed, false);
  assert.equal(result.result.evidence.live_request_verified, false);
});

test('RIO status separates credential from exact flyer transport', () => {
  const snapshot = rioRuntimeSnapshot({ GITHUB_ORCHESTRATION_TOKEN: 'configured' });
  assert.equal(snapshot.bridge_credential_configured, true);
  assert.equal(snapshot.exact_flyer_transport_implemented, false);
  assert.equal(snapshot.evidence.real_output_verified, false);
});

test('RIO image usage never invents a current counter', async () => {
  const env = envWithStore();
  const result = await routeHermesCommand(env, command('rio.image_usage', 'rio'));
  assert.equal(result.execution, 'COMPLETED');
  assert.equal(result.error_code, 'RIO_IMAGE_USAGE_COUNTER_NOT_WIRED');
  assert.equal(result.result.actual_monthly_final_count, null);
  assert.equal(result.result.counter_verified, false);
});

test('RIO flyer command safe-stops when exact transport is not implemented', async () => {
  const env = envWithStore({ GITHUB_ORCHESTRATION_TOKEN: 'configured' });
  const result = await routeHermesCommand(
    env,
    command('rio.generate_product_flyer', 'rio', { product_reference: 'B0ABC123' }),
  );
  assert.equal(result.status, 'SAFE_STOP');
  assert.equal(result.execution, 'BLOCKED');
  assert.equal(result.error_code, 'RIO_EXACT_FLYER_TRANSPORT_NOT_IMPLEMENTED');
  assert.equal(result.result.generic_rio_bridge_reused, false);
});

test('RIO flyer requires product reference before any execution', async () => {
  const env = envWithStore();
  const result = await routeHermesCommand(env, command('rio.generate_product_flyer', 'rio'));
  assert.equal(result.execution, 'BLOCKED');
  assert.equal(result.error_code, 'PRODUCT_REFERENCE_REQUIRED');
});

test('unknown action fails closed', async () => {
  const env = envWithStore();
  const result = await routeHermesCommand(env, command('rio.unknown', 'rio'));
  assert.equal(result.execution, 'BLOCKED');
  assert.equal(result.error_code, 'ACTION_NOT_REGISTERED');
});

test('runtime snapshot reports durable command store independently from deployment state', () => {
  const env = envWithStore();
  const snapshot = hermesRuntimeSnapshot(env);
  assert.equal(snapshot.command_store.durable, true);
  assert.equal(snapshot.evidence.production_deployed, false);
});
