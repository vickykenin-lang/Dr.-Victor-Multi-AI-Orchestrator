// Governed Cognee long-term memory bridge for Victor.
// Existing GitHub memory remains authoritative. Cognee is retrieval/enrichment only.

function cfg(env) {
  const base = String(env.COGNEE_SERVICE_URL || '').replace(/\/$/, '');
  return {
    enabled: String(env.COGNEE_MEMORY_ENABLED || '').toLowerCase() === 'true',
    base,
    apiKey: env.COGNEE_API_KEY || '',
    dataset: env.COGNEE_DATASET || 'victor_long_term_memory',
  };
}

function headers(apiKey) {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}

export function cogneeMemoryStatus(env = {}) {
  const c = cfg(env);
  if (!c.enabled) return { status: 'DISABLED' };
  if (!c.base) return { status: 'PENDING_CONFIGURATION', reason: 'COGNEE_SERVICE_URL_NOT_CONFIGURED' };
  if (!c.apiKey) return { status: 'PENDING_CONFIGURATION', reason: 'COGNEE_API_KEY_NOT_CONFIGURED' };
  return { status: 'CONFIGURED', dataset: c.dataset };
}

export async function cogneeRemember(env, text, metadata = {}) {
  const c = cfg(env);
  const status = cogneeMemoryStatus(env);
  if (status.status !== 'CONFIGURED') return status;
  const body = {
    data: JSON.stringify({
      authority: metadata.authority || 'VICTOR',
      source: metadata.source || 'victor',
      observed_at: metadata.observedAt || new Date().toISOString(),
      text: String(text || '').trim(),
      metadata,
    }),
    dataset_name: c.dataset,
    self_improvement: true,
  };
  const res = await fetch(`${c.base}/api/v1/remember`, {
    method: 'POST', headers: headers(c.apiKey), body: JSON.stringify(body),
  });
  if (!res.ok) return { status: 'FAILED', stage: 'COGNEE_REMEMBER', http_status: res.status };
  return { status: 'REMEMBERED', dataset: c.dataset };
}

export async function cogneeRecall(env, query, options = {}) {
  const c = cfg(env);
  const status = cogneeMemoryStatus(env);
  if (status.status !== 'CONFIGURED') return { ...status, results: [] };
  const res = await fetch(`${c.base}/api/v1/recall`, {
    method: 'POST',
    headers: headers(c.apiKey),
    body: JSON.stringify({
      query: String(query || ''),
      datasets: [c.dataset],
      top_k: Math.max(1, Math.min(Number(options.topK || 5), 15)),
      only_context: true,
      ...(options.sessionId ? { session_id: String(options.sessionId) } : {}),
    }),
  });
  if (!res.ok) return { status: 'FAILED', stage: 'COGNEE_RECALL', http_status: res.status, results: [] };
  const payload = await res.json();
  const results = Array.isArray(payload) ? payload : (payload?.results || payload?.items || []);
  return { status: 'RECALLED', dataset: c.dataset, results };
}

export async function cogneeImprove(env, sessionIds = []) {
  const c = cfg(env);
  const status = cogneeMemoryStatus(env);
  if (status.status !== 'CONFIGURED') return status;
  const res = await fetch(`${c.base}/api/v1/improve`, {
    method: 'POST', headers: headers(c.apiKey),
    body: JSON.stringify({ dataset_name: c.dataset, session_ids: sessionIds, run_in_background: true }),
  });
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
