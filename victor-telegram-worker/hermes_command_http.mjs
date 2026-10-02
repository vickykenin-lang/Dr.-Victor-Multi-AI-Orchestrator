import { authenticateHermesRequest } from './hermes_command_auth.mjs';
import {
  buildHermesReceipt,
  parseHermesTelegramCommand,
  validateHermesCommandEnvelope,
} from './hermes_command_plane.mjs';
import {
  getCommandState,
  hermesStoreCapability,
  persistCommandAcceptance,
} from './hermes_command_store.mjs';
import { routeHermesCommand } from './hermes_command_router.mjs';

export const HERMES_HTTP_VERSION = 'HERMES_COMMAND_HTTP_V1';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function clean(value, max = 256) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function commandId() {
  return `cmd_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

function idempotencyFromTelegram(message = {}, route = {}) {
  const chatId = clean(String(message?.chat?.id ?? ''), 64);
  const messageId = clean(String(message?.message_id ?? ''), 64);
  return `telegram:${chatId}:${messageId}:${route.action || 'unknown'}`.slice(0, 160);
}

async function authenticateExternalCommand(request, env, rawBody, idempotencyKey) {
  return authenticateHermesRequest({
    authorizationHeader: request.headers.get('Authorization') || '',
    expectedBearerToken: env.HERMES_COMMAND_TOKEN || '',
    timestamp: request.headers.get('X-Hermes-Timestamp') || '',
    rawBody,
    signature: request.headers.get('X-Hermes-Signature') || '',
    idempotencyKey,
    webhookSecret: env.HERMES_WEBHOOK_SECRET || '',
    replayStore: env.HERMES_COMMAND_STORE,
  });
}

export function hermesHttpCapability(env = {}) {
  const store = hermesStoreCapability(env);
  return {
    http_version: HERMES_HTTP_VERSION,
    command_token_configured: Boolean(env.HERMES_COMMAND_TOKEN),
    webhook_secret_configured: Boolean(env.HERMES_WEBHOOK_SECRET),
    durable_store: store.durable,
    store,
    ready_for_authenticated_commands: Boolean(env.HERMES_COMMAND_TOKEN && env.HERMES_WEBHOOK_SECRET && store.durable),
  };
}

async function acceptAndRoute(env, validation, receipt) {
  const persisted = await persistCommandAcceptance(env, { command: validation.command, receipt });
  if (!persisted.accepted) {
    return {
      http_status: 409,
      body: {
        accepted: false,
        duplicate: true,
        existing_command_id: persisted.existing_command_id,
      },
    };
  }

  const execution = await routeHermesCommand(env, validation.command);
  const completed = execution.execution === 'COMPLETED';
  const blocked = execution.execution === 'BLOCKED';
  return {
    http_status: completed ? 200 : 202,
    body: {
      accepted: true,
      duplicate: false,
      command_id: persisted.command_id,
      receipt_id: persisted.receipt_id,
      status: execution.status,
      execution: execution.execution,
      error_code: execution.error_code || null,
      result: execution.result ?? null,
      governed_router: true,
      blocked,
    },
  };
}

export async function handleHermesHttpRequest(request, env = {}) {
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/v1/health') {
    const capability = hermesHttpCapability(env);
    return json({
      service: 'hermes-command-control-plane',
      status: capability.ready_for_authenticated_commands ? 'READY_FOR_COMMAND_ACCEPTANCE' : 'PENDING_CONFIGURATION',
      ...capability,
      deployment_evidence: 'NOT_ASSERTED_BY_HEALTH_ROUTE',
      live_request_verified: false,
      real_output_verified: false,
      secrets_exposed: false,
    }, capability.ready_for_authenticated_commands ? 200 : 503);
  }

  const commandMatch = /^\/v1\/commands\/([^/]+)$/.exec(url.pathname);
  if (request.method === 'GET' && commandMatch) {
    if (!env.HERMES_COMMAND_TOKEN || request.headers.get('Authorization') !== `Bearer ${env.HERMES_COMMAND_TOKEN}`) {
      return json({ error: 'unauthorized' }, 401);
    }
    try {
      const record = await getCommandState(env, decodeURIComponent(commandMatch[1]));
      if (!record.found) return json({ error: 'command_not_found' }, 404);
      return json({ command: record.state, store: record.capability });
    } catch (error) {
      return json({ error: String(error?.message || 'command_state_read_failed') }, 503);
    }
  }

  if (request.method === 'POST' && url.pathname === '/v1/commands') {
    const rawBody = await request.text();
    let input;
    try { input = JSON.parse(rawBody); } catch { return json({ error: 'invalid_json' }, 400); }

    const idempotencyKey = clean(request.headers.get('X-Idempotency-Key') || input?.idempotency_key, 160);
    const auth = await authenticateExternalCommand(request, env, rawBody, idempotencyKey);
    if (!auth.ok) return json({ error: 'unauthorized', reasons: auth.reasons, auth_version: auth.auth_version }, 401);

    const validation = validateHermesCommandEnvelope({ ...input, idempotency_key: idempotencyKey });
    if (!validation.ok) {
      return json({
        error: 'command_validation_failed',
        reasons: validation.errors,
        classification: validation.classification,
        policy_version: validation.policy_version,
      }, 400);
    }

    const receipt = buildHermesReceipt({
      command: validation.command,
      status: 'ACCEPTED',
      validation: 'PASS',
      execution: 'NOT_STARTED',
      receiptId: `rcpt_${validation.command.command_id}`,
    });

    try {
      const routed = await acceptAndRoute(env, validation, receipt);
      return json(routed.body, routed.http_status);
    } catch (error) {
      return json({ error: String(error?.message || 'command_persistence_or_routing_failed') }, 503);
    }
  }

  if (request.method === 'POST' && url.pathname === '/integrations/telegram/webhook') {
    if (!env.TELEGRAM_WEBHOOK_SECRET) return json({ error: 'telegram_secret_not_configured' }, 503);
    const supplied = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
    if (supplied !== env.TELEGRAM_WEBHOOK_SECRET) return json({ error: 'unauthorized' }, 401);

    let update;
    try { update = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
    const message = update?.message;
    const route = parseHermesTelegramCommand(message?.text || '');
    if (!route) return json({ ok: true, ignored: true, reason: 'no_hermes_command_match' });

    const chatId = clean(String(message?.chat?.id ?? ''), 64);
    const founderChat = clean(String(env.VICTOR_FOUNDER_CHAT_ID ?? ''), 64);
    if (!chatId || !founderChat || chatId !== founderChat) {
      return json({ ok: true, ignored: true, reason: 'chat_not_authorized' });
    }

    const command = {
      command_id: commandId(),
      source: 'telegram',
      actor: 'founder',
      target: route.target,
      action: route.action,
      payload: route.payload || {},
      execution_mode: 'manual',
      idempotency_key: idempotencyFromTelegram(message, route),
    };
    const validation = validateHermesCommandEnvelope(command);
    if (!validation.ok) return json({ ok: false, error: 'command_validation_failed', reasons: validation.errors }, 400);

    const receipt = buildHermesReceipt({
      command: validation.command,
      status: 'ACCEPTED',
      validation: 'PASS',
      execution: 'NOT_STARTED',
      receiptId: `rcpt_${validation.command.command_id}`,
    });

    try {
      const routed = await acceptAndRoute(env, validation, receipt);
      return json({ ok: true, ...routed.body }, routed.http_status);
    } catch (error) {
      return json({ ok: false, error: String(error?.message || 'command_persistence_or_routing_failed') }, 503);
    }
  }

  return null;
}
