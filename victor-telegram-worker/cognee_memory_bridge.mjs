// Governed Cognee long-term memory bridge for Victor.
// Existing GitHub memory remains authoritative. Cognee is retrieval/enrichment only.

function cfg(env) {
  const base = String(env.COGNEE_SERVICE_URL || '').replace(/\/$/, '');
  return {
    enabled: String(env.COGNEE_MEMORY_ENABLED || '').toLowerCase() === 'true',
    base,
    apiKey: env.COGNEE_API_KEY || '',
    dataset: env.COGNEE_DATASET || 'victor_long_term_memory',
    tenantId: String(env.COGNEE_TENANT_ID || '').trim(),
    rememberTimeoutMs: Number(env.COGNEE_REMEMBER_TIMEOUT_MS || 25000),
    recallTimeoutMs: Number(env.COGNEE_RECALL_TIMEOUT_MS || 6000),
    improveTimeoutMs: Number(env.COGNEE_IMPROVE_TIMEOUT_MS || 10000),
  };
}

function headers(apiKey, tenantId) {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
    ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
  };
}

function signal(timeoutMs) {
  return AbortSignal.timeout(Math.max(1000, Number(timeoutMs || 5000)));
}

export function cogneeMemoryStatus(env = {}) {
  const c = cfg(env);
  if (!c.enabled) return { status: 'DISABLED' };
  if (!c.base) return { status: 'PENDING_CONFIGURATION', reason: 'COGNEE_SERVICE_URL_NOT_CONFIGURED' };
  if (!c.apiKey) return { status: 'PENDING_CONFIGURATION', reason: 'COGNEE_API_KEY_NOT_CONFIGURED' };
  if (!c.tenantId) return { status: 'PENDING_CONFIGURATION', reason: 'COGNEE_TENANT_ID_NOT_CONFIGURED' };
  return {
    status: 'CONFIGURED',
    dataset: c.dataset,
    provider: 'COGNEE',
  };
}

export function cogneeInferenceStatus(env = {}) {
  const c = cfg(env);
  if (!c.apiKey) return { status: 'PENDING_CONFIGURATION', reason: 'COGNEE_API_KEY_NOT_CONFIGURED' };
  return { status: 'CREDENTIAL_CONFIGURED', provider: 'COGNEE' };
}

export function getCogneeInferenceCredential(env = {}) {
  return cfg(env).apiKey;
}

export async function cogneeRemember(env, text, metadata = {}) {
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

  let res;
  try {
    res = await fetch(`${c.base}/api/v1/remember`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-Api-Key': c.apiKey,
        'X-Tenant-Id': c.tenantId,
      },
      body: form,
      signal: signal(c.rememberTimeoutMs),
    });
  } catch (error) {
    return { status: 'FAILED', stage: 'COGNEE_REMEMBER', reason: error?.name || 'FETCH_ERROR' };
  }
  if (!res.ok) return { status: 'FAILED', stage: 'COGNEE_REMEMBER', http_status: res.status };
  return { status: 'REMEMBERED', dataset: c.dataset };
}

export async function cogneeRecall(env, query, options = {}) {
  const c = cfg(env);
  const status = cogneeMemoryStatus(env);
  if (status.status !== 'CONFIGURED') return { ...status, results: [] };

  let res;
  try {
    res = await fetch(`${c.base}/api/v1/recall`, {
      method: 'POST',
      headers: headers(c.apiKey, c.tenantId),
      body: JSON.stringify({
        query: String(query || ''),
        datasets: [c.dataset],
        top_k: Math.max(1, Math.min(Number(options.topK || 5), 15)),
        only_context: true,
        ...(options.sessionId ? { session_id: String(options.sessionId) } : {}),
      }),
      signal: signal(options.timeoutMs || c.recallTimeoutMs),
    });
  } catch (error) {
    return { status: 'FAILED', stage: 'COGNEE_RECALL', reason: error?.name || 'FETCH_ERROR', results: [] };
  }
  if (!res.ok) return { status: 'FAILED', stage: 'COGNEE_RECALL', http_status: res.status, results: [] };
  let payload;
  try {
    payload = await res.json();
  } catch {
    return { status: 'FAILED', stage: 'COGNEE_RECALL', reason: 'INVALID_JSON', results: [] };
  }
  const results = Array.isArray(payload) ? payload : (payload?.results || payload?.items || []);
  return { status: 'RECALLED', dataset: c.dataset, results };
}

export async function cogneeImprove(env, sessionIds = []) {
  const c = cfg(env);
  const status = cogneeMemoryStatus(env);
  if (status.status !== 'CONFIGURED') return status;
  let res;
  try {
    res = await fetch(`${c.base}/api/v1/improve`, {
      method: 'POST',
      headers: headers(c.apiKey, c.tenantId),
      body: JSON.stringify({ dataset_name: c.dataset, session_ids: sessionIds, run_in_background: true }),
      signal: signal(c.improveTimeoutMs),
    });
  } catch (error) {
    return { status: 'FAILED', stage: 'COGNEE_IMPROVE', reason: error?.name || 'FETCH_ERROR' };
  }
  if (!res.ok) return { status: 'FAILED', stage: 'COGNEE_IMPROVE', http_status: res.status };
  return { status: 'IMPROVE_REQUESTED', dataset: c.dataset };
}

// Cognee output is deliberately separated from authoritative Victor memory.
// Callers must never let a Cognee result override active Founder decisions or verified evidence.
export function mergeCogneeContext(authoritativeContext, cogneeResult) {
  const graph = cogneeResult?.status === 'RECALLED' ? cogneeResult.results : [];
  return {
    ...authoritativeContext,
    cogneeMemory: graph,
    prompt: `${authoritativeContext?.prompt || ''}\nCOGNEE LONG-TERM RECALL (advisory; never overrides active Founder decisions or verified evidence):\n${JSON.stringify(graph)}`,
  };
}
