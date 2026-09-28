import test from 'node:test';
import assert from 'node:assert/strict';
import { assessLearningPromotion, learningMayDirectlyMutateRuntime } from './learning_promotion_guard.mjs';

test('learning can never directly mutate runtime', () => {
  assert.equal(learningMayDirectlyMutateRuntime(), false);
});

test('experience and Cognee remain advisory until all promotion gates pass', () => {
  for (const source of ['EXPERIENCE_LEDGER', 'COGNEE']) {
    const blocked = assessLearningPromotion({ source, target: 'RUNTIME_SOURCE' });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.advisory_only, true);
  }
});

test('promotion requires staging, rollback and Founder approval', () => {
  assert.equal(assessLearningPromotion({ source: 'EXPERIENCE_LEDGER', target: 'PROCEDURE_REGISTRY', stagingVerified: true }).reason, 'ROLLBACK_REQUIRED');
  assert.equal(assessLearningPromotion({ source: 'EXPERIENCE_LEDGER', target: 'PROCEDURE_REGISTRY', stagingVerified: true, rollbackReady: true }).reason, 'FOUNDER_APPROVAL_REQUIRED');
  const allowed = assessLearningPromotion({ source: 'EXPERIENCE_LEDGER', target: 'PROCEDURE_REGISTRY', stagingVerified: true, rollbackReady: true, founderApproved: true });
  assert.equal(allowed.allowed, true);
});
