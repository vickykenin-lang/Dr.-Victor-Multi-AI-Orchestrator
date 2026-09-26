import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSecurityUpdateCandidate, buildSecurityUpdateReceipt } from './adaptive_security.mjs';

const INVARIANTS = [
  'FAIL_CLOSED',
  'NO_SELF_AUTHORITY_EXPANSION',
  'FOUNDER_GATES_PRESERVED',
  'NO_MASTER_SECRET_EXPOSURE',
  'SANDBOX_BEFORE_UNTRUSTED_EXECUTION',
  'EVIDENCE_STAGE_SEPARATION',
];

const PASSING_TESTS = { REGRESSION: true, RED_TEAM: true, FAIL_CLOSED: true, ROLLBACK: true };

function candidate(extra = {}) {
  return {
    control_id: 'step7-redteam-control',
    version: '7.0.0',
    fail_open: false,
    invariants_preserved: [...INVARIANTS],
    ...extra,
  };
}

function assertProtectedRejected(extra, expectedBlocker = null) {
  const c = candidate(extra);
  const evaluation = evaluateSecurityUpdateCandidate(c);
  assert.equal(evaluation.decision, 'REJECT');
  assert.equal(evaluation.founder_gate, true);
  assert.equal(evaluation.protected_change, true);
  if (expectedBlocker) assert.ok((evaluation.blockers || []).some(x => x.includes(expectedBlocker)));

  const receipt = buildSecurityUpdateReceipt({
    candidate: c,
    tests: PASSING_TESTS,
    approved_for_enforcement: true,
    founder_approved: true,
  });
  assert.equal(receipt.enforcement_allowed, false);
  assert.equal(receipt.production_applied, false);
  assert.equal(receipt.decision, 'NOT_ENFORCEABLE');
}

test('Step 7.1 Founder-gate weakening cannot hide behind invariant attestation', () => {
  assertProtectedRejected({ founder_gate_required: false }, 'FOUNDER_GATE_REQUIREMENT_REMOVAL');
  assertProtectedRejected({ disable_founder_gates: true });
});

test('Step 7.2 Security Kernel fail-open or disable attempts are rejected', () => {
  assertProtectedRejected({ disable_security_kernel: true }, 'disable_security_kernel');
  assertProtectedRejected({ security_kernel_required: false }, 'SECURITY_KERNEL_REQUIREMENT_REMOVAL');
});

test('Step 7.3 watchdog weakening is rejected before enforcement', () => {
  assertProtectedRejected({ disable_watchdog: true }, 'disable_watchdog');
  assertProtectedRejected({ watchdog_required: false }, 'WATCHDOG_REQUIREMENT_REMOVAL');
  assertProtectedRejected({ watchdog_fail_open: true }, 'watchdog_fail_open');
});

test('Step 7.4 capability policy cannot downgrade RED authority or remove RED Founder gate', () => {
  assertProtectedRejected({
    capability_policy_changes: [
      { capability_id: 'credential.rotate', from_zone: 'RED', to_zone: 'GREEN', founder_gate: false },
    ],
  }, 'CAPABILITY_ZONE_DOWNGRADE');
});

test('Step 7.5 Victor self-authority expansion and protected-governance bypass are rejected', () => {
  assertProtectedRejected({ authority_changes: [{ actor: 'victor', expand: true }] }, 'VICTOR_SELF_AUTHORITY_EXPANSION_ATTEMPT');
  assertProtectedRejected({ allow_protected_governance_bypass: true }, 'allow_protected_governance_bypass');
});

test('Step 7.6 benign sandbox experimentation remains possible without production mutation', () => {
  const c = candidate({ control_id: 'benign-observer', version: '7.1.0' });
  const evaluation = evaluateSecurityUpdateCandidate(c);
  assert.equal(evaluation.decision, 'SANDBOX_TEST_REQUIRED');
  assert.equal(evaluation.founder_gate, false);

  const notApproved = buildSecurityUpdateReceipt({ candidate: c, tests: PASSING_TESTS });
  assert.equal(notApproved.sandbox_tests_passed, true);
  assert.equal(notApproved.enforcement_allowed, false);
  assert.equal(notApproved.production_applied, false);

  const approved = buildSecurityUpdateReceipt({
    candidate: c,
    tests: PASSING_TESTS,
    approved_for_enforcement: true,
  });
  assert.equal(approved.enforcement_allowed, true);
  assert.equal(approved.production_applied, false);
});

test('Step 7.7 legitimate material security-boundary change requires explicit Founder approval', () => {
  const c = candidate({
    control_id: 'boundary-hardening',
    version: '7.2.0',
    security_boundary_change: true,
  });
  const evaluation = evaluateSecurityUpdateCandidate(c);
  assert.equal(evaluation.decision, 'SANDBOX_TEST_REQUIRED');
  assert.equal(evaluation.founder_gate, true);

  const withoutFounder = buildSecurityUpdateReceipt({
    candidate: c,
    tests: PASSING_TESTS,
    approved_for_enforcement: true,
    founder_approved: false,
  });
  assert.equal(withoutFounder.enforcement_allowed, false);
  assert.equal(withoutFounder.production_applied, false);

  const withFounder = buildSecurityUpdateReceipt({
    candidate: c,
    tests: PASSING_TESTS,
    approved_for_enforcement: true,
    founder_approved: true,
  });
  assert.equal(withFounder.enforcement_allowed, true);
  assert.equal(withFounder.production_applied, false);
});
