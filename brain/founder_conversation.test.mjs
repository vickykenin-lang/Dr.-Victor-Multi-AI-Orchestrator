import test from 'node:test';
import assert from 'node:assert/strict';
import {
  naturalDispatchAcknowledgement,
  naturalInvestigationAcknowledgement,
  naturalPendingReply,
  buildNaturalResultPrompt,
} from './founder_conversation.mjs';

test('Instagram lookup acknowledgement is truthful before dispatch evidence', () => {
  const reply = naturalDispatchAcknowledgement('rio', 'RIO ka latest Instagram post kya hai?');
  assert.match(reply, /request prepare hui hai/i);
  assert.match(reply, /verified result ke bina completion claim nahi/i);
  assert.doesNotMatch(reply, /result milte hi|update dunga|track kar raha hoon/i);
});

test('dispatch acknowledgement distinguishes DISPATCHED from completed', () => {
  const reply = naturalDispatchAcknowledgement('aura3', 'Aura 3 ko check karo', {
    status: 'DISPATCHED',
    taskType: 'STATUS_CHECK',
    taskId: 'victor-aura3-123',
  });
  assert.match(reply, /dispatch accepted/i);
  assert.match(reply, /STATUS_CHECK/);
  assert.match(reply, /victor-aura3-123/);
  assert.match(reply, /result abhi verified\/completed nahi/i);
  assert.doesNotMatch(reply, /result aate hi|update dunga|background/i);
});

test('investigation acknowledgement does not promise future background work', () => {
  const reply = naturalInvestigationAcknowledgement('rio', 'New-design creative ka pata karo');
  assert.match(reply, /fresh evidence check/i);
  assert.doesNotMatch(reply, /result aate hi|update dunga|track kar raha hoon/i);
});

test('pending reply states RESULT_PENDING and rejects background promise', () => {
  const reply = naturalPendingReply('rio');
  assert.match(reply, /RESULT_PENDING/i);
  assert.match(reply, /continuous\/background tracking ka claim nahi/i);
  assert.doesNotMatch(reply, /result aate hi|update dunga/i);
});

test('result prompt requires strict state separation and no background promise', () => {
  const prompt = buildNaturalResultPrompt('rio', 'latest Instagram post?', 'Actually published posts: 7');
  assert.match(prompt, /Lead with the actual answer/i);
  assert.match(prompt, /Do not invent facts/i);
  assert.match(prompt, /DISPATCHED is not RUNNING/i);
  assert.match(prompt, /Never promise a later\/background update/i);
});
