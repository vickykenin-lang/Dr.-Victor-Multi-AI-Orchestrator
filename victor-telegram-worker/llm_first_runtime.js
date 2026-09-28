import legacyRuntime, { processQueuedMessage as legacyProcessQueuedMessage, runChat } from './runtime_entry.js';
import { isAuthorizedFounderMessage } from './worker.js';
import { routeDeterministically } from './single_router.mjs';
import { decideFounderMessage } from './llm_first_brain.mjs';
import { executeTask } from './task_runtime.mjs';
import { answerDepartmentQuestion } from './department_query_runtime.mjs';
import { buildCapabilityGapPlan } from './capability_acquisition.mjs';
import { parseEdgeProxyControlCommand } from './edge_proxy_control.mjs';

const TELEGRAM_API = 'https://api.telegram.org';
const RESULT_TTL_SECONDS = 86400;
const CHAT_HISTORY_TTL_SECONDS = 30 * 86400;
const TASK_CONTEXT_TTL_SECONDS = 6 * 3600;
const COURTESY_DELAY_MS = 4000;
const COURTESY_TTL_SECONDS = 3600;

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

async function putJson(env, key, value, ttl = RESULT_TTL_SECONDS) {
  const kv = store(env);
  if (!kv) throw new Error('VICTOR_CONVERSATION_STATE_NOT_CONFIGURED');
  await kv.put(key, JSON.stringify(value), { expirationTtl: ttl });
}

async function sendTelegram(env, chatId, text, replyToMessageId) {
  const response = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN_VICTOR}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'Victor-LLM-First-Runtime/1.0' },
    body: JSON.stringify({ chat_id: chatId, text: String(text || '').slice(0, 4000), reply_to_message_id: replyToMessageId || undefined, allow_sending_without_reply: true }),
  });
  if (!response.ok) throw new Error(`TELEGRAM_SEND_HTTP_${response.status}`);
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function withCourtesy(env, ctx, meta, work) {
  let finished = false;
  const key = `victor:courtesy:${meta.updateId}`;
  const courtesy = (async () => {
    await delay(COURTESY_DELAY_MS);
    if (finished || await getJson(env, key)) return;
    await putJson(env, key, { state: 'RESERVED', at: new Date().toISOString() }, COURTESY_TTL_SECONDS);
    try {
      await sendTelegram(env, meta.chatId, 'Iske answer me thoda time lagega, main check kar raha hoon.', meta.messageId);
      await putJson(env, key, { state: 'SENT', at: new Date().toISOString() }, COURTESY_TTL_SECONDS);
    } catch {}
  })();
  if (ctx?.waitUntil) ctx.waitUntil(courtesy); else void courtesy;
  try { return await work(); } finally { finished = true; }
}

async function readConversation(env, chatId) {
  const items = await getJson(env, `victor:chat-history:${chatId}`);
  return Array.isArray(items) ? items.slice(-10).map(i => `${i.role === 'founder' ? 'Founder' : 'Victor'}: ${i.text}`).join('\n') : '';
}

async function readTaskContext(env, chatId) {
  return getJson(env, `victor:task-context:${chatId}`);
}

async function writeTaskContext(env, chatId, decision) {
  if (!decision?.department) return;
  await putJson(env, `victor:task-context:${chatId}`, {
    department: decision.department,
    type: decision.mode,
    action: decision.task || decision.capability_id || null,
    updated_at: new Date().toISOString(),
  }, TASK_CONTEXT_TTL_SECONDS);
}

function actionRoute(decision) {
  return {
    type: 'ACTION',
    department: decision.department || null,
    action: decision.risk === 'RED' ? 'sensitive_action' : 'department_action',
    risk: decision.risk || 'AMBER',
    confidence: decision.confidence || 0.9,
    source: 'llm-first',
  };
}

function renderGap(decision) {
  const plan = decision.acquisition_plan || buildCapabilityGapPlan({ capability_id: decision.capability_id });
  const target = plan.requested_capability || 'required capability';
  const steps = (plan.acquisition_sequence || []).slice(0, 5).map((s, i) => `${i + 1}. ${s.replaceAll('_', ' ').toLowerCase()}`).join('\n');
  return `Current capability gap: ${target}.\nMain isse completed claim nahi karunga. Safe acquisition path:\n${steps || 'Sandbox/discovery required.'}`;
}

async function processLlmFirstMessage(env, ctx, envelope) {
  const update = envelope?.update || {};
  const message = update?.message;
  if (!message?.chat?.id || !message?.from?.id) return;

  const chatId = String(message.chat.id);
  const senderId = String(message.from.id);
  if (!isAuthorizedFounderMessage(env, chatId, senderId)) return;

  const text = String(message.text || '').trim();
  if (!text) return;
  const updateId = String(update.update_id ?? message.message_id ?? 'unknown');
  const resultKey = `victor:telegram-result:${updateId}`;
  const cached = await getJson(env, resultKey);
  if (cached?.reply) {
    await sendTelegram(env, chatId, cached.reply, message.message_id);
    return;
  }

  // Hard deterministic controls remain outside LLM self-authorization.
  const hard = routeDeterministically(text, {});
  if (hard.type === 'APPROVAL' || hard.type === 'STOP' || parseEdgeProxyControlCommand(text)) {
    return legacyProcessQueuedMessage(env, ctx, envelope);
  }

  const meta = { updateId, chatId, messageId: message.message_id };
  const conversation = await readConversation(env, chatId);
  const taskContext = await readTaskContext(env, chatId);
  const decision = await withCourtesy(env, ctx, meta, () => decideFounderMessage(env, { text, conversation, taskContext, now: new Date() }));

  let reply;
  let verified = false;

  if (decision.mode === 'DIRECT_REPLY') {
    reply = decision.direct_reply || await withCourtesy(env, ctx, meta, () => runChat(env, chatId, text));
  } else if (decision.mode === 'READ_QUERY' && decision.department) {
    const result = await withCourtesy(env, ctx, meta, () => answerDepartmentQuestion(env, decision.department, text));
    reply = result.reply;
    verified = result.verified === true;
    await writeTaskContext(env, chatId, decision);
  } else if (decision.mode === 'CAPABILITY_GAP') {
    reply = renderGap(decision);
  } else if (decision.mode === 'MULTI_AGENT') {
    const roles = decision.multi_agent_roles?.length ? decision.multi_agent_roles.join(', ') : 'specialist capabilities';
    const gap = buildCapabilityGapPlan({ capability_id: decision.capability_id || 'multi_agent_orchestration' });
    reply = `Complex task identified. Required specialists: ${roles}. Phase-1 planner has prepared a sandbox-first acquisition/execution path; no unverified execution is being claimed.\n${(gap.acquisition_sequence || []).slice(0, 4).map((s, i) => `${i + 1}. ${s.replaceAll('_', ' ').toLowerCase()}`).join('\n')}`;
  } else if (decision.mode === 'ACTION') {
    const route = actionRoute(decision);
    if (route.risk === 'RED') {
      // Preserve existing proven Founder-approval enforcement for RED actions.
      return legacyProcessQueuedMessage(env, ctx, envelope);
    }
    const result = await withCourtesy(env, ctx, meta, () => executeTask(env, route, decision.task || text, message.message_id, updateId));
    if (result.delegate_legacy) return legacyProcessQueuedMessage(env, ctx, envelope);
    reply = result.reply;
    verified = result.verified === true;
    await writeTaskContext(env, chatId, decision);
  } else {
    reply = await withCourtesy(env, ctx, meta, () => runChat(env, chatId, text));
  }

  await putJson(env, resultKey, {
    reply,
    type: decision.mode,
    llm_first: true,
    verified,
    completed_at: new Date().toISOString(),
  }, RESULT_TTL_SECONDS);
  await sendTelegram(env, chatId, reply, message.message_id);
}

export default {
  fetch(request, env, ctx) {
    return legacyRuntime.fetch(request, env, ctx);
  },
  scheduled(controller, env, ctx) {
    return legacyRuntime.scheduled(controller, env, ctx);
  },
  async queue(batch, env, ctx) {
    for (const message of batch.messages) {
      try {
        await processLlmFirstMessage(env, ctx, message.body);
        message.ack();
      } catch (error) {
        console.error(JSON.stringify({ event: 'VICTOR_LLM_FIRST_QUEUE_FAILED', error: error?.message || error?.name || 'Error', secrets_exposed: false }));
        message.retry({ delaySeconds: 10 });
      }
    }
  },
};

export { processLlmFirstMessage };
