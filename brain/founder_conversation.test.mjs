import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REASONING_INJECTION_VERSION,
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

test('result prompt injects bounded reasoning without exposing chain-of-thought', () => {
  const prompt = buildNaturalResultPrompt('rio', 'latest Instagram post?', 'Actually published posts: 7');
  assert.equal(REASONING_INJECTION_VERSION, 'VICTOR_REASONING_INJECTION_V1');
  assert.match(prompt, /VICTOR_REASONING_INJECTION_V1/);
  assert.match(prompt, /silently reason through four checks/i);
  assert.match(prompt, /what the Founder is actually asking now/i);
  assert.match(prompt, /verified facts versus unknown\/inferred/i);
  assert.match(prompt, /DISPATCHED, RESULT_PENDING, RESULT_RECEIVED, VERIFIED, or COMPLETED/i);
  assert.match(prompt, /Do not reveal chain-of-thought/i);
  assert.match(prompt, /Prefer using an existing verified result/i);
  assert.match(prompt, /DISPATCHED is not RUNNING/i);
  assert.match(prompt, /Never promise a later\/background update/i);
});
