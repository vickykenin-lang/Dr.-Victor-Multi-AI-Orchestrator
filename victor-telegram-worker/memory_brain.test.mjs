import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMemoryWrite, memoryBrainStatus, writeVictorMemory, recallVictorMemory } from './memory_brain.mjs';

test('ordinary explicit memory routes semantic only', () => {
  assert.equal(classifyMemoryWrite('Remember this: Project Falcon code is CF-914-VG.').route, 'SEMANTIC_ONLY');
});

test('Founder canonical rule routes canonical and semantic', () => {
  assert.equal(classifyMemoryWrite('Founder decision: never change Day 0 objective.').route, 'CANONICAL_AND_SEMANTIC');
});

test('memory brain reports degraded when semantic provider is not configured', () => {
  const status = memoryBrainStatus({});
  assert.equal(status.status, 'DEGRADED');
  assert.equal(status.semantic_provider, 'COGNEE');
});

test('semantic write uses Cognee and does not require GitHub for ordinary memory', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /\/api\/v1\/remember$/);
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['X-Api-Key'], 'cognee-key');
    assert.equal(init.headers['X-Tenant-Id'], 'tenant-test');
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    let canonicalCalls = 0;
    const result = await writeVictorMemory({
      COGNEE_MEMORY_ENABLED: 'true',
      COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai',
      COGNEE_TENANT_ID: 'tenant-test',
      COGNEE_API_KEY: 'cognee-key',
    }, 'Remember this: Project Falcon code is CF-914-VG.', {}, async () => {
      canonicalCalls += 1;
      return { status: 'PERSISTED' };
    });
    assert.equal(result.status, 'PERSISTED');
    assert.equal(result.semantic.status, 'REMEMBERED');
    assert.equal(result.canonical.status, 'NOT_REQUIRED');
    assert.equal(canonicalCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('canonical rule writes both GitHub and Cognee', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    let canonicalCalls = 0;
    const result = await writeVictorMemory({
      COGNEE_MEMORY_ENABLED: 'true',
      COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai',
      COGNEE_TENANT_ID: 'tenant-test',
      COGNEE_API_KEY: 'cognee-key',
    }, 'Founder decision: never change Day 0 objective.', {}, async () => {
      canonicalCalls += 1;
      return { status: 'PERSISTED' };
    });
    assert.equal(result.status, 'PERSISTED');
    assert.equal(result.canonical.status, 'PERSISTED');
    assert.equal(result.semantic.status, 'REMEMBERED');
    assert.equal(canonicalCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('semantic recall merges Cognee context without replacing authoritative memory', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /\/api\/v1\/recall$/);
    assert.equal(init.headers['X-Api-Key'], 'cognee-key');
    return new Response(JSON.stringify([{ text: 'Project Falcon code is CF-914-VG.' }]), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const base = { prompt: 'CANONICAL TRUTH', memories: [{ id: 'locked' }] };
    const result = await recallVictorMemory({
      COGNEE_MEMORY_ENABLED: 'true',
      COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai',
      COGNEE_TENANT_ID: 'tenant-test',
      COGNEE_API_KEY: 'cognee-key',
    }, 'What is the Falcon code?', base);
    assert.deepEqual(result.memories, base.memories);
    assert.equal(result.semantic_recall_status, 'RECALLED');
    assert.match(result.prompt, /CF-914-VG/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
