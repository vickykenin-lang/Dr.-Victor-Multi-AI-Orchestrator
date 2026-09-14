// Victor Memory Brain V1
// Layer 1: active/session state remains in Cloudflare KV.
// Layer 2: canonical Founder truth remains in GitHub.
// Layer 3: semantic long-term memory is provided through a pluggable provider (Cognee today).
// Layer 4: structured observability is emitted for every semantic write/recall.

import {
  cogneeMemoryStatus,
  cogneeRemember,
  cogneeRecall,
  mergeCogneeContext,
} from './cognee_memory_bridge.mjs';

const CANONICAL_PATTERNS = [
  /\b(founder\s+(decision|rule|instruction)|final\s+decision|architecture\s+lock|master\s+rule|policy)\b/i,
  /\b(lock\s+(this|it)|permanent\s+rule|must\s+always|must\s+never|never\s+change)\b/i,
  /\b(authoritative|canonical|source\s+of\s+truth)\b/i,
];

function nowMs() {
  return Date.now();
}

function emit(event, data = {}) {
  console.log(JSON.stringify({
    event,
    ...data,
    observed_at_utc: new Date().toISOString(),
    secrets_exposed: false,
  }));
}

export function classifyMemoryWrite(text = '') {
  const value = String(text || '').trim();
  const canonical = CANONICAL_PATTERNS.some(rx => rx.test(value));
  return {
    explicit: Boolean(value),
    canonical,
    semantic: Boolean(value),
    route: canonical ? 'CANONICAL_AND_SEMANTIC' : 'SEMANTIC_ONLY',
  };
}

export function memoryBrainStatus(env = {}) {
  const cognee = cogneeMemoryStatus(env);
  return {
    status: cognee.status === 'CONFIGURED' ? 'READY' : 'DEGRADED',
    version: 'MEMORY_BRAIN_V1',
    active_layer: 'CLOUDFLARE_KV',
    canonical_layer: 'GITHUB',
    semantic_provider: 'COGNEE',
    semantic_provider_status: cognee.status,
    semantic_provider_reason: cognee.reason || null,
    observability: 'STRUCTURED_CLOUDFLARE_LOGS_V1',
    provider_interface: 'REMEMBER_RECALL_IMPROVE_HEALTH_V1',
  };
}

export async function writeVictorMemory(env, text, metadata = {}, canonicalWriter = null) {
  const route = classifyMemoryWrite(text);
  const started = nowMs();
  const result = {
    status: 'FAILED',
    route: route.route,
    canonical: { requested: route.canonical, status: route.canonical ? 'NOT_ATTEMPTED' : 'NOT_REQUIRED' },
    semantic: { requested: route.semantic, status: route.semantic ? 'NOT_ATTEMPTED' : 'NOT_REQUIRED' },
  };

  if (route.canonical) {
    if (typeof canonicalWriter !== 'function') {
      result.canonical = { requested: true, status: 'PENDING_CONFIGURATION', reason: 'CANONICAL_WRITER_NOT_AVAILABLE' };
    } else {
      try {
        const canonical = await canonicalWriter();
        result.canonical = { requested: true, ...canonical };
      } catch (error) {
        result.canonical = { requested: true, status: 'FAILED', reason: error?.code || error?.name || 'CANONICAL_WRITE_ERROR' };
      }
    }
  }

  if (route.semantic) {
    const semanticStarted = nowMs();
    try {
      const semantic = await cogneeRemember(env, text, {
        ...metadata,
        authority: route.canonical ? 'FOUNDER' : (metadata.authority || 'VICTOR'),
        source: metadata.source || 'telegram',
      });
      result.semantic = { requested: true, ...semantic };
      emit('VICTOR_MEMORY_SEMANTIC_WRITE', {
        provider: 'COGNEE',
        status: semantic.status,
        latency_ms: nowMs() - semanticStarted,
        route: route.route,
      });
    } catch (error) {
      result.semantic = { requested: true, status: 'FAILED', reason: error?.code || error?.name || 'SEMANTIC_WRITE_ERROR' };
      emit('VICTOR_MEMORY_SEMANTIC_WRITE', {
        provider: 'COGNEE',
        status: 'FAILED',
        reason: result.semantic.reason,
        latency_ms: nowMs() - semanticStarted,
        route: route.route,
      });
    }
  }

  const canonicalOk = !route.canonical || ['PERSISTED', 'ALREADY_PRESENT'].includes(result.canonical.status);
  const semanticOk = !route.semantic || result.semantic.status === 'REMEMBERED';
  result.status = canonicalOk && semanticOk ? 'PERSISTED' : 'FAILED';
  result.latency_ms = nowMs() - started;

  emit('VICTOR_MEMORY_WRITE', {
    status: result.status,
    route: route.route,
    canonical_status: result.canonical.status,
    semantic_status: result.semantic.status,
    latency_ms: result.latency_ms,
  });
  return result;
}

export async function recallVictorMemory(env, query, authoritativeContext, options = {}) {
  const providerStatus = cogneeMemoryStatus(env);
  if (providerStatus.status !== 'CONFIGURED') {
    emit('VICTOR_MEMORY_RECALL', {
      provider: 'COGNEE',
      status: 'SKIPPED',
      reason: providerStatus.reason || providerStatus.status,
      latency_ms: 0,
    });
    return {
      ...authoritativeContext,
      cogneeMemory: [],
      semantic_recall_status: providerStatus.status,
    };
  }

  const started = nowMs();
  try {
    const semantic = await cogneeRecall(env, query, options);
    emit('VICTOR_MEMORY_RECALL', {
      provider: 'COGNEE',
      status: semantic.status,
      result_count: Array.isArray(semantic.results) ? semantic.results.length : 0,
      latency_ms: nowMs() - started,
    });
    const merged = mergeCogneeContext(authoritativeContext, semantic);
    return { ...merged, semantic_recall_status: semantic.status };
  } catch (error) {
    emit('VICTOR_MEMORY_RECALL', {
      provider: 'COGNEE',
      status: 'FAILED',
      reason: error?.code || error?.name || 'SEMANTIC_RECALL_ERROR',
      latency_ms: nowMs() - started,
    });
    return {
      ...authoritativeContext,
      cogneeMemory: [],
      semantic_recall_status: 'FAILED',
    };
  }
}
