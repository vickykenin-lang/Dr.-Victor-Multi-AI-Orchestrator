import test from 'node:test';
import assert from 'node:assert/strict';
import { createSandboxSpec, validateSandboxSpec, evaluateSandboxBudget, buildSandboxEvidenceReceipt } from './sandbox_manager.mjs';
import { issueCapabilityLease, validateCapabilityLease, revokeCapabilityLease } from './capability_broker.mjs';
import { evaluateWatchdog, watchdogOverridesVictor } from './safety_watchdog.mjs';

const HEALTHY_WATCHDOG = { watchdog_available: true, watchdog_healthy: true, heartbeat_age_seconds: 5 };

test('sandbox defaults to disposable, isolated, deny-network and no production credentials', () => {
  const spec = createSandboxSpec({ objective_id: 'OBJ-1', action_id: 'ACT-1' });
  assert.equal(spec.lifecycle, 'DISPOSABLE');
  assert.equal(spec.network.default, 'DENY');
  assert.equal(spec.credentials.master_credentials_available, false);
  assert.equal(spec.credentials.production_credentials_available, false);
  assert.equal(spec.git.protected_branch_write, false);
  assert.deepEqual(validateSandboxSpec(spec), { valid: true, reason: 'SANDBOX_SPEC_VALID' });
});

test('sandbox rejects production credential exposure and fail-open network', () => {
  const spec = createSandboxSpec({ objective_id: 'OBJ-1', action_id: 'ACT-2' });
  const badCredentials = { ...spec, credentials: { ...spec.credentials, production_credentials_available: true } };
  assert.equal(validateSandboxSpec(badCredentials).valid, false);
  const badNetwork = { ...spec, network: { ...spec.network, default: 'ALLOW' } };
  assert.equal(validateSandboxSpec(badNetwork).valid, false);
});

test('budget excess forces safe hold', () => {
  const spec = createSandboxSpec({ objective_id: 'OBJ-2', action_id: 'ACT-1', budgets: { runtime_seconds: 10, external_calls: 2 } });
  const r = evaluateSandboxBudget({ spec, usage: { runtime_seconds: 11, external_calls: 3 } });
  assert.equal(r.allowed, false);
  assert.equal(r.safe_hold, true);
  assert.ok(r.exceeded.includes('RUNTIME'));
  assert.ok(r.exceeded.includes('EXTERNAL_CALLS'));
});

test('sandbox receipt cannot imply production application', () => {
  const spec = createSandboxSpec({ objective_id: 'OBJ-3', action_id: 'ACT-1' });
  const receipt = buildSandboxEvidenceReceipt({ spec, status: 'TEST_PASSED', evidence_refs: ['test:1'] });
  assert.equal(receipt.production_applied, false);
  assert.equal(receipt.promotion_required, true);
});

test('GREEN capability broker issues opaque scoped lease without secret material', () => {
  const lease = issueCapabilityLease({
    capability_id: 'sandbox.execute', objective_id: 'OBJ-4', action_id: 'ACT-1', now_utc: '2026-09-25T12:00:00Z', ttl_seconds: 60,
  });
  assert.equal(lease.issued, true);
  assert.equal(lease.secret_material_exposed, false);
  assert.equal(lease.transferable, false);
  assert.match(lease.handle, /^cap_/);
  assert.equal(validateCapabilityLease(lease, { objective_id: 'OBJ-4', action_id: 'ACT-1', capability_id: 'sandbox.execute', now_utc: '2026-09-25T12:00:30Z' }).valid, true);
});

test('AMBER lease requires governed Action Contract', () => {
  const denied = issueCapabilityLease({ capability_id: 'repo.branch.write', objective_id: 'OBJ-5', action_id: 'ACT-1', now_utc: '2026-09-25T12:00:00Z' });
  assert.equal(denied.issued, false);
  assert.equal(denied.reason, 'ACTION_CONTRACT_REQUIRED');

  const allowed = issueCapabilityLease({ capability_id: 'repo.branch.write', objective_id: 'OBJ-5', action_id: 'ACT-1', action_contract_authorized: true, now_utc: '2026-09-25T12:00:00Z' });
  assert.equal(allowed.issued, true);
});

test('expired, wrong-scope and revoked leases fail closed', () => {
  const lease = issueCapabilityLease({ capability_id: 'sandbox.execute', objective_id: 'OBJ-6', action_id: 'ACT-1', now_utc: '2026-09-25T12:00:00Z', ttl_seconds: 10 });
  assert.equal(validateCapabilityLease(lease, { objective_id: 'OTHER', now_utc: '2026-09-25T12:00:01Z' }).reason, 'OBJECTIVE_SCOPE_MISMATCH');
  assert.equal(validateCapabilityLease(lease, { now_utc: '2026-09-25T12:00:11Z' }).reason, 'LEASE_EXPIRED');
  assert.equal(validateCapabilityLease(revokeCapabilityLease(lease), { now_utc: '2026-09-25T12:00:01Z' }).reason, 'LEASE_NOT_ACTIVE');
});

test('watchdog independently forces SAFE_HOLD and overrides Victor continue', () => {
  const wd = evaluateWatchdog({ ...HEALTHY_WATCHDOG, credential_or_security_anomaly: true });
  assert.equal(wd.decision, 'SAFE_HOLD');
  assert.equal(wd.allow_new_execution, false);
  assert.ok(wd.triggers.includes('CREDENTIAL_SECURITY_ANOMALY'));
  const effective = watchdogOverridesVictor('CONTINUE', wd);
  assert.equal(effective.effective_decision, 'SAFE_HOLD');
  assert.equal(effective.overridden, true);
  assert.equal(effective.authority, 'INDEPENDENT_WATCHDOG');
});

test('healthy watchdog permits bounded continuation', () => {
  const wd = evaluateWatchdog({ ...HEALTHY_WATCHDOG, semantic_no_progress_count: 0, transient_retry_count: 0 });
  assert.equal(wd.decision, 'CONTINUE_BOUNDED');
  assert.equal(wd.allow_new_execution, true);
});
