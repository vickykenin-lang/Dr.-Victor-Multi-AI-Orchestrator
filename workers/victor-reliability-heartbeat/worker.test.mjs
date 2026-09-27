import { evaluateHeartbeatEvidence } from './worker.js';

const ready = status => ({ http_status: 200, body: { status } });
const good = {
  health: { http_status: 200, body: { status: 'READY', v2_production_autonomy_enabled: false, autonomy_allowed_trigger: 'founder-command' } },
  'v2-health': { http_status: 200, body: { status: 'READY', production_autonomy_enabled: false } },
  'endgame-runtime-health': { http_status: 200, body: { status: 'READY', production_autonomy_enabled: false } },
  'core-health': ready('READY'),
  'telegram-webhook-health': { http_status: 200, body: { status: 'WEBHOOK_CONFIGURED_MATCHING' } },
};

const pass = evaluateHeartbeatEvidence(good, '2026-09-27T01:00:00.000Z');
if (pass.status !== 'PASS') throw new Error('EXPECTED_PASS');
if (pass.production_action_allowed !== false) throw new Error('PRODUCTION_ACTION_MUST_BE_FALSE');
if (pass.consequential_execution_trigger !== 'founder-command') throw new Error('FOUNDER_BOUNDARY_REQUIRED');

const httpFail = structuredClone(good);
httpFail['core-health'] = { http_status: 503, body: { status: 'NOT_READY' } };
if (evaluateHeartbeatEvidence(httpFail).status !== 'SAFE_HOLD') throw new Error('HTTP_FAILURE_MUST_SAFE_HOLD');

const autonomyFail = structuredClone(good);
autonomyFail.health.body.v2_production_autonomy_enabled = true;
if (evaluateHeartbeatEvidence(autonomyFail).status !== 'SAFE_HOLD') throw new Error('AUTONOMY_CHANGE_MUST_SAFE_HOLD');

const triggerFail = structuredClone(good);
triggerFail.health.body.autonomy_allowed_trigger = 'scheduler';
if (evaluateHeartbeatEvidence(triggerFail).status !== 'SAFE_HOLD') throw new Error('TRIGGER_CHANGE_MUST_SAFE_HOLD');

console.log('STEP13_CLOUDFLARE_HEARTBEAT_TESTS_PASS');
