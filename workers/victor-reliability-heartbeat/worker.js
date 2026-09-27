const VICTOR_BASE = 'https://victor-telegram-webhook.vickykenin.workers.dev';
const HEARTBEAT_PREFIX = 'step13:cloudflare-heartbeat';
const RETENTION_SECONDS = 14 * 24 * 60 * 60;
const PROBE_PATHS = [
  'health',
  'v2-health',
  'endgame-runtime-health',
  'core-health',
  'telegram-webhook-health',
];

export function evaluateHeartbeatEvidence(probes = {}, observedAt = new Date().toISOString()) {
  const health = probes.health || {};
  const v2 = probes['v2-health'] || {};
  const endgame = probes['endgame-runtime-health'] || {};
  const requiredHttpOk = PROBE_PATHS.every(path => Number(probes[path]?.http_status || 0) === 200);
  const ready = health.body?.status === 'READY' && v2.body?.status === 'READY' && endgame.body?.status === 'READY';
  const autonomyDisabled = health.body?.v2_production_autonomy_enabled !== true
    && v2.body?.production_autonomy_enabled !== true
    && endgame.body?.production_autonomy_enabled !== true;
  const trigger = health.body?.autonomy_allowed_trigger || 'founder-command';
  const founderBoundary = trigger === 'founder-command';
  const pass = requiredHttpOk && ready && autonomyDisabled && founderBoundary;
  return {
    schema_version: 1,
    evidence_type: 'VICTOR_STEP13_CLOUDFLARE_READ_ONLY_HEARTBEAT',
    observed_at_utc: observedAt,
    status: pass ? 'PASS' : 'SAFE_HOLD',
    production_action_allowed: false,
    production_autonomy_enabled: false,
    consequential_execution_trigger: trigger,
    required_http_ok: requiredHttpOk,
    runtime_ready: ready,
    founder_command_boundary_intact: founderBoundary,
    probe_summary: Object.fromEntries(PROBE_PATHS.map(path => [path, {
      http_status: Number(probes[path]?.http_status || 0),
      status: probes[path]?.body?.status || null,
    }])),
    secrets_exposed: false,
  };
}

async function probe(path) {
  const response = await fetch(`${VICTOR_BASE}/${path}`, {
    method: 'GET',
    headers: { 'User-Agent': 'Victor-Step13-Cloudflare-Heartbeat/1.0' },
  });
  const body = await response.json().catch(() => null);
  return { http_status: response.status, body };
}

async function runHeartbeat(controller, env) {
  if (!env.VICTOR_RELIABILITY_EVIDENCE) {
    throw new Error('VICTOR_RELIABILITY_EVIDENCE_KV_REQUIRED');
  }
  const entries = await Promise.all(PROBE_PATHS.map(async path => [path, await probe(path)]));
  const probes = Object.fromEntries(entries);
  const observedAt = new Date().toISOString();
  const evidence = evaluateHeartbeatEvidence(probes, observedAt);
  const stamp = observedAt.replace(/[:.]/g, '-');
  const recordKey = `${HEARTBEAT_PREFIX}:record:${stamp}`;
  await Promise.all([
    env.VICTOR_RELIABILITY_EVIDENCE.put(recordKey, JSON.stringify(evidence), { expirationTtl: RETENTION_SECONDS }),
    env.VICTOR_RELIABILITY_EVIDENCE.put(`${HEARTBEAT_PREFIX}:latest`, JSON.stringify(evidence)),
  ]);
  const anchorKey = `${HEARTBEAT_PREFIX}:anchor`;
  const existingAnchor = await env.VICTOR_RELIABILITY_EVIDENCE.get(anchorKey);
  if (!existingAnchor && evidence.status === 'PASS') {
    await env.VICTOR_RELIABILITY_EVIDENCE.put(anchorKey, JSON.stringify({
      anchor_utc: observedAt,
      source: 'CLOUDFLARE_CRON',
      cadence_minutes: 15,
      production_action_allowed: false,
    }));
  }
  console.log(JSON.stringify({
    event: 'VICTOR_STEP13_CLOUDFLARE_HEARTBEAT',
    cron: controller?.cron || null,
    ...evidence,
  }));
  if (evidence.status !== 'PASS') throw new Error('STEP13_HEARTBEAT_SAFE_HOLD');
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runHeartbeat(controller, env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET') return json({ status: 'METHOD_NOT_ALLOWED' }, 405);
    if (url.pathname === '/health') {
      return json({
        service: 'victor-reliability-heartbeat',
        status: 'READY',
        scheduler_mode: 'READ_ONLY_NON_CONSEQUENTIAL',
        cadence_minutes: 15,
        production_action_allowed: false,
        production_autonomy_enabled: false,
        consequential_execution_trigger: 'founder-command',
        evidence_store_configured: Boolean(env.VICTOR_RELIABILITY_EVIDENCE),
      });
    }
    if (url.pathname === '/latest') {
      if (!env.VICTOR_RELIABILITY_EVIDENCE) return json({ status: 'EVIDENCE_STORE_NOT_CONFIGURED' }, 503);
      const raw = await env.VICTOR_RELIABILITY_EVIDENCE.get(`${HEARTBEAT_PREFIX}:latest`);
      return raw ? new Response(raw, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }) : json({ status: 'NO_HEARTBEAT_OBSERVED' }, 404);
    }
    if (url.pathname === '/anchor') {
      if (!env.VICTOR_RELIABILITY_EVIDENCE) return json({ status: 'EVIDENCE_STORE_NOT_CONFIGURED' }, 503);
      const raw = await env.VICTOR_RELIABILITY_EVIDENCE.get(`${HEARTBEAT_PREFIX}:anchor`);
      return raw ? new Response(raw, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }) : json({ status: 'NO_ANCHOR_OBSERVED' }, 404);
    }
    return json({ status: 'NOT_FOUND' }, 404);
  },
};
