import test from 'node:test';
import assert from 'node:assert/strict';
import { cogneeMemoryStatus, cogneeRecall, mergeCogneeContext } from './cognee_memory_bridge.mjs';

test('Cognee bridge is opt-in', () => {
  assert.equal(cogneeMemoryStatus({}).status, 'DISABLED');
});

test('enabled bridge requires service URL before runtime use', () => {
  assert.equal(cogneeMemoryStatus({ COGNEE_MEMORY_ENABLED: 'true' }).reason, 'COGNEE_SERVICE_URL_NOT_CONFIGURED');
});

test('enabled bridge requires API key', () => {
  const status = cogneeMemoryStatus({ COGNEE_MEMORY_ENABLED: 'true', COGNEE_SERVICE_URL: 'https://example.invalid' });
  assert.equal(status.reason, 'COGNEE_API_KEY_NOT_CONFIGURED');
});

test('Cognee recall remains advisory beside authoritative Victor memory', () => {
  const base = { prompt: 'ACTIVE FOUNDER DECISIONS', memories: [{ id: 'authoritative' }] };
  const merged = mergeCogneeContext(base, { status: 'RECALLED', results: [{ text: 'graph memory' }] });
  assert.deepEqual(merged.memories, base.memories);
  assert.match(merged.prompt, /never overrides active Founder decisions or verified evidence/i);
  assert.deepEqual(merged.cogneeMemory, [{ text: 'graph memory' }]);
});

test('enabled bridge requires tenant id after URL and API key', () => {
  const status = cogneeMemoryStatus({
    COGNEE_MEMORY_ENABLED: 'true',
    COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai',
    COGNEE_API_KEY: 'test-key',
  });
  assert.equal(status.reason, 'COGNEE_TENANT_ID_NOT_CONFIGURED');
});

test('Cognee recall uses Cloud API camelCase request fields', async () => {
  const originalFetch = globalThis.fetch;
  let body;
  globalThis.fetch = async (_url, init = {}) => {
    body = JSON.parse(String(init.body || '{}'));
    return new Response(JSON.stringify([{ context: 'Falcon validation code is CF-914-VG' }]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const result = await cogneeRecall({
      COGNEE_MEMORY_ENABLED: 'true',
      COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai',
      COGNEE_API_KEY: 'test-key',
      COGNEE_TENANT_ID: 'tenant-test',
    }, 'Falcon validation code?', { topK: 7, sessionId: 'session-1' });
    assert.equal(result.status, 'RECALLED');
    assert.equal(body.topK, 7);
    assert.equal(body.onlyContext, true);
    assert.equal(body.sessionId, 'session-1');
    assert.ok(!('top_k' in body));
    assert.ok(!('only_context' in body));
    assert.ok(!('session_id' in body));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
