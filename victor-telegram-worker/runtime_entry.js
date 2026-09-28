import primaryWorker, { isAuthorizedFounderMessage } from './worker.js';
import { callVictorModel } from './model_router.mjs';
import { routeDeterministically, normalizeSemanticRoute } from './single_router.mjs';
import { executeTask } from './task_runtime.mjs';
import { applyEdgeProxyControl, parseEdgeProxyControlCommand } from './edge_proxy_control.mjs';

const TELEGRAM_API = 'https://api.telegram.org';
const UPDATE_TTL_SECONDS = 86400;
const CHAT_HISTORY_TTL_SECONDS = 30 * 86400;
const RESULT_TTL_SECONDS = 86400;
const FIXED_PERSONA = `You are Dr. Victor, Vicky Gautam's personal AI assistant and executive orchestrator. This is the pure conversation path. Speak naturally, directly and concisely in the Founder's language. Do not call tools, departments, Cognee, evidence systems or status sources. Do not claim that any external action happened. Do not defend your identity mechanically. Handle casual conversation, humour, frustration and normal questions like a capable general AI assistant.`;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

function constantTimeEqual(a, b) {
  const left = new TextEncoder().encode(String(a || ''));
  const right = new TextEncoder().encode(String(b || ''));
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function sendTelegram(env, chatId, text, replyToMessageId) {
  if (!env?.TELEGRAM_BOT_TOKEN_VICTOR || !chatId) throw new Error('TELEGRAM_SEND_CONFIGURATION_MISSING');
  const response = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN_VICTOR}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'Victor-Queued-Runtime/1.0' },
    body: JSON.stringify({ chat_id: chatId, text: String(text || '').slice(0, 4000), reply_to_message_id: replyToMessageId || undefined, allow_sending_without_reply: true }),
  });
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.text()).slice(0, 300); } catch {}
    throw new Error(`TELEGRAM_SEND_HTTP_${response.status}${detail ? `:${detail}` : ''}`);
  }
  return true;
}

function store(env) {
  return env?.VICTOR_CONVERSATION_STATE && typeof env.VICTOR_CONVERSATION_STATE.get === 'function' ? env.VICTOR_CONVERSATION_STATE : null;
}

async function getJson(env, key) {
  const kv = store(env);
  if (!kv) return null;
  try {
    const raw = await kv.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function putJson(env, key, value, ttl = UPDATE_TTL_SECONDS) {
  const kv = store(env);
  if (!kv) throw new Error('VICTOR_CONVERSATION_STATE_NOT_CONFIGURED');
  await kv.put(key, JSON.stringify(value), { expirationTtl: ttl });
}

async function deleteKey(env, key) {
  const kv = store(env);
  if (kv && typeof kv.delete === 'function') await kv.delete(key);
}

async function readChatHistory(env, chatId) {
  const history = await getJson(env, `victor:chat-history:${chatId}`);
  return Array.isArray(history) ? history.slice(-10) : [];
}

async function appendChatHistory(env, chatId, founderText, victorText) {
  const history = await readChatHistory(env, chatId);
  history.push({ role: 'founder', text: String(founderText || '').slice(0, 1600) });
  history.push({ role: 'victor', text: String(victorText || '').slice(0, 1600) });
  await putJson(env, `victor:chat-history:${chatId}`, history.slice(-10), CHAT_HISTORY_TTL_SECONDS);
}

async function semanticFallback(env, text) {
  const system = `Classify one Founder message for Victor. Return JSON only. Types: CHAT, STATUS, ACTION, REMINDER, STOP. Departments: rio, aura3, aura2, tony_stark, hulk, or null. Risk: GREEN, AMBER, RED. Default to CHAT. Dispatch ACTION only when the message clearly asks for an external/system action. Frustration, jokes and dismissive speech such as 'bhag jao' are CHAT. Schema: {"type":"CHAT|STATUS|ACTION|REMINDER|STOP","department":null,"action":null,"risk":"GREEN|AMBER|RED","confidence":0.0}`;
  try {
    const result = await callVictorModel(env, system, text, { task: 'fast', maxTokens: 120, temperature: 0 });
    const cleaned = String(result.content || '').replace(/```json|```/gi, '').trim();
    return normalizeSemanticRoute(JSON.parse(cleaned));
  } catch {
    return { type: 'CHAT', department: null, action: null, risk: 'GREEN', confidence: 0, source: 'semantic-failed-default-chat' };
  }
}

async function routeMessage(env, text) {
  const deterministic = routeDeterministically(text);
  if (deterministic.type !== 'AMBIGUOUS') return deterministic;
  return semanticFallback(env, text);
}

async function runChat(env, chatId, text) {
  const history = await readChatHistory(env, chatId);
  const context = history.length ? history.map(t => `${t.role === 'founder' ? 'Founder' : 'Victor'}: ${t.text}`).join('\n') : '(no prior chat turns)';
  const result = await callVictorModel(env, `${FIXED_PERSONA}\n\nRECENT CONVERSATION ONLY:\n${context}`, text, { task: 'chat', maxTokens: 500, temperature: 0.35 });
  const reply = String(result.content || '').trim() || 'Bataiye.';
  await appendChatHistory(env, chatId, text, reply);
  return reply;
}

function approvalIdFor(updateId) {
  return `ap-${String(updateId || 'msg').replace(/[^a-z0-9-]/gi, '').slice(0, 40)}-${Date.now().toString(36)}`;
}

async function requestApproval(env, updateId, chatId, messageId, text, route) {
  const approvalId = approvalIdFor(updateId);
  await putJson(env, `victor:approval:${approvalId}`, { updateId, chatId, messageId, text, route, created_at: new Date().toISOString() }, 3600);
  return `Sensitive action detected. Execution abhi blocked hai. Approve karne ke liye reply karein: OK ${approvalId}`;
}

async function consumeApproval(env, approvalId, chatId) {
  const key = `victor:approval:${approvalId}`;
  const pending = await getJson(env, key);
  if (!pending || String(pending.chatId) !== String(chatId)) return null;
  await deleteKey(env, key);
  return pending;
}

async function delegateLegacy(env, ctx, update, originalUrl) {
  const request = new Request(originalUrl || 'https://victor.internal/telegram', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET || '', 'X-Victor-Queued-Execution': '1' },
    body: JSON.stringify(update),
  });
  return primaryWorker.fetch(request, env, ctx);
}

async function processQueuedMessage(env, ctx, envelope) {
  const update = envelope?.update || {};
  const message = update?.message;
  if (!message?.chat?.id || !message?.from?.id) return;
  const updateId = String(update.update_id ?? message.message_id ?? 'unknown');
  const resultKey = `victor:telegram-result:${updateId}`;
  const cached = await getJson(env, resultKey);
  if (cached?.reply) {
    await sendTelegram(env, message.chat.id, cached.reply, message.message_id);
    return;
  }

  const chatId = String(message.chat.id);
  const senderId = String(message.from.id);
  if (!isAuthorizedFounderMessage(env, chatId, senderId)) return;
  const text = String(message.text || '').trim();
  if (!text) return;

  const edgeCommand = parseEdgeProxyControlCommand(text);
  if (edgeCommand) {
    const result = await applyEdgeProxyControl(env, edgeCommand);
    const reply = result.ok ? `Victor edge proxy ${edgeCommand.action.toLowerCase()} applied.` : `Victor edge proxy ${edgeCommand.action.toLowerCase()} failed: ${result.status}.`;
    await putJson(env, resultKey, { reply, type: 'EDGE_PROXY_CONTROL', completed_at: new Date().toISOString() }, RESULT_TTL_SECONDS);
    await sendTelegram(env, chatId, reply, message.message_id);
    return;
  }

  let route = await routeMessage(env, text);

  if (route.type === 'APPROVAL') {
    const pending = await consumeApproval(env, route.approval_id, chatId);
    if (!pending) {
      const reply = 'Approval reference valid ya active nahi hai. Koi action execute nahi hua.';
      await putJson(env, resultKey, { reply, type: 'APPROVAL_INVALID', completed_at: new Date().toISOString() }, RESULT_TTL_SECONDS);
      await sendTelegram(env, chatId, reply, message.message_id);
      return;
    }
    route = { ...pending.route, risk: 'RED', approved: true, approval_id: route.approval_id };
    const taskResult = await executeTask(env, route, pending.text, pending.messageId);
    if (taskResult.delegate_legacy) {
      await delegateLegacy(env, ctx, pending.update || update, envelope.original_url);
      return;
    }
    await putJson(env, resultKey, { reply: taskResult.reply, type: 'APPROVED_TASK', completed_at: new Date().toISOString() }, RESULT_TTL_SECONDS);
    await sendTelegram(env, chatId, taskResult.reply, message.message_id);
    return;
  }

  if (route.type === 'CHAT') {
    const reply = await runChat(env, chatId, text);
    await putJson(env, resultKey, { reply, type: 'CHAT', completed_at: new Date().toISOString() }, RESULT_TTL_SECONDS);
    await sendTelegram(env, chatId, reply, message.message_id);
    return;
  }

  if (route.type === 'ACTION' && route.risk === 'RED') {
    const reply = await requestApproval(env, updateId, chatId, message.message_id, text, route);
    await putJson(env, resultKey, { reply, type: 'APPROVAL_REQUIRED', completed_at: new Date().toISOString() }, RESULT_TTL_SECONDS);
    await sendTelegram(env, chatId, reply, message.message_id);
    return;
  }

  const taskResult = await executeTask(env, route, text, message.message_id);
  if (taskResult.delegate_legacy) {
    await delegateLegacy(env, ctx, update, envelope.original_url);
    return;
  }
  await putJson(env, resultKey, { reply: taskResult.reply, type: route.type, completed_at: new Date().toISOString(), verified: taskResult.verified === true }, RESULT_TTL_SECONDS);
  await sendTelegram(env, chatId, taskResult.reply, message.message_id);
}

export default {
  scheduled(controller, env, ctx) {
    return primaryWorker.scheduled(controller, env, ctx);
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/telegram') return primaryWorker.fetch(request, env, ctx);

    const supplied = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
    if (!env?.TELEGRAM_WEBHOOK_SECRET || !constantTimeEqual(supplied, env.TELEGRAM_WEBHOOK_SECRET)) {
      console.warn(JSON.stringify({ event: 'VICTOR_TELEGRAM_INGRESS_REJECTED', reason: 'WEBHOOK_SECRET_INVALID', secrets_exposed: false }));
      return json({ ok: true, accepted: false, reason: 'INVALID_INGRESS' }, 200);
    }

    let update;
    try { update = await request.json(); } catch { return json({ ok: true, accepted: false, reason: 'INVALID_JSON' }, 200); }
    const message = update?.message;
    if (!message) return json({ ok: true, accepted: false, reason: 'NO_MESSAGE' }, 200);

    const chatId = String(message?.chat?.id ?? '');
    const senderId = String(message?.from?.id ?? '');
    if (!isAuthorizedFounderMessage(env, chatId, senderId)) {
      console.warn(JSON.stringify({ event: 'VICTOR_TELEGRAM_INGRESS_REJECTED', reason: 'FOUNDER_AUTH_FAILED', update_id: update?.update_id ?? null, secrets_exposed: false }));
      return json({ ok: true, accepted: false, reason: 'UNAUTHORIZED_SENDER' }, 200);
    }

    if (!env?.VICTOR_TELEGRAM_QUEUE || typeof env.VICTOR_TELEGRAM_QUEUE.send !== 'function') {
      console.error(JSON.stringify({ event: 'VICTOR_TELEGRAM_QUEUE_MISSING', update_id: update?.update_id ?? null, secrets_exposed: false }));
      return json({ ok: false, accepted: false, reason: 'QUEUE_NOT_CONFIGURED' }, 503);
    }

    const updateId = String(update?.update_id ?? message?.message_id ?? 'unknown');
    const dedupeKey = `victor:telegram-update:${updateId}`;
    const existing = await getJson(env, dedupeKey);
    if (existing) return json({ ok: true, accepted: true, duplicate: true }, 200);

    await putJson(env, dedupeKey, { state: 'RECEIVED', received_at: new Date().toISOString() }, UPDATE_TTL_SECONDS);
    try {
      await env.VICTOR_TELEGRAM_QUEUE.send({ update, original_url: request.url, received_at: new Date().toISOString() });
      await putJson(env, dedupeKey, { state: 'ENQUEUED', received_at: new Date().toISOString() }, UPDATE_TTL_SECONDS);
    } catch (error) {
      await deleteKey(env, dedupeKey);
      console.error(JSON.stringify({ event: 'VICTOR_TELEGRAM_ENQUEUE_FAILED', update_id: updateId, error: error?.name || 'Error', secrets_exposed: false }));
      return json({ ok: false, accepted: false, reason: 'ENQUEUE_FAILED' }, 503);
    }

    return json({ ok: true, accepted: true, queued: true }, 200);
  },

  async queue(batch, env, ctx) {
    for (const message of batch.messages) {
      try {
        await processQueuedMessage(env, ctx, message.body);
        message.ack();
      } catch (error) {
        console.error(JSON.stringify({ event: 'VICTOR_TELEGRAM_QUEUE_PROCESSING_FAILED', error: error?.message || error?.name || 'Error', secrets_exposed: false }));
        message.retry({ delaySeconds: 10 });
      }
    }
  },
};

export { constantTimeEqual, routeMessage, runChat, processQueuedMessage };
