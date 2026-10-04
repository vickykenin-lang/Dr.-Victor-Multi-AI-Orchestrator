import { authenticateHermesRequest } from './hermes_command_auth.mjs';
import { buildHermesReceipt, validateHermesCommandEnvelope } from './hermes_command_plane.mjs';
import { persistCommandAcceptance } from './hermes_command_store.mjs';
import { routeHermesCommandV2 } from './hermes_command_router_v2.mjs';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function clean(value, max = 256) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function gulaboCommandAuthCapability(env = {}) {
  return {
    token_configured: Boolean(clean(env.GULABO_HERMES_COMMAND_TOKEN, 1000)),
    secret_configured: Boolean(clean(env.GULABO_HERMES_COMMAND_SECRET, 1000)),
    replay_store_configured: Boolean(env.HERMES_COMMAND_STORE),
  };
}

export async function authenticateGulaboCommandRequest(request, env, rawBody, idempotencyKey) {
  return authenticateHermesRequest({
    authorizationHeader: request.headers.get('Authorization') || '',
    expectedBearerToken: clean(env.GULABO_HERMES_COMMAND_TOKEN, 1000),
    timestamp: request.headers.get('X-Hermes-Timestamp') || '',
    rawBody,
    signature: request.headers.get('X-Hermes-Signature') || '',
    idempotencyKey,
    webhookSecret: clean(env.GULABO_HERMES_COMMAND_SECRET, 1000),
    replayStore: env.HERMES_COMMAND_STORE,
  });
}

export async function handleGulaboCommandRequest(request, env = {}) {
  const url = new URL(request.url);
  if (request.method !== 'POST' || url.pathname !== '/v1/commands') return null;

  const expected = clean(env.GULABO_HERMES_COMMAND_TOKEN, 1000);
  const authorization = request.headers.get('Authorization') || '';
  if (!expected || authorization !== `Bearer ${expected}`) return null;

  const rawBody = await request.text();
  let input;
  try { input = JSON.parse(rawBody); } catch { return json({ error: 'invalid_json' }, 400); }
  const idempotencyKey = clean(request.headers.get('X-Idempotency-Key') || input?.idempotency_key, 160);
  const auth = await authenticateGulaboCommandRequest(request, env, rawBody, idempotencyKey);
  if (!auth.ok) return json({ error: 'unauthorized', reasons: auth.reasons, auth_version: auth.auth_version, auth_route: 'GULABO_DEDICATED' }, 401);

  const validation = validateHermesCommandEnvelope({ ...input, idempotency_key: idempotencyKey });
  if (!validation.ok) return json({ error: 'command_validation_failed', reasons: validation.errors, classification: validation.classification, policy_version: validation.policy_version }, 400);

  const receipt = buildHermesReceipt({
    command: validation.command,
    status: 'ACCEPTED',
    validation: 'PASS',
    execution: 'NOT_STARTED',
    receiptId: `rcpt_${validation.command.command_id}`,
  });

  try {
    const persisted = await persistCommandAcceptance(env, { command: validation.command, receipt });
    if (!persisted.accepted) return json({ accepted: false, duplicate: true, existing_command_id: persisted.existing_command_id, auth_route: 'GULABO_DEDICATED' }, 409);
    const execution = await routeHermesCommandV2(env, validation.command);
    const status = execution.execution === 'COMPLETED' ? 200 : 202;
    return json({
      accepted: true,
      duplicate: false,
      command_id: persisted.command_id,
      receipt_id: persisted.receipt_id,
      status: execution.status,
      execution: execution.execution,
      error_code: execution.error_code || null,
      result: execution.result ?? null,
      governed_router: true,
      router_version: 'V2',
      auth_route: 'GULABO_DEDICATED',
      blocked: execution.execution === 'BLOCKED',
    }, status);
  } catch (error) {
    return json({ error: String(error?.message || 'gulabo_command_persistence_or_routing_failed') }, 503);
  }
}
