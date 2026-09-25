import test from 'node:test';
import assert from 'node:assert/strict';
import { endgameRuntimeHealth, runEndgameRuntimeAcceptance } from './endgame_runtime_acceptance.mjs';

function kvStore() {
  const map = new Map();
  return {
    async get(key, options) {
      if (!map.has(key)) return null;
      const raw = map.get(key);
      if (options?.type === 'json') return JSON.parse(raw);
      return raw;
    },
    async put(key, value) { map.set(key, String(value)); },
  };
}

function env() {
  return {
    VICTOR_CONVERSATION_STATE: kvStore(),
    COGNEE_MEMORY_ENABLED: 'true',
    COGNEE_SERVICE_URL: 'https://cognee.example.test',
    COGNEE_API_KEY: 'test-key',
    COGNEE_TENANT_ID: 'tenant-test',
    COGNEE_DATASET: 'victor_long_term_memory',
  };
}

test('health proves verified LLM-free procedure without enabling autonomy', () => {
  const health = endgameRuntimeHealth(env(), '2026-09-25T16:30:00.000Z');
  assert.equal(health.status, 'READY');
  assert.equal(health.degraded_mode, 'DEGRADED_VERIFIED_PROCEDURE');
  assert.equal(health.manual_trigger_only, true);
  assert.equal(health.truthful_telemetry_surface, 'LIVE');
  assert.equal(health.production_autonomy_enabled, false);
});

test('acceptance verifies procedure, telemetry, durable episode round-trip and Cognee recall', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /\/api\/v1\/recall$/);
    return new Response(JSON.stringify({ results: [{ context: 'Falcon validation code CF-914-VG' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const result = await runEndgameRuntimeAcceptance(env(), {
      traceId: 'unit-1',
      now: '2026-09-25T16:31:00.000Z',
      query: 'Falcon validation code',
    });
    assert.equal(result.status, 'PASS');
    assert.equal(result.procedure_registry_live, true);
    assert.equal(result.degraded_mode_live, true);
    assert.equal(result.truthful_telemetry_live, true);
    assert.equal(result.experience_ledger_readback_verified, true);
    assert.equal(result.experience_advisory_reuse_verified, true);
    assert.equal(result.cognee_semantic_roundtrip_verified, true);
    assert.equal(result.production_autonomy_enabled, false);
    assert.deepEqual(result.blockers, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
