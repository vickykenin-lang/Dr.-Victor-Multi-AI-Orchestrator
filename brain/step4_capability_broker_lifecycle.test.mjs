import test from 'node:test';
import assert from 'node:assert/strict';
import * as broker from './capability_broker.mjs';
import { createSandboxSpec, buildSandboxEvidenceReceipt, validateSandboxSpec } from './sandbox_manager.mjs';
import { evaluateSecurityRequest } from './security_kernel.mjs';

const NOW = '2026-09-26T08:30:00Z';

test('Step 4.1 narrow opaque capability handle is objective/action/capability scoped', () => {
  const lease = broker.issueCapabilityLease({
    capability_id: 'sandbox.execute', objective_id: 'OBJ-S4', action_id: 'ACT-S4', now_utc: NOW, ttl_seconds: 60,
  });
  assert.equal(lease.issued, true);
  assert.match(lease.handle, /^cap_[a-f0-9]{24}$/);
  assert.equal(lease.objective_id, 'OBJ-S4');
  assert.equal(lease.action_id, 'ACT-S4');
  assert.equal(lease.capability_id, 'sandbox.execute');
  assert.equal(lease.transferable, false);
  assert.equal(broker.validateCapabilityLease(lease, {
    objective_id: 'OBJ-S4', action_id: 'OTHER', capability_id: 'sandbox.execute', now_utc: '2026-09-26T08:30:10Z',
  }).reason, 'ACTION_SCOPE_MISMATCH');
});

test('Step 4.2 sandbox exposes handles only and never broad master/production credentials', () => {
  const spec = createSandboxSpec({ objective_id: 'OBJ-S4', action_id: 'ACT-S4-2' });
  assert.equal(spec.credentials.master_credentials_available, false);
  assert.equal(spec.credentials.production_credentials_available, false);
  assert.equal(spec.credentials.secret_handles_only, true);
  assert.deepEqual(validateSandboxSpec(spec), { valid: true, reason: 'SANDBOX_SPEC_VALID' });
});

test('Step 4.3 lease issue/use/expiry/revocation lifecycle fails closed', () => {
  const lease = broker.issueCapabilityLease({
    capability_id: 'sandbox.execute', objective_id: 'OBJ-S4', action_id: 'ACT-S4-3', now_utc: NOW, ttl_seconds: 20,
  });
  assert.equal(lease.issued, true);
  assert.equal(broker.validateCapabilityLease(lease, {
    objective_id: 'OBJ-S4', action_id: 'ACT-S4-3', capability_id: 'sandbox.execute', now_utc: '2026-09-26T08:30:10Z',
  }).valid, true);
  assert.equal(broker.validateCapabilityLease(lease, { now_utc: '2026-09-26T08:30:21Z' }).reason, 'LEASE_EXPIRED');
  const revoked = broker.revokeCapabilityLease(lease, 'TEST_REVOKE');
  assert.equal(revoked.status, 'REVOKED');
  assert.equal(broker.validateCapabilityLease(revoked, { now_utc: '2026-09-26T08:30:11Z' }).reason, 'LEASE_NOT_ACTIVE');
});

test('Step 4.4 Victor has no self-renew API and cannot self-expand authority', () => {
  assert.equal(typeof broker.renewCapabilityLease, 'undefined');
  const decision = evaluateSecurityRequest({
    actor: 'victor', capability_id: 'authority.expand', founder_approved: true,
  });
  assert.equal(decision.decision, 'DENY');
  assert.equal(decision.reason, 'SELF_AUTHORITY_GRANT_PROHIBITED');
});

test('Step 4.5 expired and revoked capabilities remain denied even with matching scope', () => {
  const lease = broker.issueCapabilityLease({
    capability_id: 'sandbox.execute', objective_id: 'OBJ-S4', action_id: 'ACT-S4-5', now_utc: NOW, ttl_seconds: 5,
  });
  assert.equal(broker.validateCapabilityLease(lease, {
    objective_id: 'OBJ-S4', action_id: 'ACT-S4-5', capability_id: 'sandbox.execute', now_utc: '2026-09-26T08:30:06Z',
  }).valid, false);
  const revoked = broker.revokeCapabilityLease(lease);
  assert.equal(broker.validateCapabilityLease(revoked, {
    objective_id: 'OBJ-S4', action_id: 'ACT-S4-5', capability_id: 'sandbox.execute', now_utc: '2026-09-26T08:30:01Z',
  }).valid, false);
});

test('Step 4.6 secret-like material is redacted from sandbox evidence/output receipts', () => {
  const spec = createSandboxSpec({ objective_id: 'OBJ-S4', action_id: 'ACT-S4-6' });
  const fakeGithubToken = `ghp_${'A'.repeat(24)}`;
  const fakeAwsKey = `AKIA${'B'.repeat(16)}`;
  const receipt = buildSandboxEvidenceReceipt({
    spec,
    status: 'TEST_PASSED',
    evidence_refs: [`Bearer abc.def.ghi`, `api_key=${fakeGithubToken}`, `ref:${fakeAwsKey}`],
    notes: ['password=hunter2', 'token:super-secret-value'],
  });
  const serialized = JSON.stringify(receipt);
  assert.equal(receipt.secret_material_exposed, false);
  assert.equal(serialized.includes('abc.def.ghi'), false);
  assert.equal(serialized.includes(fakeGithubToken), false);
  assert.equal(serialized.includes(fakeAwsKey), false);
  assert.equal(serialized.includes('hunter2'), false);
  assert.equal(serialized.includes('super-secret-value'), false);
  assert.match(serialized, /\[REDACTED\]/);
});
