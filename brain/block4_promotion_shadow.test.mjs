import test from 'node:test';
import assert from 'node:assert/strict';
import { createRollbackContract } from './rollback_contract.mjs';
import { evaluatePromotion, evaluatePostPromotionVerification } from './promotion_gate.mjs';
import { runShadowAutonomy } from './shadow_autonomy_runtime.mjs';

const HEALTHY_WATCHDOG = { watchdog_available: true, watchdog_healthy: true, heartbeat_age_seconds: 5 };

test('sandbox success alone cannot promote without evidence, security, contract and identity', () => {
  const r = evaluatePromotion({
    sandbox_receipt: { status: 'TEST_PASSED', evidence_refs: [], production_applied: false, promotion_required: true },
    security_decision: { decision: 'ALLOW', zone: 'GREEN' },
    action_contract_authorized: true,
  });
  assert.equal(r.decision, 'BLOCK');
  assert.ok(r.blockers.includes('SANDBOX_EVIDENCE_REQUIRED'));
  assert.ok(r.blockers.includes('DEPLOYMENT_SOURCE_SHA_REQUIRED'));
  assert.ok(r.blockers.includes('DEPLOYMENT_BUILD_ID_REQUIRED'));
});

test('AMBER promotion requires valid rollback contract', () => {
  const receipt = { status: 'TEST_PASSED', evidence_refs: ['test:1'], production_applied: false, promotion_required: true };
  const blocked = evaluatePromotion({
    sandbox_receipt: receipt,
    security_decision: { decision: 'ALLOW', zone: 'AMBER' },
    action_contract_authorized: true,
    deployment_identity: { source_sha: 'abc', build_id: 'build-1' },
  });
  assert.equal(blocked.decision, 'BLOCK');

  const rollback = createRollbackContract({
    previous_version: 'v1', target_version: 'v2', rollback_action: 'restore:v1', verification_probes: ['/health'], reversible: true,
  });
  const allowed = evaluatePromotion({
    sandbox_receipt: receipt,
    security_decision: { decision: 'ALLOW', zone: 'AMBER' },
    action_contract_authorized: true,
    rollback_contract: rollback,
    deployment_identity: { source_sha: 'abc', build_id: 'build-1' },
  });
  assert.equal(allowed.decision, 'ALLOW_PROMOTION');
  assert.equal(allowed.production_apply_allowed, true);
});

test('RED promotion remains Founder gated', () => {
  const receipt = { status: 'TEST_PASSED', evidence_refs: ['test:1'], production_applied: false, promotion_required: true };
  const denied = evaluatePromotion({
    sandbox_receipt: receipt,
    security_decision: { decision: 'ALLOW', zone: 'RED' },
    action_contract_authorized: true,
    deployment_identity: { source_sha: 'abc', build_id: 'build-1' },
    founder_approved: false,
    zone: 'RED',
  });
  assert.equal(denied.decision, 'BLOCK');
  assert.ok(denied.blockers.includes('FOUNDER_APPROVAL_REQUIRED'));
});

test('post-promotion health or identity failure requires rollback', () => {
  const r = evaluatePostPromotionVerification({ health_ok: false, identity_matches: true, evidence_ok: true });
  assert.equal(r.decision, 'ROLLBACK_REQUIRED');
  assert.ok(r.failed.includes('POST_PROMOTION_HEALTH_FAILED'));
});

test('shadow runtime honors Founder STOP before dispatch', () => {
  const r = runShadowAutonomy({ founder_text: 'RIO par kaam band karo', objective_id: 'OBJ', action_id: 'ACT', active_target: 'rio' });
  assert.equal(r.decision, 'SAFE_HOLD');
  assert.equal(r.department_dispatch_allowed, false);
  assert.equal(r.production_apply_allowed, false);
});

test('shadow runtime does not dispatch questions/system tests', () => {
  const r = runShadowAutonomy({ founder_text: 'I want to test you', objective_id: 'OBJ', action_id: 'ACT' });
  assert.equal(r.decision, 'NO_DISPATCH');
  assert.equal(r.department_dispatch_allowed, false);
});

test('shadow runtime can authorize sandbox execution but never production apply', () => {
  const r = runShadowAutonomy({
    founder_text: 'Victor execute block 4',
    objective_id: 'OBJ',
    action_id: 'ACT',
    capability_id: 'sandbox.execute',
    watchdog_input: HEALTHY_WATCHDOG,
    now_utc: '2026-09-25T12:00:00Z',
  });
  assert.equal(r.decision, 'SANDBOX_EXECUTION_AUTHORIZED');
  assert.equal(r.department_dispatch_allowed, true);
  assert.equal(r.production_apply_allowed, false);
  assert.equal(r.lease.issued, true);
});

test('watchdog blocks shadow execution on anomaly', () => {
  const r = runShadowAutonomy({
    founder_text: 'Victor execute block 4',
    objective_id: 'OBJ',
    action_id: 'ACT',
    watchdog_input: { ...HEALTHY_WATCHDOG, credential_or_security_anomaly: true },
  });
  assert.equal(r.decision, 'SAFE_HOLD');
  assert.equal(r.reason, 'WATCHDOG_SAFE_HOLD');
  assert.ok(r.watchdog.triggers.includes('CREDENTIAL_SECURITY_ANOMALY'));
});

test('Founder unavailable at RED boundary safe-holds', () => {
  const r = runShadowAutonomy({
    founder_text: 'Victor execute credential rotation',
    objective_id: 'OBJ',
    action_id: 'ACT',
    capability_id: 'credential.rotate',
    founder_available: false,
    founder_approved: false,
    action_contract_authorized: true,
    watchdog_input: HEALTHY_WATCHDOG,
    now_utc: '2026-09-25T12:00:00Z',
  });
  assert.equal(r.decision, 'SAFE_HOLD');
  assert.equal(r.reason, 'FOUNDER_UNAVAILABLE_RED_BOUNDARY');
  assert.equal(r.production_apply_allowed, false);
});
