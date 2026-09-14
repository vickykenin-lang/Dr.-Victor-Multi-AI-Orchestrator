from pathlib import Path
import re

worker_path = Path('victor-telegram-worker/worker.js')
router_path = Path('victor-telegram-worker/model_router.mjs')
bridge_path = Path('victor-telegram-worker/cognee_memory_bridge.mjs')
router_test_path = Path('victor-telegram-worker/model_router.test.mjs')

# ---------------------------------------------------------------------------
# 1) Correct Cognee provider contract in model_router.mjs.
#    Cognee Cloud is a memory/knowledge API, not a Bedrock inference provider.
#    Cloud authentication uses X-Api-Key against Cognee Cloud endpoints.
# ---------------------------------------------------------------------------
router = router_path.read_text(encoding='utf-8')
router_head = router.split('export async function resolveCogneeOpenAIModel', 1)[0]
if router_head == router:
    raise SystemExit('Cognee router anchor missing')

cognee_router = r'''export async function resolveCogneeOpenAIModel(env = {}) {
  // Compatibility shim retained for callers/tests that imported the old name.
  // Cognee is not an LLM model provider; no Bedrock model discovery is performed.
  const apiKey = env.VICTOR_COGNEE_API || env.COGNEE_API_KEY || '';
  if (!apiKey) return { status: 'CREDENTIAL_MISSING', model: null };
  return {
    status: 'COGNEE_CLOUD_MEMORY_API',
    model: null,
    discovery_status: 'NOT_APPLICABLE',
    base: String(env.COGNEE_SERVICE_URL || 'https://api.cognee.ai').replace(/\/$/, ''),
  };
}

export async function callCogneeInference(env = {}, system = '', userMessage = '', options = {}) {
  // Legacy function name kept to avoid a breaking import in worker.js.
  // It now performs a real Cognee Cloud authenticated API probe instead of
  // misusing the Cognee key against AWS Bedrock /models or /chat/completions.
  const apiKey = env.VICTOR_COGNEE_API || env.COGNEE_API_KEY || '';
  if (!apiKey) {
    throw Object.assign(new Error('Cognee API credential is not configured'), {
      code: 'COGNEE_API_CREDENTIAL_MISSING',
    });
  }

  const fingerprint = await credentialFingerprint(apiKey);
  const breaker = await readCogneeAuthBreaker(env);
  if (breaker?.status === 'COGNEE_AUTH_BLOCKED' && breaker?.credential_fingerprint === fingerprint) {
    throw cogneeAuthBlockedError(breaker.http_status || 401, true);
  }
  if (breaker?.credential_fingerprint && breaker.credential_fingerprint !== fingerprint) {
    await writeCogneeAuthBreaker(env, null);
  }

  const base = String(options.base || env.COGNEE_SERVICE_URL || 'https://api.cognee.ai').replace(/\/$/, '');
  let response;
  try {
    response = await fetch(`${base}/api/v1/datasets/`, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(Number(env.VICTOR_COGNEE_AI_TIMEOUT_MS || env.VICTOR_AI_TIMEOUT_MS || 25000)),
    });
  } catch (error) {
    throw Object.assign(new Error('Cognee Cloud API request could not be reached'), {
      code: 'COGNEE_API_UNREACHABLE',
      causeName: error?.name || 'FetchError',
    });
  }

  if (!response.ok) {
    if ([401, 403].includes(response.status)) {
      await writeCogneeAuthBreaker(env, {
        status: 'COGNEE_AUTH_BLOCKED',
        credential_fingerprint: fingerprint,
        http_status: response.status,
        blocked_at_utc: new Date().toISOString(),
        stage: 'COGNEE_DATASETS_AUTH_CHECK',
      });
      throw cogneeAuthBlockedError(response.status, false);
    }
    throw Object.assign(new Error('Cognee Cloud API returned non-success status'), {
      code: 'COGNEE_API_HTTP_ERROR',
      httpStatus: response.status,
    });
  }

  let payload;
  try { payload = await response.json(); } catch {
    throw Object.assign(new Error('Cognee Cloud datasets response was not valid JSON'), {
      code: 'COGNEE_API_INVALID_JSON',
    });
  }

  const datasets = Array.isArray(payload) ? payload : (payload?.data || payload?.datasets || payload?.items || []);
  await writeCogneeAuthBreaker(env, null);
  return {
    content: `Cognee Cloud API authenticated successfully; accessible datasets: ${Array.isArray(datasets) ? datasets.length : 0}.`,
    model: null,
    discovery_status: 'COGNEE_DATASETS_VERIFIED',
    credential_source: env.VICTOR_COGNEE_API ? 'VICTOR_COGNEE_API' : 'COGNEE_API_KEY',
    provider: 'COGNEE_CLOUD',
    endpoint: '/api/v1/datasets/',
    dataset_count: Array.isArray(datasets) ? datasets.length : 0,
  };
}
'''
router_path.write_text(router_head + cognee_router, encoding='utf-8')

# ---------------------------------------------------------------------------
# 2) Correct the governed long-term-memory bridge.
#    Keep its opt-in/service-url policy but use Cognee Cloud X-Api-Key auth,
#    allow the already-configured VICTOR_COGNEE_API secret as a fallback, and
#    use multipart FormData for /remember as documented by Cognee Cloud.
# ---------------------------------------------------------------------------
bridge = bridge_path.read_text(encoding='utf-8')
bridge = bridge.replace("apiKey: env.COGNEE_API_KEY || '',", "apiKey: env.COGNEE_API_KEY || env.VICTOR_COGNEE_API || '',")
bridge = bridge.replace("...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),", "...(apiKey ? { 'X-Api-Key': apiKey } : {}),")

remember_pattern = re.compile(r"export async function cogneeRemember\(env, text, metadata = \{\}\) \{.*?\n\}\n\nexport async function cogneeRecall", re.S)
remember_replacement = r'''export async function cogneeRemember(env, text, metadata = {}) {
  const c = cfg(env);
  const status = cogneeMemoryStatus(env);
  if (status.status !== 'CONFIGURED') return status;

  const record = JSON.stringify({
    authority: metadata.authority || 'VICTOR',
    source: metadata.source || 'victor',
    observed_at: metadata.observedAt || new Date().toISOString(),
    text: String(text || '').trim(),
    metadata,
  });
  const form = new FormData();
  form.append('data', new Blob([record], { type: 'application/json' }), 'victor-memory.json');
  form.append('datasetName', c.dataset);
  form.append('run_in_background', 'false');

  const res = await fetch(`${c.base}/api/v1/remember`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'X-Api-Key': c.apiKey,
    },
    body: form,
  });
  if (!res.ok) return { status: 'FAILED', stage: 'COGNEE_REMEMBER', http_status: res.status };
  return { status: 'REMEMBERED', dataset: c.dataset };
}

export async function cogneeRecall'''
bridge, count = remember_pattern.subn(remember_replacement, bridge, count=1)
if count != 1:
    raise SystemExit('Cognee remember function anchor missing')
bridge_path.write_text(bridge, encoding='utf-8')

# ---------------------------------------------------------------------------
# 3) Replace the misleading Telegram "Cognee inference" diagnostic with a
#    genuine Cognee Cloud API credential/connectivity diagnostic.
# ---------------------------------------------------------------------------
worker = worker_path.read_text(encoding='utf-8')
worker = worker.replace("cognee_inference_runtime: 'DEDICATED_OPENAI_PATH_V1'", "cognee_inference_runtime: 'COGNEE_CLOUD_MEMORY_API_V2'")
worker = worker.replace("cognee_auth_circuit_breaker: 'AUTH_401_403_HOLD_UNTIL_CREDENTIAL_CHANGE_V1'", "cognee_auth_circuit_breaker: 'COGNEE_CLOUD_AUTH_401_403_HOLD_V2'")

start = worker.find("      const explicitCogneeInferenceDiagnostic =")
end = worker.find("      if (!memoryDirective && shouldUseFactGateway", start)
if start < 0 or end < 0:
    raise SystemExit('Cognee worker diagnostic block anchors missing')

new_block = r'''      const explicitCogneeInferenceDiagnostic = /\b(cognee inference|cognee smoke|victor_cognee_api|cognee api|test cognee)\b/i.test(text);
      if (!memoryDirective && explicitCogneeInferenceDiagnostic) {
        processingStage = 'LIVE_COGNEE_API_DIAGNOSTIC';
        if (!env.VICTOR_COGNEE_API && !env.COGNEE_API_KEY) {
          await sendTelegramMessage(env, chatId, 'Cognee API check blocked hai: Cognee runtime credential configured nahi hai.', message.message_id);
          return json({ ok: false, mode: 'LIVE_COGNEE_API_DIAGNOSTIC', status: 'CREDENTIAL_MISSING', acknowledged: true }, 200);
        }
        try {
          console.log(JSON.stringify({
            event: 'VICTOR_COGNEE_DIAGNOSTIC_MATCHED',
            trace_id: traceId,
            provider: 'COGNEE_CLOUD',
            api_victor_fallback: false,
            secrets_exposed: false,
          }));
          const result = await callCogneeInference(env, '', '');
          const safeContent = String(result.content || '').trim().slice(0, 500);
          const reply = [
            'Cognee Cloud API: VERIFIED',
            `Credential path: ${result.credential_source || 'Cognee API secret'}`,
            `Provider: ${result.provider || 'COGNEE_CLOUD'}`,
            `API endpoint: ${result.endpoint || '/api/v1/datasets/'}`,
            `Accessible datasets: ${Number(result.dataset_count || 0)}`,
            `Auth/data read status: ${result.discovery_status || 'COGNEE_DATASETS_VERIFIED'}`,
            `Result: ${safeContent}`,
            'Bedrock used for Cognee: no',
            'API_VICTOR fallback: no',
            'Secrets exposed: no',
          ].join('\n');
          console.log(JSON.stringify({
            event: 'VICTOR_COGNEE_API_VERIFIED',
            trace_id: traceId,
            provider: result.provider || 'COGNEE_CLOUD',
            endpoint: result.endpoint || '/api/v1/datasets/',
            dataset_count: Number(result.dataset_count || 0),
            credential_source: result.credential_source || null,
            api_victor_fallback: false,
            secrets_exposed: false,
          }));
          await sendTelegramMessage(env, chatId, reply, message.message_id);
          return json({
            ok: true,
            mode: 'LIVE_COGNEE_API_DIAGNOSTIC',
            status: 'VERIFIED',
            provider: result.provider || 'COGNEE_CLOUD',
            endpoint: result.endpoint || '/api/v1/datasets/',
            dataset_count: Number(result.dataset_count || 0),
            credential_source: result.credential_source || null,
            api_victor_fallback: false,
            secrets_exposed: false,
          });
        } catch (error) {
          const code = error?.code || 'COGNEE_API_FAILED';
          const detail = error?.httpStatus ? ` HTTP ${error.httpStatus}.` : '';
          const suppressed = Boolean(error?.suppressNotification);
          if (!suppressed) {
            const messageText = code === 'COGNEE_AUTH_BLOCKED'
              ? `Cognee Cloud auth blocked.${detail} Same credential par retries hold hain; credential change ke baad retry allow hoga.`
              : `Cognee Cloud API check FAILED. Runtime code: ${code}.${detail}`;
            await sendTelegramMessage(env, chatId, messageText, message.message_id);
          }
          console.log(JSON.stringify({
            event: 'VICTOR_COGNEE_API_BLOCKED',
            trace_id: traceId,
            code,
            http_status: error?.httpStatus || null,
            notification_suppressed: suppressed,
            credential_change_required: Boolean(error?.credentialChangeRequired),
            acknowledged: true,
            secrets_exposed: false,
          }));
          return json({
            ok: false,
            mode: 'LIVE_COGNEE_API_DIAGNOSTIC',
            status: code === 'COGNEE_AUTH_BLOCKED' ? 'AUTH_BLOCKED' : 'FAILED',
            code,
            http_status: error?.httpStatus || null,
            notification_suppressed: suppressed,
            credential_change_required: Boolean(error?.credentialChangeRequired),
            acknowledged: true,
            secrets_exposed: false,
          }, 200);
        }
      }

'''
worker = worker[:start] + new_block + worker[end:]
worker_path.write_text(worker, encoding='utf-8')

# ---------------------------------------------------------------------------
# 4) Replace stale tests that encoded the incorrect Bedrock-for-Cognee design.
# ---------------------------------------------------------------------------
router_test_path.write_text(r'''import test from 'node:test';
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
  const result = await resolveCogneeOpenAIModel({ VICTOR_COGNEE_API: 'test-key' });
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
    });
    return new Response(JSON.stringify([{ id: '1', name: 'victor_long_term_memory' }]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const result = await callCogneeInference({ VICTOR_COGNEE_API: 'cognee-key', API_VICTOR: 'main-key' });
    assert.equal(result.provider, 'COGNEE_CLOUD');
    assert.equal(result.discovery_status, 'COGNEE_DATASETS_VERIFIED');
    assert.equal(result.dataset_count, 1);
    assert.equal(seen.length, 1);
    assert.match(seen[0].url, /\/api\/v1\/datasets\/$/);
    assert.equal(seen[0].xApiKey, 'cognee-key');
    assert.equal(seen[0].authorization, '');
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
  const env = { VICTOR_COGNEE_API: 'bad-key', VICTOR_CONVERSATION_STATE: store };
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
    await assert.rejects(() => callCogneeInference({ VICTOR_COGNEE_API: 'old-key', VICTOR_CONVERSATION_STATE: store }));
    mode = 'good';
    const result = await callCogneeInference({ VICTOR_COGNEE_API: 'new-key', VICTOR_CONVERSATION_STATE: store });
    assert.equal(result.discovery_status, 'COGNEE_DATASETS_VERIFIED');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
''', encoding='utf-8')

print('COGNEE_CLOUD_PROVIDER_CONTRACT_FIX_APPLIED')
