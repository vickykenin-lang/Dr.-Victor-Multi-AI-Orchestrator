import test from 'node:test';
import assert from 'node:assert/strict';
import {
  naturalDispatchAcknowledgement,
  naturalInvestigationAcknowledgement,
  naturalPendingReply,
  buildNaturalResultPrompt,
} from './founder_conversation.mjs';

test('Instagram lookup acknowledgement is natural and hides task IDs', () => {
  const reply = naturalDispatchAcknowledgement('rio', 'RIO ka latest Instagram post kya hai?');
  assert.match(reply, /latest actually published Instagram post/i);
  assert.doesNotMatch(reply, /task id/i);
});

test('investigation acknowledgement does not expose orchestration metadata', () => {
  const reply = naturalInvestigationAcknowledgement('rio', 'New-design creative ka pata karo');
  assert.match(reply, /specifically verify/i);
  assert.doesNotMatch(reply, /parent task|investigation task|task id/i);
});

test('pending reply is conversational and duplicate-safe', () => {
  const reply = naturalPendingReply('rio');
  assert.match(reply, /pending/i);
  assert.match(reply, /duplicate task create nahi/i);
  assert.doesNotMatch(reply, /victor-rio-/i);
});

test('result prompt requires answer-first natural synthesis without evidence inflation', () => {
  const prompt = buildNaturalResultPrompt('rio', 'latest Instagram post?', 'Actually published posts: 7');
  assert.match(prompt, /Lead with the actual answer/i);
  assert.match(prompt, /Do not invent facts/i);
  assert.match(prompt, /READY_TO_POST is not PUBLISHED/i);
  assert.match(prompt, /Do not expose internal task IDs/i);
});
