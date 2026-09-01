import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyConversationFollowUp, buildInvestigationTaskText, formatPendingTaskStatus } from './conversation_runtime.mjs';

test('short continuation binds to recent RIO context', () => {
  const result = classifyConversationFollowUp('pata karke batao', { last_target: 'rio', last_task_id: 'victor-rio-123' });
  assert.equal(result.mode, 'CONTEXTUAL_DEPARTMENT_FOLLOWUP');
  assert.equal(result.target, 'rio');
  assert.equal(result.task_id, 'victor-rio-123');
});

test('task status follow-up does not create a new task intent', () => {
  const result = classifyConversationFollowUp('iska status kab pata chalega?', { last_target: 'rio', last_task_id: 'victor-rio-123' });
  assert.equal(result.mode, 'TASK_STATUS_FOLLOWUP');
  assert.equal(result.task_id, 'victor-rio-123');
});

test('contextual next step binds to active RIO task', () => {
  const result = classifyConversationFollowUp('to ab kya karna chahiye?', { last_target: 'rio', last_task_id: 'victor-rio-123' });
  assert.equal(result.mode, 'CONTEXTUAL_NEXT_STEP');
  assert.equal(result.target, 'rio');
  assert.equal(result.task_id, 'victor-rio-123');
});

test('contextual next step binds to active topic even without task', () => {
  const result = classifyConversationFollowUp('next kya?', { last_target: 'aura3' });
  assert.equal(result.mode, 'CONTEXTUAL_NEXT_STEP');
  assert.equal(result.target, 'aura3');
  assert.equal(result.task_id, null);
});

test('specific evidence-gap follow-up becomes new investigation, not status replay', () => {
  const result = classifyConversationFollowUp(
    'New-design creative: fresh verified evidence unavailable; no absolute claim. Iska pata karo',
    {
      last_target: 'rio',
      last_task_id: 'victor-rio-123',
      last_victor_reply: 'New-design creative: fresh verified evidence unavailable; no absolute claim.',
    },
  );
  assert.equal(result.mode, 'CONTEXTUAL_INVESTIGATION');
  assert.equal(result.target, 'rio');
  assert.equal(result.parent_task_id, 'victor-rio-123');
});

test('generic verify-this on previous evidence gap becomes investigation', () => {
  const result = classifyConversationFollowUp('iska pata karo', {
    last_target: 'rio',
    last_task_id: 'victor-rio-123',
    last_victor_reply: 'New-design creative: fresh verified evidence unavailable; no absolute claim.',
  });
  assert.equal(result.mode, 'CONTEXTUAL_INVESTIGATION');
});

test('investigation task explicitly forbids parent-report replay', () => {
  const text = buildInvestigationTaskText(
    { target: 'rio', parent_task_id: 'parent-1', query: 'iska pata karo' },
    { last_victor_reply: 'fresh verified evidence unavailable' },
  );
  assert.match(text, /Do not merely repeat the parent task report/i);
  assert.match(text, /root cause of the evidence gap/i);
});

test('follow-up without recent context remains unresolved', () => {
  const result = classifyConversationFollowUp('pata karke batao', {});
  assert.equal(result.mode, null);
});

test('pending task message explicitly prevents duplicate dispatch', () => {
  assert.match(formatPendingTaskStatus({ last_target: 'rio', last_task_id: 'task-1' }), /naya duplicate task dispatch nahi karega/i);
});
