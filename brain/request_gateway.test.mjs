import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRuntimeFounderRequest, buildSessionPatchForRequest, buildFactRequestFromFounderRequest, shouldUseFactGateway, isExplicitExecutiveGoalCommand, isExplicitDepartmentExecutionRequest } from './request_gateway.mjs';

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

test('explicit organization goal execution command is deterministic', () => {
  assert.equal(isExplicitExecutiveGoalCommand('Victor, ORG-REVENUE-001 ko abhi manually execute karo. Existing governance, validation, SAFE_STOP aur evidence persistence follow karke verified result do.'), true);
  assert.equal(isExplicitExecutiveGoalCommand('ORG-REVENUE-001 ka current status aur evidence batao'), false);
  assert.equal(isExplicitExecutiveGoalCommand('RIO ko manually execute karo'), false);
});

test('explicit Tony execution is not swallowed by fact/evidence deliverable wording', () => {
  const text = 'Tony Stark ko bounded substantive certification task assign karo: repository ko read analyze karke evidence-backed engineering assessment karo. At least one concrete finding aur actionable recommendation return karo with inspected repository evidence.';
  const request = buildRuntimeFounderRequest(text, {});
  const fact = buildFactRequestFromFounderRequest(request, text);
  assert.equal(request.entities.length, 1);
  assert.equal(request.entities[0], 'tony_stark');
  assert.ok(request.requested_actions.includes('execute'));
  assert.equal(request.evidence_required, true);
  assert.equal(isExplicitDepartmentExecutionRequest(request), true);
  assert.equal(shouldUseFactGateway(request, fact), false);
});

test('Tony factual status query still uses fact gateway', () => {
  const text = 'Tony ka latest repo commit date aur evidence batao';
  const request = buildRuntimeFounderRequest(text, {});
  const fact = buildFactRequestFromFounderRequest(request, text);
  assert.equal(isExplicitDepartmentExecutionRequest(request), false);
  assert.equal(shouldUseFactGateway(request, fact), true);
});
