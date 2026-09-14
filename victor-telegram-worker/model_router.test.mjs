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

test('honors configured model only when discovered inventory contains it', () => {
  const env = { VICTOR_MODEL_EXECUTIVE: 'openai.gpt-enterprise' };
  const ranked = rankVictorModels(['claude.sonnet', 'openai.gpt-enterprise'], 'executive', env);
  assert.equal(ranked[0], 'openai.gpt-enterprise');
});

test('does not route embeddings as chat specialist', () => {
  const ranked = rankVictorModels(['amazon.titan-embed', 'qwen.qwen3-coder-next'], 'chat', {});
  assert.notEqual(ranked[0], 'amazon.titan-embed');
});

test('Cognee model resolver only selects discovered OpenAI/GPT model', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ data: [
    { id: 'amazon.nova-lite-v1:0' },
    { id: 'openai.gpt-oss-120b' },
  ] }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const result = await resolveCogneeOpenAIModel({ VICTOR_COGNEE_API: 'test-key' });
    assert.equal(result.status, 'RESOLVED');
    assert.equal(result.model, 'openai.gpt-oss-120b');
    assert.equal(result.discovery_status, 'DISCOVERED');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Cognee inference uses dedicated credential and returns live model output', async () => {
  const originalFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init = {}) => {
    seen.push({ url: String(url), auth: init?.headers?.Authorization || init?.headers?.authorization || '' });
    if (String(url).endsWith('/models')) {
      return new Response(JSON.stringify({ data: [{ id: 'openai.gpt-oss-120b' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: 'cognee-live-ok' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await callCogneeInference(
      { VICTOR_COGNEE_API: 'cognee-only-key', API_VICTOR: 'main-key' },
      'diagnostic',
      'reply briefly'
    );
    assert.equal(result.model, 'openai.gpt-oss-120b');
    assert.equal(result.content, 'cognee-live-ok');
    assert.equal(result.credential_source, 'VICTOR_COGNEE_API');
    assert.equal(seen.length, 2);
    assert.ok(seen.every(item => item.auth === 'Bearer cognee-only-key'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
