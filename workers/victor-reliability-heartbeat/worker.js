const PRIMARY_BASE = 'https://victor-telegram-webhook.vickykenin.workers.dev';
const EDGE_BASE = 'https://victor-edge-proxy.vickykenin.workers.dev';
const HEARTBEAT_PREFIX = 'step13:cloudflare-heartbeat';
const RETENTION_SECONDS = 14 * 24 * 60 * 60;
const CORE_PROBES = ['health', 'v2-health', 'endgame-runtime-health', 'core-health'];
const EDGE_PROBES = ['proxy-health', 'telegram-webhook-health'];
const ALL_PROBES = [...CORE_PROBES, ...EDGE_PROBES];

export function evaluateHeartbeatEvidence(probes = {}, observedAt = new Date().toISOString()) {
  const health = probes.health || {};
  const v2 = probes['v2-health'] || {};
  const endgame = probes['endgame-runtime-health'] || {};
  const proxy = probes['proxy-health'] || {};
  const webhook = probes['telegram-webhook-health'] || {};
  const requiredHttpOk = ALL_PROBES.every(path => Number(probes[path]?.http_status || 0) === 200);
  const runtimeReady = health.body?.status === 'READY'
    && v2.body?.status === 'READY'
    && endgame.body?.status === 'READY';
  const edgeReady = proxy.body?.status === 'READY';
  const webhookMatching = webhook.body?.status === 'WEBHOOK_CONFIGURED_MATCHING'
    && webhook.body?.webhook_url_matches_expected === true;
  const autonomyDisabled = health.body?.v2_production_autonomy_enabled !== true
    && v2.body?.production_autonomy_enabled !== true
    && endgame.body?.production_autonomy_enabled !== true;
  const trigger = health.body?.autonomy_allowed_trigger || 'founder-command';
  const founderBoundary = trigger === 'founder-command';
  const pass = requiredHttpOk && runtimeReady && edgeReady && webhookMatching && autonomyDisabled && founderBoundary;
  return {
    schema_version: 2,
    evidence_type: 'VICTOR_STEP13_CLOUDFLARE_READ_ONLY_HEARTBEAT',
    heartbeat_version: 'STEP13_HEARTBEAT_V2_PROXY_AWARE',
    observed_at_utc: observedAt,
    status: pass ? 'PASS' : 'SAFE_HOLD',
    production_action_allowed: false,
    production_autonomy_enabled: false,
    consequential_execution_trigger: trigger,
    required_http_ok: requiredHttpOk,
    runtime_ready: runtimeReady,
    edge_proxy_ready: edgeReady,
    webhook_ingress_matching: webhookMatching,
    founder_command_boundary_intact: founderBoundary,
    historical_168h_certification: 'FOUNDER_SKIPPED_NOT_CERTIFIED',
    probe_summary: Object.fromEntries(ALL_PROBES.map(path => [path, {
      http_status: Number(probes[path]?.http_status || 0),
      status: probes[path]?.body?.status || null,
    }])),
    secrets_exposed: false,
  };
}

async function coreProbe(path, env) {
  const request = new Request(`${PRIMARY_BASE}/${path}`, {
    method: 'GET',
    headers: { 'User-Agent': 'Victor-Step13-Cloudflare-Heartbeat/2.0' },
  });
  const response = env?.VICTOR_RUNTIME?.fetch
    ? await env.VICTOR_RUNTIME.fetch(request)
    : await fetch(request);
  const body = await response.json().catch(() => null);
  return { http_status: response.status, body };
}

async function edgeProbe(path, env) {
  const request = new Request(`${EDGE_BASE}/${path}`, {
    method: 'GET',
    headers: { 'User-Agent': 'Victor-Step13-Cloudflare-Heartbeat/2.0' },
  });
  const response = env?.VICTOR_EDGE_PROXY?.fetch
    ? await env.VICTOR_EDGE_PROXY.fetch(request)
    : await fetch(request);
  const body = await response.json().catch(() => null);
  return { http_status: response.status, body };
}

async function runHeartbeat(controller, env) {
  if (!env.VICTOR_RELIABILITY_EVIDENCE) throw new Error('VICTOR_RELIABILITY_EVIDENCE_KV_REQUIRED');
  const coreEntries = await Promise.all(CORE_PROBES.map(async path => [path, await coreProbe(path, env)]));
  const edgeEntries = await Promise.all(EDGE_PROBES.map(async path => [path, await edgeProbe(path, env)]));
  const probes = Object.fromEntries([...coreEntries, ...edgeEntries]);
  const observedAt = new Date().toISOString();
  const evidence = evaluateHeartbeatEvidence(probes, observedAt);
  const stamp = observedAt.replace(/[:.]/g, '-');
  const recordKey = `${HEARTBEAT_PREFIX}:record:${stamp}`;
  await Promise.all([
    env.VICTOR_RELIABILITY_EVIDENCE.put(recordKey, JSON.stringify(evidence), { expirationTtl: RETENTION_SECONDS }),
    env.VICTOR_RELIABILITY_EVIDENCE.put(`${HEARTBEAT_PREFIX}:latest`, JSON.stringify(evidence)),
  ]);
  console.log(JSON.stringify({
    event: 'VICTOR_STEP13_CLOUDFLARE_HEARTBEAT',
    cron: controller?.cron || null,
    core_transport: env?.VICTOR_RUNTIME?.fetch ? 'SERVICE_BINDING' : 'PUBLIC_FALLBACK',
    edge_transport: env?.VICTOR_EDGE_PROXY?.fetch ? 'SERVICE_BINDING' : 'PUBLIC_FALLBACK',
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
  async scheduled(controller, env, ctx) { ctx.waitUntil(runHeartbeat(controller, env)); },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET') return json({ status: 'METHOD_NOT_ALLOWED' }, 405);
    if (url.pathname === '/health') {
      return json({
        service: 'victor-reliability-heartbeat',
        status: 'READY',
        heartbeat_version: 'STEP13_HEARTBEAT_V2_PROXY_AWARE',
        scheduler_mode: 'READ_ONLY_NON_CONSEQUENTIAL',
        cadence_minutes: 15,
        production_action_allowed: false,
        production_autonomy_enabled: false,
        consequential_execution_trigger: 'founder-command',
        historical_168h_certification: 'FOUNDER_SKIPPED_NOT_CERTIFIED',
        evidence_store_configured: Boolean(env.VICTOR_RELIABILITY_EVIDENCE),
        runtime_service_binding_configured: Boolean(env.VICTOR_RUNTIME),
        edge_proxy_service_binding_configured: Boolean(env.VICTOR_EDGE_PROXY),
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
