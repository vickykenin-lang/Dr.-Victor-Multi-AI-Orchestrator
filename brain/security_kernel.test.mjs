import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSecurityRequest, validateSecurityPolicyUpdate, SECURITY_POLICY_VERSION } from './security_kernel.mjs';

test('unknown capability fails closed', () => {
  const r = evaluateSecurityRequest({ capability_id: 'unknown.capability' });
  assert.equal(r.decision, 'DENY');
  assert.equal(r.reason, 'CAPABILITY_NOT_REGISTERED');
});

test('Victor cannot grant itself authority expansion even with founder flag', () => {
  const r = evaluateSecurityRequest({ actor: 'victor', capability_id: 'authority.expand', founder_approved: true });
  assert.equal(r.decision, 'DENY');
  assert.equal(r.reason, 'SELF_AUTHORITY_GRANT_PROHIBITED');
});

test('GREEN sandbox execution is allowed by policy', () => {
  const r = evaluateSecurityRequest({ capability_id: 'sandbox.execute' });
  assert.equal(r.decision, 'ALLOW');
  assert.equal(r.zone, 'GREEN');
});

test('AMBER requires Action Contract and active lease', () => {
  const deniedNoContract = evaluateSecurityRequest({ capability_id: 'repo.branch.write' });
  assert.equal(deniedNoContract.decision, 'DENY');
  assert.equal(deniedNoContract.reason, 'ACTION_CONTRACT_REQUIRED');

  const now = Date.parse('2026-09-25T12:00:00Z');
  const deniedExpired = evaluateSecurityRequest({
    capability_id: 'repo.branch.write',
    action_contract_authorized: true,
    lease: { status: 'ACTIVE', expires_at_utc: '2026-09-25T11:59:59Z' },
    now_ms: now,
  });
  assert.equal(deniedExpired.decision, 'DENY');
  assert.equal(deniedExpired.reason, 'ACTIVE_EXECUTION_LEASE_REQUIRED');

  const allowed = evaluateSecurityRequest({
    capability_id: 'repo.branch.write',
    action_contract_authorized: true,
    lease: { status: 'ACTIVE', expires_at_utc: '2026-09-25T12:10:00Z' },
    now_ms: now,
  });
  assert.equal(allowed.decision, 'ALLOW');
  assert.equal(allowed.zone, 'AMBER');
});

test('RED credential rotation requires Founder approval', () => {
  const denied = evaluateSecurityRequest({ capability_id: 'credential.rotate' });
  assert.equal(denied.decision, 'DENY');
  assert.equal(denied.reason, 'FOUNDER_APPROVAL_REQUIRED');

  const allowed = evaluateSecurityRequest({ capability_id: 'credential.rotate', actor: 'security-admin', founder_approved: true });
  assert.equal(allowed.decision, 'ALLOW');
  assert.equal(allowed.zone, 'RED');
});

test('emergency pause blocks execution capabilities independently', () => {
  const r = evaluateSecurityRequest({ capability_id: 'sandbox.execute', emergency_pause: true });
  assert.equal(r.decision, 'DENY');
  assert.equal(r.reason, 'EMERGENCY_PAUSE_ACTIVE');
});

test('policy version mismatch fails closed', () => {
  const r = evaluateSecurityRequest({ capability_id: 'repo.read', policy_version: 'future-unknown-policy' });
  assert.equal(r.decision, 'DENY');
  assert.equal(r.reason, 'UNSUPPORTED_SECURITY_POLICY_VERSION');
  assert.notEqual(r.policy_version, SECURITY_POLICY_VERSION);
});

test('adaptive policy candidate cannot weaken invariants', () => {
  assert.deepEqual(validateSecurityPolicyUpdate({ version: 'v2', fail_open: true }), { valid: false, reason: 'FAIL_OPEN_PROHIBITED' });
  assert.deepEqual(validateSecurityPolicyUpdate({ version: 'v2', allow_self_authority_expansion: true }), { valid: false, reason: 'SELF_AUTHORITY_EXPANSION_PROHIBITED' });
  assert.deepEqual(validateSecurityPolicyUpdate({ version: 'v2', disable_founder_gates: true }), { valid: false, reason: 'FOUNDER_GATE_DISABLE_PROHIBITED' });
  assert.equal(validateSecurityPolicyUpdate({ version: 'v2', fail_open: false }).valid, true);
});
