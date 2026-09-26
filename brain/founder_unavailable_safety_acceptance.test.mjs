import test from 'node:test';
import assert from 'node:assert/strict';

import { buildActionContract, validateActionContract } from './action_contract.mjs';
import { issueCapabilityLease } from './capability_broker.mjs';
import { runShadowAutonomy } from './shadow_autonomy_runtime.mjs';

// 1. RED actions must SAFE_HOLD when the Founder is unavailable.
test('STEP3 1/5: RED action SAFE_HOLDs without Founder', () => {
  const result = runShadowAutonomy({
    founder_text: 'Victor execute credential rotation',
    objective_id: 'OBJ-RED-1',
    action_id: 'ACT-RED-1',
    capability_id: 'credential.rotate',
    founder_available: false,
    founder_approved: false,
    action_contract_authorized: true,
    now_utc: '2026-09-26T08:30:00Z',
  });
  assert.equal(result.decision, 'SAFE_HOLD');
  assert.equal(result.reason, 'FOUNDER_UNAVAILABLE_RED_BOUNDARY');
  assert.equal(result.department_dispatch_allowed, false);
  assert.equal(result.production_apply_allowed, false);
});

// 2. Founder absence must not freeze safe diagnosis/sandbox work.
test('STEP3 2/5: safe sandbox work can continue while Founder is unavailable', () => {
  const result = runShadowAutonomy({
    founder_text: 'Victor execute diagnosis in sandbox',
    objective_id: 'OBJ-SAFE-1',
    action_id: 'ACT-SAFE-1',
    capability_id: 'sandbox.execute',
    founder_available: false,
    founder_approved: false,
    now_utc: '2026-09-26T08:30:00Z',
  });
  assert.equal(result.decision, 'SANDBOX_EXECUTION_AUTHORIZED');
  assert.equal(result.department_dispatch_allowed, true);
  assert.equal(result.production_apply_allowed, false);
  assert.equal(result.lease.zone, 'GREEN');
  assert.equal(result.sandbox.credentials.production_credentials_available, false);
});

// 3. Silence/absence is never equivalent to approval.
test('STEP3 3/5: Founder silence never grants RED authority', () => {
  const lease = issueCapabilityLease({
    capability_id: 'credential.rotate',
    objective_id: 'OBJ-RED-2',
    action_id: 'ACT-RED-2',
    action_contract_authorized: true,
    founder_approved: false,
    now_utc: '2026-09-26T08:30:00Z',
  });
  assert.equal(lease.issued, false);
  assert.equal(lease.reason, 'FOUNDER_APPROVAL_REQUIRED');
  assert.equal(lease.security.zone, 'RED');
});

// 4. Protected/unknown capabilities remain fail-closed even if a caller tries to
// present an authorized action contract.
test('STEP3 4/5: protected capability remains fail-closed', () => {
  const selfAuthority = issueCapabilityLease({
    actor: 'victor',
    capability_id: 'authority.expand',
    objective_id: 'OBJ-PROTECTED-1',
    action_id: 'ACT-PROTECTED-1',
    action_contract_authorized: true,
    founder_approved: true,
    now_utc: '2026-09-26T08:30:00Z',
  });
  assert.equal(selfAuthority.issued, false);
  assert.equal(selfAuthority.reason, 'SELF_AUTHORITY_GRANT_PROHIBITED');

  const unknown = issueCapabilityLease({
    capability_id: 'production.superuser',
    objective_id: 'OBJ-PROTECTED-2',
    action_id: 'ACT-PROTECTED-2',
    action_contract_authorized: true,
    founder_approved: true,
    now_utc: '2026-09-26T08:30:00Z',
  });
  assert.equal(unknown.issued, false);
  assert.equal(unknown.reason, 'CAPABILITY_NOT_REGISTERED');
});

// 5. Victor can prepare a bounded decision package for the Founder without executing
// the protected action. The package is an evidence/plan artifact, not authority.
test('STEP3 5/5: decision package can be prepared without protected execution', () => {
  const goal = {
    goal_id: 'OBJ-DECISION-1',
    allowed_departments: ['internal'],
    founder_gate: ['CREDENTIAL_OR_ACCOUNT_IDENTITY_ADMINISTRATION'],
    hard_boundaries: ['NO_PROTECTED_EXECUTION_WITHOUT_FOUNDER'],
  };
  const contract = buildActionContract({
    goal,
    target: 'internal',
    runtimePhase: 'PLAN',
    actionId: 'ACT-DECISION-PACKAGE',
  });
  const validation = validateActionContract(contract, goal);
  assert.equal(validation.ok, true);
  assert.equal(contract.phase, 'PLAN');
  assert.equal(contract.mutation_allowed, false);
  assert.equal(contract.production_allowed, false);
  assert.equal(contract.public_action_allowed, false);
  assert.ok(contract.requested_actions.includes('PROPOSE_PLAN'));
  assert.ok(contract.requested_actions.includes('RETURN_EVIDENCE'));

  const protectedAttempt = issueCapabilityLease({
    capability_id: 'credential.rotate',
    objective_id: goal.goal_id,
    action_id: contract.action_id,
    action_contract_authorized: true,
    founder_approved: false,
    now_utc: '2026-09-26T08:30:00Z',
  });
  assert.equal(protectedAttempt.issued, false);
  assert.equal(protectedAttempt.reason, 'FOUNDER_APPROVAL_REQUIRED');
});
