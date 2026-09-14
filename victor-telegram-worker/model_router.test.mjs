import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyVictorTask, rankVictorModels, resolveCogneeOpenAIModel, callCogneeInference } from './model_router.mjs';

test('classifies coding and reasoning tasks', () => {
  assert.equal(classifyVictorTask('', 'Fix this GitHub workflow bug and run tests'), 'coding');
  assert.equal(classifyVictorTask('', 'Find root cause why deployment failed'), 'reasoning');
});

test('prefers specialist coding model from discovered inventory', () => {
  const models = ['amazon.nova-lite-v1:0', 'qwen.qwen3-coder-next', 'deepseek.deepseek-v3'];
  const ranked = rankVictorModels(models, 'coding', {});
  assert.equal(ranked[0], 'qwen.qwen3-coder-next');
});

test('does not route embeddings as chat specialist', () => {
  const ranked = rankVictorModels(['amazon.titan-embed', 'qwen.qwen3-coder-next'], 'chat', {});
  assert.notEqual(ranked[0], 'amazon.titan-embed');
});

test('Cognee compatibility resolver identifies Cognee Cloud memory API without Bedrock model discovery', async () => {
  const result = await resolveCogneeOpenAIModel({ VICTOR_COGNEE_API: 'test-key', COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai' });
  assert.equal(result.status, 'COGNEE_CLOUD_MEMORY_API');
  assert.equal(result.model, null);
  assert.equal(result.discovery_status, 'NOT_APPLICABLE');
  assert.match(result.base, /cognee\.ai/);
});

test('Cognee probe uses X-Api-Key against Cognee datasets endpoint and never API_VICTOR', async () => {
  const originalFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init = {}) => {
    seen.push({
      url: String(url),
      xApiKey: init?.headers?.['X-Api-Key'] || '',
      authorization: init?.headers?.Authorization || '',
      tenantId: init?.headers?.['X-Tenant-Id'] || '',
    });
    return new Response(JSON.stringify([{ id: '1', name: 'victor_long_term_memory' }]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const result = await callCogneeInference({ VICTOR_COGNEE_API: 'cognee-key', API_VICTOR: 'main-key', COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai', COGNEE_TENANT_ID: 'tenant-test' });
    assert.equal(result.provider, 'COGNEE_CLOUD');
    assert.equal(result.discovery_status, 'COGNEE_DATASETS_VERIFIED');
    assert.equal(result.dataset_count, 1);
    assert.equal(seen.length, 1);
    assert.match(seen[0].url, /\/api\/v1\/datasets\/$/);
    assert.equal(seen[0].xApiKey, 'cognee-key');
    assert.equal(seen[0].authorization, '');
    assert.equal(seen[0].tenantId, 'tenant-test');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Cognee 401 opens durable auth circuit breaker and suppresses repeated network calls', async () => {
  const originalFetch = globalThis.fetch;
  const state = new Map();
  const store = {
    async get(key) { return state.get(key) ?? null; },
    async put(key, value) { state.set(key, value); },
    async delete(key) { state.delete(key); },
  };
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  };
  const env = { VICTOR_COGNEE_API: 'bad-key', VICTOR_CONVERSATION_STATE: store, COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai', COGNEE_TENANT_ID: 'tenant-test' };
  try {
    await assert.rejects(
      () => callCogneeInference(env),
      error => error?.code === 'COGNEE_AUTH_BLOCKED' && error?.httpStatus === 401 && error?.suppressNotification === false
    );
    assert.equal(calls, 1);
    await assert.rejects(
      () => callCogneeInference(env),
      error => error?.code === 'COGNEE_AUTH_BLOCKED' && error?.suppressNotification === true
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Cognee auth breaker resets automatically when credential changes', async () => {
  const originalFetch = globalThis.fetch;
  const state = new Map();
  const store = {
    async get(key) { return state.get(key) ?? null; },
    async put(key, value) { state.set(key, value); },
    async delete(key) { state.delete(key); },
  };
  let mode = 'bad';
  globalThis.fetch = async () => {
    if (mode === 'bad') return new Response('{}', { status: 401 });
    return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    await assert.rejects(() => callCogneeInference({ VICTOR_COGNEE_API: 'old-key', VICTOR_CONVERSATION_STATE: store, COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai', COGNEE_TENANT_ID: 'tenant-test' }));
    mode = 'good';
    const result = await callCogneeInference({ VICTOR_COGNEE_API: 'new-key', VICTOR_CONVERSATION_STATE: store, COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai', COGNEE_TENANT_ID: 'tenant-test' });
    assert.equal(result.discovery_status, 'COGNEE_DATASETS_VERIFIED');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
