import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_HERMES_CONTEXT, loadHermesContext } from './hermes_context_registry.mjs';

test('context registry returns source bootstrap when durable context is absent', async () => {
  const result = await loadHermesContext({});
  assert.equal(result.source, 'SOURCE_BOOTSTRAP');
  assert.equal(result.persisted, false);
  assert.equal(result.context.context_version, DEFAULT_HERMES_CONTEXT.context_version);
  assert.equal(result.context.safety.never_treat_memory_as_runtime_proof, true);
});

test('context registry prefers durable context when present', async () => {
  const stored = { context_version: 'custom-v2', purpose: 'durable test context' };
  const env = {
    HERMES_COMMAND_STORE: {
      async get(key, options = {}) {
        assert.equal(key, 'context:hermes:active');
        assert.equal(options.type, 'json');
        return stored;
      },
    },
  };
  const result = await loadHermesContext(env);
  assert.equal(result.source, 'DURABLE_KV');
  assert.equal(result.persisted, true);
  assert.deepEqual(result.context, stored);
});
