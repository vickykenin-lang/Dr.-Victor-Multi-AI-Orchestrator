import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRuntimeFounderRequest, buildSessionPatchForRequest, buildFactRequestFromFounderRequest, shouldUseFactGateway } from './request_gateway.mjs';

test('explicit topic switch clears stale task lineage', () => {
  const session = { last_target: 'rio', last_task_id: 'victor-rio-old', parent_task_id: 'parent-old', unresolved_question: 'old rio issue' };
  const request = buildRuntimeFounderRequest('Tony ka latest repo commit date batao', session);
  assert.equal(request.runtime.topic_switched, true);
  const patch = buildSessionPatchForRequest(request);
  assert.equal(patch.last_target, 'tony_stark');
  assert.equal(patch.last_task_id, null);
  assert.equal(patch.parent_task_id, null);
  assert.equal(patch.unresolved_question, null);
});

test('multi-department exact fact request retains every target and fact intent', () => {
  const text = 'RIO ka exact heartbeat timestamp aur AURA3 ka latest commit date aur Tony ka repo activity date batao';
  const request = buildRuntimeFounderRequest(text, {});
  const fact = buildFactRequestFromFounderRequest(request, text);
  assert.deepEqual(new Set(fact.targets), new Set(['rio', 'aura3', 'tony_stark']));
  assert.equal(fact.asksHeartbeat, true);
  assert.equal(fact.asksCommit, true);
  assert.equal(shouldUseFactGateway(request, fact), true);
  assert.ok(request.questions.length >= 2);
});

test('plain conversation does not force fact retrieval', () => {
  const text = 'Victor tum kya karte ho';
  const request = buildRuntimeFounderRequest(text, {});
  const fact = buildFactRequestFromFounderRequest(request, text);
  assert.equal(request.evidence_required, false);
  assert.equal(shouldUseFactGateway(request, fact), false);
});
