import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyConversationFollowUp, formatPendingTaskStatus } from './conversation_runtime.mjs';

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

test('follow-up without recent context remains unresolved', () => {
  const result = classifyConversationFollowUp('pata karke batao', {});
  assert.equal(result.mode, null);
});

test('pending task message explicitly prevents duplicate dispatch', () => {
  assert.match(formatPendingTaskStatus({ last_target: 'rio', last_task_id: 'task-1' }), /naya duplicate task dispatch nahi karega/i);
});
