import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResultTruthReceipts, attachResultTruth } from './result_truth_receipts.mjs';

test('department result stays DEPARTMENT_ENVELOPE without explicit external verification', () => {
  const result = {
    sender: 'rio',
    task_id: 't1',
    observed_at: '2026-09-02T00:00:00Z',
    __victor_verified: true,
    public_action_performed: true,
    strict_supervision: {
      status: 'GOAL_PROGRESS_VERIFIED',
      requires_follow_up: true,
      evidence: ['data/ig_published.json'],
      final_outcome: { verified: true, objective_met: true, evidence: ['data/ig_published.json'] },
    },
  };
  const receipts = buildResultTruthReceipts(result, { fetchedAt: '2026-09-02T00:01:00Z' });
  assert.ok(receipts.length >= 3);
  assert.ok(receipts.every(r => r.source_class === 'DEPARTMENT_ENVELOPE'));
  assert.equal(receipts.some(r => r.fact === 'rio.external.objective_outcome'), false);
});

test('explicit platform verification creates EXTERNAL_RESULT receipt', () => {
  const result = {
    sender: 'rio',
    task_id: 't2',
    observed_at: '2026-09-02T00:00:00Z',
    __victor_verified: true,
    strict_supervision: { status: 'OBJECTIVE_MET_VERIFIED', requires_follow_up: false },
    external_verification: {
      verified: true,
      objective_met: true,
      platform: 'instagram',
      external_id: '181234',
      permalink: 'https://instagram.com/p/example',
      evidence: ['Meta media ID 181234', 'permalink verified'],
    },
  };
  const attached = attachResultTruth(result, { fetchedAt: '2026-09-02T00:01:00Z' });
  const receipt = attached.truth_receipts.find(r => r.fact === 'rio.external.objective_outcome');
  assert.equal(receipt.source_class, 'EXTERNAL_RESULT');
  assert.equal(receipt.value.external_id, '181234');
  assert.equal(attached.resolved_truth.facts['rio.external.objective_outcome'].status, 'RESOLVED');
});

test('department final outcome claim is labelled as claim rather than promoted externally', () => {
  const result = {
    sender: 'tony_stark',
    task_id: 't3',
    __victor_verified: true,
    final_outcome: { verified: true, objective_met: true, evidence: ['tests passed'] },
    strict_supervision: { status: 'COMPLETED', requires_follow_up: false },
  };
  const receipts = buildResultTruthReceipts(result);
  const claim = receipts.find(r => r.fact === 'tony_stark.result.final_outcome_claim');
  assert.equal(claim.source_class, 'DEPARTMENT_ENVELOPE');
  assert.equal(claim.value.objective_met, true);
  assert.equal(receipts.some(r => r.source_class === 'EXTERNAL_RESULT'), false);
});
