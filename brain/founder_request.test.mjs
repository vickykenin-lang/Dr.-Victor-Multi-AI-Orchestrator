import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFounderRequest, TRUTH_SOURCE_PRECEDENCE } from './founder_request.mjs';

test('retains multi-department multi-fact Founder request', () => {
  const r = buildFounderRequest('RIO ka exact heartbeat timestamp batao aur AURA3 repo ka last commit date batao?');
  assert.deepEqual(r.entities, ['rio', 'aura3']);
  assert.ok(r.requested_facts.includes('timestamp'));
  assert.ok(r.requested_facts.includes('heartbeat'));
  assert.ok(r.requested_facts.includes('commit_activity'));
  assert.ok(r.questions.length >= 2);
  assert.equal(r.execution_owner, 'victor_cross_department');
  assert.equal(r.evidence_required, true);
});

test('explicit topic switch overrides stale active thread', () => {
  const r = buildFounderRequest('Tony ka fresh status aur blocker batao', { topic: 'rio', task_id: 'old-rio-task' });
  assert.equal(r.topic, 'tony_stark');
  assert.deepEqual(r.entities, ['tony_stark']);
});

test('owned publish problem defines external success condition', () => {
  const r = buildFounderRequest('RIO post kyu nahi kar raha? issue fix karo aur publish karvao');
  assert.ok(r.requested_actions.includes('diagnose'));
  assert.ok(r.requested_actions.includes('repair'));
  assert.ok(r.requested_actions.includes('publish'));
  assert.equal(r.success_condition, 'EXTERNALLY_VERIFIED_PUBLISH');
});

test('truth precedence keeps current operational evidence above history and memory', () => {
  assert.ok(TRUTH_SOURCE_PRECEDENCE.indexOf('CURRENT_CANONICAL_STATE') < TRUTH_SOURCE_PRECEDENCE.indexOf('HISTORICAL_LOG_OR_ALERT'));
  assert.ok(TRUTH_SOURCE_PRECEDENCE.indexOf('CURRENT_WORKFLOW_OR_JOB_EVIDENCE') < TRUTH_SOURCE_PRECEDENCE.indexOf('CURRENT_CANONICAL_STATE'));
});
