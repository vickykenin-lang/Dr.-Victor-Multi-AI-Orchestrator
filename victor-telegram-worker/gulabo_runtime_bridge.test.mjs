import test from 'node:test';
import assert from 'node:assert/strict';

import { HERMES_RISK_CLASS, validateHermesCommandEnvelope } from './hermes_command_plane.mjs';
import { gulaboBridgeSnapshot } from './gulabo_bridge.mjs';
import { routeHermesCommand } from './hermes_command_router.mjs';

function command(action, target, payload = {}, executionMode = 'manual') {
  return {
    command_id: `cmd_${action.replace(/\W+/g, '_')}`,
    source: 'internal',
    actor: 'founder_authorized_assistant',
    target,
    action,
    payload,
    execution_mode: executionMode,
    idempotency_key: `idem_${action}`,
  };
}

function bridgeEnv() {
  return {
    GULABO_API_BASE_URL: 'https://gulabo.example.com',
    GULABO_HERMES_CALLBACK_TOKEN: 'token-1',
    GULABO_HERMES_CALLBACK_SECRET: 'secret-1',
  };
}

test('canonical Gulabo actions keep expected risk classes', () => {
  const review = validateHermesCommandEnvelope(command('hermes.gulabo_review_ready', 'hermes', {
    image_id: 'GULABO-IMG-1', revision: 1, asset_uri: 'data/assets/GULABO-IMG-1/v1.png',
  }));
  assert.equal(review.ok, true);
  assert.equal(review.classification.risk, HERMES_RISK_CLASS.READ_ONLY);

  const revise = validateHermesCommandEnvelope(command('gulabo.request_revision', 'gulabo', {
    image_id: 'GULABO-IMG-1', from_revision: 1,
    founder_feedback: 'make background warmer', change: ['make background warmer'],
  }));
  assert.equal(revise.ok, true);
  assert.equal(revise.classification.risk, HERMES_RISK_CLASS.SAFE_EXECUTION);

  const approve = validateHermesCommandEnvelope(command(
    'gulabo.good_to_go', 'gulabo', { image_id: 'GULABO-IMG-1', revision: 2 }, 'approval_required',
  ));
  assert.equal(approve.ok, true);
  assert.equal(approve.classification.risk, HERMES_RISK_CLASS.APPROVAL_REQUIRED);
});

test('Hermes accepts Gulabo review packet for founder review', async () => {
  const result = await routeHermesCommand({}, command('hermes.gulabo_review_ready', 'hermes', {
    image_id: 'GULABO-IMG-1',
    revision: 1,
    requester: 'RIO',
    requester_ref: 'rio-1',
    asset_uri: 'data/assets/GULABO-IMG-1/v1.png',
    rating: { overall: 9.1, evidence_verified: true },
    qa_defects: [],
  }), { persist: false });

  assert.equal(result.status, 'AWAITING_FOUNDER_REVIEW');
  assert.equal(result.execution, 'COMPLETED');
  assert.equal(result.result.image_id, 'GULABO-IMG-1');
  assert.deepEqual(result.result.founder_actions, ['REVISE', 'GOOD_TO_GO']);
  assert.equal(result.real_output_verified, true);
});

test('revision request dispatches signed callback to Gulabo', async () => {
  let seen = null;
  const fakeFetch = async (url, init) => {
    seen = { url, init };
    return {
      ok: true,
      status: 200,
      async json() { return { image_id: 'GULABO-IMG-1', revision: 2, status: 'READY_FOR_REVIEW' }; },
      async text() { return ''; },
    };
  };

  const result = await routeHermesCommand(
    bridgeEnv(),
    command('gulabo.request_revision', 'gulabo', {
      image_id: 'GULABO-IMG-1',
      from_revision: 1,
      preserve: ['product identity'],
      change: ['make background warmer'],
      founder_feedback: 'Background warm karo',
      regenerate_from_scratch: false,
    }),
    { persist: false, fetchImpl: fakeFetch, nowMs: 1_000_000 },
  );

  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.live_request_verified, true);
  assert.equal(seen.url, 'https://gulabo.example.com/v1/hermes/correction');
  assert.equal(seen.init.headers.Authorization, 'Bearer token-1');
  assert.equal(seen.init.headers['X-Gulabo-Timestamp'], '1000');
  assert.match(seen.init.headers['X-Gulabo-Signature'], /^sha256=[a-f0-9]{64}$/);
  const body = JSON.parse(seen.init.body);
  assert.deepEqual(body.change, ['make background warmer']);
  assert.deepEqual(body.preserve, ['product identity']);
});

test('GOOD_TO_GO requires approval and dispatches founder decision callback', async () => {
  const blocked = await routeHermesCommand(
    bridgeEnv(),
    command('gulabo.good_to_go', 'gulabo', { image_id: 'GULABO-IMG-1', revision: 2 }),
    { persist: false },
  );
  assert.equal(blocked.status, 'AWAITING_APPROVAL');

  let body = null;
  const fakeFetch = async (_url, init) => {
    body = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      async json() { return { status: 'GOOD_TO_GO', founder_approved: true }; },
      async text() { return ''; },
    };
  };
  const approved = await routeHermesCommand(
    bridgeEnv(),
    command('gulabo.good_to_go', 'gulabo', {
      image_id: 'GULABO-IMG-1', revision: 2, note: 'Founder approved',
    }, 'approval_required'),
    { persist: false, fetchImpl: fakeFetch, nowMs: 1_000_000 },
  );

  assert.equal(approved.status, 'COMPLETED');
  assert.equal(body.decision, 'GOOD_TO_GO');
  assert.equal(body.revision, 2);
});

test('Gulabo bridge status reports configuration without claiming deployment', async () => {
  const snapshot = gulaboBridgeSnapshot(bridgeEnv());
  assert.equal(snapshot.api_base_url_configured, true);
  assert.equal(snapshot.callback_token_configured, true);
  assert.equal(snapshot.callback_secret_configured, true);
  assert.equal(snapshot.production_deployed, false);
  assert.equal(snapshot.live_request_verified, false);

  const routed = await routeHermesCommand(bridgeEnv(), command('gulabo.status', 'gulabo'), { persist: false });
  assert.equal(routed.execution, 'COMPLETED');
  assert.equal(routed.result.api_base_url_configured, true);
});
