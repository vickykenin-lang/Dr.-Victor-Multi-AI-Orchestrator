const INTERNAL_PREFIX = 'https://victor.internal/conversation/';

function normalizeChatId(chatId) {
  return String(chatId ?? '').trim();
}

function durableKey(chatId) {
  return `conversation:${normalizeChatId(chatId)}`;
}

function cacheRequest(chatId) {
  return new Request(`${INTERNAL_PREFIX}${encodeURIComponent(normalizeChatId(chatId))}`);
}

export function conversationStateCapability(env = {}) {
  const binding = env.VICTOR_CONVERSATION_STATE;
  if (binding && typeof binding.get === 'function' && typeof binding.put === 'function') {
    return {
      mode: 'DURABLE_BINDING',
      durable: true,
      binding: 'VICTOR_CONVERSATION_STATE',
      reason: 'KV_LIKE_GET_PUT_BINDING_AVAILABLE',
    };
  }
  return {
    mode: 'BEST_EFFORT_CACHE',
    durable: false,
    binding: null,
    reason: 'NO_DURABLE_CONVERSATION_BINDING_CONFIGURED',
  };
}

export async function readConversationState(env, chatId, options = {}) {
  const id = normalizeChatId(chatId);
  if (!id) return { state: {}, capability: conversationStateCapability(env), found: false };
  const capability = conversationStateCapability(env);

  if (capability.durable) {
    try {
      const raw = await env.VICTOR_CONVERSATION_STATE.get(durableKey(id), { type: 'json' });
      const state = raw && typeof raw === 'object' ? raw : {};
      return { state, capability, found: Boolean(raw) };
    } catch (error) {
      if (options.requireDurable === true) {
        const failure = new Error('DURABLE_CONVERSATION_STATE_READ_FAILED');
        failure.cause = error;
        throw failure;
      }
      return readCacheState(id, { ...capability, mode: 'CACHE_FALLBACK_AFTER_DURABLE_READ_ERROR', durable: false, reason: 'DURABLE_READ_FAILED' });
    }
  }

  if (options.requireDurable === true) throw new Error('DURABLE_CONVERSATION_STATE_UNAVAILABLE');
  return readCacheState(id, capability);
}

export async function writeConversationState(env, chatId, patch = {}, options = {}) {
  const id = normalizeChatId(chatId);
  if (!id) throw new Error('CONVERSATION_CHAT_ID_REQUIRED');
  const capability = conversationStateCapability(env);
  const currentRecord = await readConversationState(env, id, { requireDurable: options.requireDurable === true });
  const next = {
    ...(currentRecord.state || {}),
    ...(patch || {}),
    updated_at: new Date().toISOString(),
  };

  if (capability.durable) {
    try {
      await env.VICTOR_CONVERSATION_STATE.put(durableKey(id), JSON.stringify(next));
      return { state: next, capability, persisted: true };
    } catch (error) {
      if (options.requireDurable === true) {
        const failure = new Error('DURABLE_CONVERSATION_STATE_WRITE_FAILED');
        failure.cause = error;
        throw failure;
      }
      const fallback = await writeCacheState(id, next);
      return {
        ...fallback,
        capability: { ...capability, mode: 'CACHE_FALLBACK_AFTER_DURABLE_WRITE_ERROR', durable: false, reason: 'DURABLE_WRITE_FAILED' },
      };
    }
  }

  if (options.requireDurable === true) throw new Error('DURABLE_CONVERSATION_STATE_UNAVAILABLE');
  return writeCacheState(id, next, capability);
}

export function assertDurableConversationState(env = {}) {
  const capability = conversationStateCapability(env);
  if (!capability.durable) throw new Error('DURABLE_CONVERSATION_STATE_UNAVAILABLE');
  return capability;
}

async function readCacheState(chatId, capability) {
  try {
    const hit = await caches.default.match(cacheRequest(chatId));
    return { state: hit ? await hit.json() : {}, capability, found: Boolean(hit) };
  } catch (_) {
    return { state: {}, capability: { ...capability, mode: 'CACHE_UNAVAILABLE', durable: false, reason: 'CACHE_READ_FAILED' }, found: false };
  }
}

async function writeCacheState(chatId, next, capability = conversationStateCapability({})) {
  try {
    await caches.default.put(
      cacheRequest(chatId),
      new Response(JSON.stringify(next), {
        headers: { 'Cache-Control': 'public, max-age=7200', 'Content-Type': 'application/json' },
      }),
    );
    return { state: next, capability, persisted: true };
  } catch (_) {
    return {
      state: next,
      capability: { ...capability, mode: 'CACHE_UNAVAILABLE', durable: false, reason: 'CACHE_WRITE_FAILED' },
      persisted: false,
    };
  }
}
