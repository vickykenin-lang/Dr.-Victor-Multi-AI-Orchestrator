import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStep14RuntimeTruthProbe } from '../scripts/step14_runtime_truth_probe.mjs';

test('Step 14 runtime truth probe verifies bounded Action Contract and procedure use', () => {
  const receipt = buildStep14RuntimeTruthProbe({ runId: 'test-1', observedAt: '2026-09-27T00:00:00.000Z' });
  assert.equal(receipt.status, 'PASS');
  assert.equal(receipt.action_contract.instance_verified, true);
  assert.equal(receipt.action_contract.phase, 'PLAN');
  assert.equal(receipt.action_contract.target, 'internal');
  assert.equal(receipt.action_contract.mutation_allowed, false);
  assert.equal(receipt.action_contract.production_allowed, false);
  assert.equal(receipt.action_contract.public_action_allowed, false);
  assert.equal(receipt.action_contract.spend_allowed, false);
  assert.deepEqual(receipt.action_contract.validation_errors, []);
  assert.equal(receipt.procedure_use.verified, true);
  assert.equal(receipt.procedure_use.procedure_id, 'founder-status-check-v1');
  assert.equal(receipt.procedure_use.reason, 'VERIFIED_PROCEDURE');
  assert.equal(receipt.boundaries.diagnostic_only, true);
  assert.equal(receipt.boundaries.production_action_performed, false);
  assert.equal(receipt.boundaries.public_action_performed, false);
  assert.equal(receipt.boundaries.credential_action_performed, false);
  assert.equal(receipt.boundaries.authority_expanded, false);
  assert.equal(receipt.boundaries.commercial_outcome_upgraded, false);
  assert.equal(receipt.boundaries.secrets_exposed, false);
});
