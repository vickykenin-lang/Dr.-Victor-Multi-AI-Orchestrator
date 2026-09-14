import test from 'node:test';
import assert from 'node:assert/strict';
import { cogneeMemoryStatus, mergeCogneeContext } from './cognee_memory_bridge.mjs';

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
