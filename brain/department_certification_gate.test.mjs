import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDepartmentCertificationCommand, certificationAllowedDuringWatchdog } from './department_certification_gate.mjs';
import { evaluateWatchdog } from './safety_watchdog.mjs';

test('Step 8 certification gate accepts only exact bounded department commands', () => {
  const tony = parseDepartmentCertificationCommand('ENDGAME DEPARTMENT CERTIFY TONY');
  assert.equal(tony?.target, 'tony_stark');
  assert.equal(tony?.scope, 'EVIDENCE_ONLY_SANDBOX_DIAGNOSIS');
  assert.match(tony?.prompt || '', /do not deploy/i);
  assert.equal(parseDepartmentCertificationCommand('please ENDGAME DEPARTMENT CERTIFY TONY and deploy'), null);
  assert.equal(parseDepartmentCertificationCommand('ENDGAME DEPARTMENT CERTIFY HULK'), null);
});

test('Step 8 certification remains evidence-only when watchdog fails closed', () => {
  const safeHold = evaluateWatchdog({ watchdog_available: false });
  assert.equal(safeHold.decision, 'SAFE_HOLD');
  assert.equal(safeHold.allow_new_execution, false);
  assert.equal(certificationAllowedDuringWatchdog(safeHold), true);
});

test('Step 8 certification fails closed if watchdog does not explicitly allow evidence and sandbox diagnosis', () => {
  assert.equal(certificationAllowedDuringWatchdog(null), false);
  assert.equal(certificationAllowedDuringWatchdog({ allow_evidence_collection: true }), false);
  assert.equal(certificationAllowedDuringWatchdog({ allow_sandbox_diagnosis: true }), false);
});
