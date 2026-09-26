import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFactRequest, collectFactEvidence } from './fact_runtime.mjs';

test('exact RIO heartbeat timestamp is fact query', () => {
  const q = classifyFactRequest('data/rio_work_status.json se last successful heartbeat ka exact timestamp batao');
  assert.equal(q.matched, true);
  assert.equal(q.asksHeartbeat, true);
  assert.ok(q.targets.includes('rio'));
});

test('heartbeat count request is detected', () => {
  const q = classifyFactRequest('total kitne heartbeat cycles fail hue aur kitne complete hue exact number batao');
  assert.equal(q.matched, true);
  assert.equal(q.asksCounts, true);
});

test('AURA3 last commit request targets AURA3', () => {
  const q = classifyFactRequest('AURA3 GitHub repo ka last commit activity date batao');
  assert.equal(q.asksCommit, true);
  assert.ok(q.targets.includes('aura3'));
});

test('multi-target question preserves all named departments', () => {
  const q = classifyFactRequest('Tony ka last commit aur AURA3 repo ka last activity date exact batao');
  assert.ok(q.targets.includes('tony_stark'));
  assert.ok(q.targets.includes('aura3'));
});

test('Instagram pause truth is evidence query', () => {
  const q = classifyFactRequest('RIO Instagram auto-publish abhi paused hai ya enabled? exact current setting batao');
  assert.equal(q.asksPause, true);
  assert.ok(q.targets.includes('rio'));
});

test('CASE 3: natural LLM connectivity question requires fresh runtime evidence', () => {
  const q = classifyFactRequest('Founder ke taur par batao koi LLM connected hai?');
  assert.equal(q.matched, true);
  assert.equal(q.asksLlmConnectivity, true);
});

test('CASE 3: configured credential is not reported as live verified when inference is disabled', async () => {
  const evidence = await collectFactEvidence(
    { API_VICTOR: 'configured-only', ENABLE_AI_INFERENCE: 'false' },
    'koi LLM connected hai?',
  );
  assert.equal(evidence.llm_runtime.credential_configured, true);
  assert.equal(evidence.llm_runtime.inference_enabled, false);
  assert.equal(evidence.llm_runtime.live_request_verified, false);
  assert.equal(evidence.llm_runtime.real_output_verified, false);
  assert.equal(evidence.llm_runtime.status, 'INFERENCE_DISABLED');
});

test('CASE 3: fresh successful model probe proves live request and real output separately', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/models')) {
      return new Response(JSON.stringify({ data: [{ id: 'qwen.qwen3-coder-next' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (String(url).endsWith('/chat/completions')) {
      return new Response(JSON.stringify({ choices: [{ message: { content: 'fresh live inference confirmed' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('{}', { status: 404 });
  };
  try {
    const evidence = await collectFactEvidence(
      { API_VICTOR: 'test-key', ENABLE_AI_INFERENCE: 'true', VICTOR_MODEL_MAX_ATTEMPTS: 1 },
      'Founder ke taur par batao koi LLM connected hai?',
    );
    assert.equal(evidence.llm_runtime.status, 'LIVE_VERIFIED');
    assert.equal(evidence.llm_runtime.credential_configured, true);
    assert.equal(evidence.llm_runtime.live_request_verified, true);
    assert.equal(evidence.llm_runtime.real_output_verified, true);
    assert.equal(evidence.llm_runtime.selected_model, 'qwen.qwen3-coder-next');
    assert.equal(evidence.llm_runtime.discovery_status, 'DISCOVERED');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
