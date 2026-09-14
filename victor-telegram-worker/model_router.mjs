const DEFAULT_BEDROCK_BASE = 'https://bedrock-mantle.us-east-1.api.aws/v1';
const DEFAULT_FALLBACK_MODEL = 'qwen.qwen3-coder-next';

function norm(value) {
  return String(value || '').trim();
}

function modelId(item) {
  if (typeof item === 'string') return item;
  return item?.id || item?.model_id || item?.modelId || item?.name || '';
}

function scoreModel(id, task) {
  const value = String(id || '').toLowerCase();
  let score = 0;
  const has = token => value.includes(token);

  if (task === 'coding') {
    if (has('coder') || has('code')) score += 100;
    if (has('qwen')) score += 35;
    if (has('claude') || has('openai')) score += 20;
  } else if (task === 'reasoning') {
    if (has('deepseek')) score += 95;
    if (has('reason') || has('r1')) score += 85;
    if (has('claude') || has('openai')) score += 55;
    if (has('qwen')) score += 35;
  } else if (task === 'executive') {
    if (has('claude')) score += 90;
    if (has('openai') || has('gpt')) score += 85;
    if (has('nova') && (has('pro') || has('premier'))) score += 65;
    if (has('deepseek')) score += 45;
  } else if (task === 'fast') {
    if (has('lite') || has('mini') || has('small') || has('flash')) score += 90;
    if (has('nova')) score += 55;
    if (has('qwen')) score += 35;
  } else {
    if (has('claude')) score += 70;
    if (has('openai') || has('gpt')) score += 65;
    if (has('qwen')) score += 50;
    if (has('nova')) score += 40;
  }

  if (has('embed') || has('image') || has('video') || has('rerank')) score -= 500;
  return score;
}

export function classifyVictorTask(system = '', userMessage = '') {
  const value = `${system}\n${userMessage}`.toLowerCase();
  if (/\b(code|coding|javascript|python|github|workflow|bug|debug|repository|repo|syntax|test failure|implementation)\b/.test(value)) return 'coding';
  if (/\b(root cause|reasoning|diagnos|investigat|why failed|failure|blocker|recover|repair|contradiction)\b/.test(value)) return 'reasoning';
  if (/\b(executive|strategy|decision|objective|cross-department|business plan|synthesis|founder)\b/.test(value)) return 'executive';
  if (/\b(classify|classification|intent|route|routing|short answer|quick|fast)\b/.test(value)) return 'fast';
  return 'chat';
}

export async function discoverBedrockModels(env = {}, options = {}) {
  const apiKey = options.apiKey || env.API_VICTOR || '';
  const base = norm(options.base || env.VICTOR_BEDROCK_BASE || DEFAULT_BEDROCK_BASE).replace(/\/$/, '');
  if (!apiKey) return { status: 'CREDENTIAL_MISSING', models: [], base };

  let response;
  try {
    response = await fetch(`${base}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(Number(env.VICTOR_MODEL_DISCOVERY_TIMEOUT_MS || 8000)),
    });
  } catch (error) {
    return { status: 'DISCOVERY_UNREACHABLE', models: [], base, error: error?.name || 'FetchError' };
  }
  if (!response.ok) return { status: 'DISCOVERY_HTTP_ERROR', http_status: response.status, models: [], base };

  let payload;
  try { payload = await response.json(); } catch { return { status: 'DISCOVERY_INVALID_JSON', models: [], base }; }
  const raw = Array.isArray(payload) ? payload : (payload?.data || payload?.models || payload?.items || []);
  const models = raw.map(modelId).filter(Boolean);
  return { status: 'DISCOVERED', models: [...new Set(models)], base };
}

function configuredCandidates(env, task) {
  const map = {
    coding: env.VICTOR_MODEL_CODING,
    reasoning: env.VICTOR_MODEL_REASONING,
    executive: env.VICTOR_MODEL_EXECUTIVE,
    fast: env.VICTOR_MODEL_FAST,
    chat: env.VICTOR_MODEL_CHAT,
  };
  return [map[task], env.VICTOR_MODEL, DEFAULT_FALLBACK_MODEL].map(norm).filter(Boolean);
}

export function rankVictorModels(models = [], task = 'chat', env = {}) {
  const available = [...new Set(models.map(norm).filter(Boolean))];
  const explicit = configuredCandidates(env, task);
  const ordered = [];
  for (const candidate of explicit) {
    if (!available.length || available.includes(candidate)) ordered.push(candidate);
  }
  const scored = available
    .filter(id => !ordered.includes(id))
    .map(id => ({ id, score: scoreModel(id, task) }))
    .filter(x => x.score > -100)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map(x => x.id);
  return [...new Set([...ordered, ...scored])];
}

export async function resolveVictorModelRoute(env = {}, system = '', userMessage = '', options = {}) {
  const task = options.task || classifyVictorTask(system, userMessage);
  const apiKey = options.apiKey || env.API_VICTOR || '';
  const discovery = await discoverBedrockModels(env, { apiKey, base: options.base });
  const candidates = rankVictorModels(discovery.models, task, env);
  if (!candidates.length) candidates.push(...configuredCandidates(env, task));
  return {
    task,
    base: discovery.base || norm(env.VICTOR_BEDROCK_BASE || DEFAULT_BEDROCK_BASE).replace(/\/$/, ''),
    discovery_status: discovery.status,
    candidates: [...new Set(candidates)].filter(Boolean),
  };
}

export async function callVictorModel(env, system, userMessage, options = {}) {
  const apiKey = options.apiKey || env.API_VICTOR || '';
  if (!apiKey) throw Object.assign(new Error('API_VICTOR is not configured'), { code: 'AI_CREDENTIAL_MISSING' });

  const route = await resolveVictorModelRoute(env, system, userMessage, options);
  const failures = [];
  for (const model of route.candidates.slice(0, Number(env.VICTOR_MODEL_MAX_ATTEMPTS || 4))) {
    let response;
    try {
      response = await fetch(`${route.base}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: system }, { role: 'user', content: userMessage }],
          temperature: Number(options.temperature ?? 0.15),
          max_tokens: Number(options.maxTokens ?? 700),
        }),
        signal: AbortSignal.timeout(Number(env.VICTOR_AI_TIMEOUT_MS || 25000)),
      });
    } catch (error) {
      failures.push({ model, code: error?.name || 'FetchError' });
      continue;
    }
    if (!response.ok) {
      failures.push({ model, http_status: response.status });
      continue;
    }
    let payload;
    try { payload = await response.json(); } catch {
      failures.push({ model, code: 'INVALID_JSON' });
      continue;
    }
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) {
      return { content: content.trim(), model, task: route.task, discovery_status: route.discovery_status, failures };
    }
    failures.push({ model, code: 'EMPTY_RESPONSE' });
  }

  const error = new Error('No compatible Victor model produced a valid response');
  error.code = 'AI_MODEL_ROUTER_EXHAUSTED';
  error.modelFailures = failures;
  throw error;
}

export async function resolveCogneeOpenAIModel(env = {}) {
  const apiKey = env.VICTOR_COGNEE_API || '';
  if (!apiKey) return { status: 'CREDENTIAL_MISSING', model: null };
  const discovery = await discoverBedrockModels(env, { apiKey });
  const openAiModels = discovery.models.filter(id => /(^|[.\-_])(openai|gpt)([.\-_]|$)/i.test(id));
  const configured = norm(env.VICTOR_COGNEE_MODEL);
  if (configured && (!openAiModels.length || openAiModels.includes(configured))) {
    return { status: 'RESOLVED', model: configured, discovery_status: discovery.status, base: discovery.base };
  }
  const ranked = openAiModels
    .map(id => ({ id, score: scoreModel(id, 'chat') + (/gpt/i.test(id) ? 20 : 0) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return ranked.length
    ? { status: 'RESOLVED', model: ranked[0].id, discovery_status: discovery.status, base: discovery.base }
    : { status: 'OPENAI_MODEL_NOT_VERIFIED', model: null, discovery_status: discovery.status, base: discovery.base };
}

export async function callCogneeInference(env = {}, system = '', userMessage = '', options = {}) {
  const apiKey = env.VICTOR_COGNEE_API || '';
  if (!apiKey) throw Object.assign(new Error('VICTOR_COGNEE_API is not configured'), { code: 'COGNEE_INFERENCE_CREDENTIAL_MISSING' });

  const resolved = await resolveCogneeOpenAIModel(env);
  if (resolved.status !== 'RESOLVED' || !resolved.model) {
    throw Object.assign(new Error('No verified OpenAI model available for Cognee inference'), {
      code: 'COGNEE_OPENAI_MODEL_NOT_VERIFIED',
      discoveryStatus: resolved.discovery_status || null,
    });
  }

  const base = norm(options.base || resolved.base || env.VICTOR_BEDROCK_BASE || DEFAULT_BEDROCK_BASE).replace(/\/$/, '');
  let response;
  try {
    response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: resolved.model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: userMessage }],
        temperature: Number(options.temperature ?? 0.1),
        max_tokens: Number(options.maxTokens ?? 300),
      }),
      signal: AbortSignal.timeout(Number(env.VICTOR_COGNEE_AI_TIMEOUT_MS || env.VICTOR_AI_TIMEOUT_MS || 25000)),
    });
  } catch (error) {
    throw Object.assign(new Error('Cognee inference request could not reach Bedrock'), {
      code: 'COGNEE_INFERENCE_UNREACHABLE',
      causeName: error?.name || 'FetchError',
    });
  }

  if (!response.ok) {
    throw Object.assign(new Error('Cognee inference request returned non-success status'), {
      code: 'COGNEE_INFERENCE_HTTP_ERROR',
      httpStatus: response.status,
    });
  }

  let payload;
  try { payload = await response.json(); } catch {
    throw Object.assign(new Error('Cognee inference response was not valid JSON'), { code: 'COGNEE_INFERENCE_INVALID_JSON' });
  }
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw Object.assign(new Error('Cognee inference response was empty'), { code: 'COGNEE_INFERENCE_EMPTY_RESPONSE' });
  }

  return {
    content: content.trim(),
    model: resolved.model,
    discovery_status: resolved.discovery_status || null,
    credential_source: 'VICTOR_COGNEE_API',
  };
}
