import { evaluateHeartbeatEvidence } from './worker.js';

const ready = status => ({ http_status: 200, body: { status } });
const good = {
  health: { http_status: 200, body: { status: 'READY', v2_production_autonomy_enabled: false, autonomy_allowed_trigger: 'founder-command' } },
  'v2-health': { http_status: 200, body: { status: 'READY', production_autonomy_enabled: false } },
  'endgame-runtime-health': { http_status: 200, body: { status: 'READY', production_autonomy_enabled: false } },
  'core-health': ready('READY'),
  'proxy-health': { http_status: 200, body: { status: 'READY' } },
  'telegram-webhook-health': {
    http_status: 200,
    body: { status: 'WEBHOOK_CONFIGURED_MATCHING', webhook_url_matches_expected: true },
  },
};

const pass = evaluateHeartbeatEvidence(good, '2026-09-27T12:00:00.000Z');
if (pass.status !== 'PASS') throw new Error('EXPECTED_PASS');
if (pass.heartbeat_version !== 'STEP13_HEARTBEAT_V2_PROXY_AWARE') throw new Error('PROXY_AWARE_VERSION_REQUIRED');
if (pass.edge_proxy_ready !== true || pass.webhook_ingress_matching !== true) throw new Error('EDGE_INGRESS_MUST_BE_VERIFIED');
if (pass.production_action_allowed !== false) throw new Error('PRODUCTION_ACTION_MUST_BE_FALSE');
if (pass.production_autonomy_enabled !== false) throw new Error('PRODUCTION_AUTONOMY_MUST_BE_FALSE');
if (pass.consequential_execution_trigger !== 'founder-command') throw new Error('FOUNDER_BOUNDARY_REQUIRED');
if (pass.historical_168h_certification !== 'FOUNDER_SKIPPED_NOT_CERTIFIED') throw new Error('HISTORICAL_168H_MUST_NOT_BE_UPGRADED');

const proxyFail = structuredClone(good);
proxyFail['proxy-health'] = { http_status: 503, body: { status: 'SAFE_STOP' } };
if (evaluateHeartbeatEvidence(proxyFail).status !== 'SAFE_HOLD') throw new Error('PROXY_FAILURE_MUST_SAFE_HOLD');

const webhookFail = structuredClone(good);
webhookFail['telegram-webhook-health'].body.webhook_url_matches_expected = false;
if (evaluateHeartbeatEvidence(webhookFail).status !== 'SAFE_HOLD') throw new Error('WEBHOOK_MISMATCH_MUST_SAFE_HOLD');

const autonomyFail = structuredClone(good);
autonomyFail.health.body.v2_production_autonomy_enabled = true;
if (evaluateHeartbeatEvidence(autonomyFail).status !== 'SAFE_HOLD') throw new Error('AUTONOMY_CHANGE_MUST_SAFE_HOLD');

const triggerFail = structuredClone(good);
triggerFail.health.body.autonomy_allowed_trigger = 'scheduler';
if (evaluateHeartbeatEvidence(triggerFail).status !== 'SAFE_HOLD') throw new Error('TRIGGER_CHANGE_MUST_SAFE_HOLD');

console.log('STEP13_PROXY_AWARE_HEARTBEAT_TESTS_PASS');
