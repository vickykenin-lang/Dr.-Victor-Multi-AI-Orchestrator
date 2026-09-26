import test from 'node:test';
import assert from 'node:assert/strict';

import { issueCapabilityLease, validateCapabilityLease, revokeCapabilityLease } from './capability_broker.mjs';
import { evaluateSecurityRequest, SECURITY_POLICY_VERSION } from './security_kernel.mjs';

const NOW = '2026-09-26T10:00:00.000Z';

function issueGreen(overrides = {}) {
  return issueCapabilityLease({
    actor: 'victor',
    capability_id: 'sandbox.execute',
    objective_id: 'objective-step4',
    action_id: 'action-step4',
    action_contract_authorized: true,
    ttl_seconds: 60,
    now_utc: NOW,
    ...overrides,
  });
}

test('Step4-1 issues opaque, narrow, non-transferable capability handle without secret material', () => {
  const lease = issueGreen();
  assert.equal(lease.issued, true);
  assert.match(lease.handle, /^cap_[a-f0-9]{24}$/i);
  assert.equal(lease.capability_id, 'sandbox.execute');
  assert.equal(lease.objective_id, 'objective-step4');
  assert.equal(lease.action_id, 'action-step4');
  assert.equal(lease.transferable, false);
  assert.equal(lease.secret_material_exposed, false);
  assert.equal('secret' in lease, false);
  assert.equal('token' in lease, false);
  assert.equal('credential' in lease, false);
});

test('Step4-2 scope isolation rejects objective, action and capability substitution', () => {
  const lease = issueGreen();
  assert.equal(validateCapabilityLease(lease, { objective_id: 'other', now_utc: NOW }).reason, 'OBJECTIVE_SCOPE_MISMATCH');
  assert.equal(validateCapabilityLease(lease, { action_id: 'other', now_utc: NOW }).reason, 'ACTION_SCOPE_MISMATCH');
  assert.equal(validateCapabilityLease(lease, { capability_id: 'repo.read', now_utc: NOW }).reason, 'CAPABILITY_SCOPE_MISMATCH');
});

test('Step4-3 lease lifecycle validates active use then denies expiry', () => {
  const lease = issueGreen({ ttl_seconds: 60 });
  assert.deepEqual(validateCapabilityLease(lease, {
    objective_id: 'objective-step4', action_id: 'action-step4', capability_id: 'sandbox.execute', now_utc: '2026-09-26T10:00:30.000Z',
  }), { valid: true, reason: 'LEASE_VALID' });
  assert.equal(validateCapabilityLease(lease, { now_utc: '2026-09-26T10:01:00.000Z' }).reason, 'LEASE_EXPIRED');
});

test('Step4-4 revoked capability is denied', () => {
  const lease = issueGreen();
  const revoked = revokeCapabilityLease(lease, 'STEP4_TEST');
  assert.equal(revoked.status, 'REVOKED');
  assert.equal(validateCapabilityLease(revoked, { now_utc: NOW }).reason, 'LEASE_NOT_ACTIVE');
});

test('Step4-5 Victor cannot self-expand authority even with claimed Founder approval', () => {
  const decision = evaluateSecurityRequest({
    actor: 'victor',
    capability_id: 'authority.expand',
    founder_approved: true,
    action_contract_authorized: true,
    policy_version: SECURITY_POLICY_VERSION,
    now_ms: Date.parse(NOW),
  });
  assert.equal(decision.decision, 'DENY');
  assert.equal(decision.reason, 'SELF_AUTHORITY_GRANT_PROHIBITED');
});

test('Step4-6 broker output fails validation if secret exposure or transferability is introduced', () => {
  const lease = issueGreen();
  assert.equal(validateCapabilityLease({ ...lease, secret_material_exposed: true }, { now_utc: NOW }).reason, 'SECRET_EXPOSURE_PROHIBITED');
  assert.equal(validateCapabilityLease({ ...lease, transferable: true }, { now_utc: NOW }).reason, 'TRANSFERABLE_LEASE_PROHIBITED');
});
