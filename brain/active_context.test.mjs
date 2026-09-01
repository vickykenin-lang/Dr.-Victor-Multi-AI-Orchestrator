import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectExplicitTarget,
  inferThreadTopic,
  buildActiveContext,
  appendRecentTurn,
  formatActiveContextForPrompt,
} from './active_context.mjs';

test('explicit RIO mention binds active target', () => {
  assert.equal(detectExplicitTarget('RIO abhi kaha atka hua hai?'), 'rio');
});

test('short follow-up preserves current thread', () => {
  const topic = inferThreadTopic('pata karke batao', { active_topic: 'RIO_STATUS_OR_BLOCKER', active_target: 'rio' });
  assert.equal(topic, 'RIO_STATUS_OR_BLOCKER');
});

test('working context keeps target and active issue', () => {
  const next = buildActiveContext(
    { last_target: 'rio', last_task_id: 'task-123', active_topic: 'RIO_STATUS_OR_BLOCKER' },
    { founderText: 'iska status kab pata chalega?' },
  );
  assert.equal(next.active_target, 'rio');
  assert.equal(next.active_task_id, 'task-123');
  assert.match(next.unresolved_question, /status/);
});

test('operating direction remains a topic rather than revenue execution', () => {
  const next = buildActiveContext({}, { founderText: 'sirf kaam par dhyan do payment par nahi' });
  assert.equal(next.active_topic, 'FOUNDER_OPERATING_DIRECTION');
});

test('recent turns are bounded to ten', () => {
  let session = {};
  for (let i = 0; i < 12; i += 1) session = appendRecentTurn(session, i % 2 ? 'victor' : 'founder', `turn-${i}`);
  assert.equal(session.recent_turns.length, 10);
  assert.equal(session.recent_turns[0].text, 'turn-2');
});

test('prompt exposes active topic, task and latest turns', () => {
  const session = appendRecentTurn({ active_topic: 'RIO_STATUS_OR_BLOCKER', active_target: 'rio', last_task_id: 'task-9' }, 'founder', 'pata karke batao');
  const prompt = formatActiveContextForPrompt(session);
  assert.match(prompt, /RIO_STATUS_OR_BLOCKER/);
  assert.match(prompt, /task-9/);
  assert.match(prompt, /pata karke batao/);
});
