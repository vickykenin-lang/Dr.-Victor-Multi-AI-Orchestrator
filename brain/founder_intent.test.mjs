import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFounderIntent, founderDirectionReply, clarificationFallback } from './founder_intent.mjs';

test('operations focus with payment deprioritization is Founder direction, not executive goal execution', () => {
  const result = resolveFounderIntent("I don't want any payment. You just focus on operation");
  assert.equal(result.mode, 'FOUNDER_DIRECTION');
  assert.equal(result.objective_change_explicit, false);
});

test('short question marks use reply context as clarification', () => {
  const result = resolveFounderIntent('??', 'Victor previous reply');
  assert.equal(result.mode, 'CLARIFICATION');
  assert.equal(result.reason, 'SHORT_CLARIFICATION_WITH_REPLY_CONTEXT');
});

test('explicit objective change stays separate from operating priority', () => {
  const result = resolveFounderIntent('Change objective and focus on operations');
  assert.equal(result.mode, 'OBJECTIVE_CHANGE_REQUEST');
  assert.equal(result.objective_change_explicit, true);
});

test('direction acknowledgement does not claim locked goal changed', () => {
  assert.match(founderDirectionReply(), /silently replace nahi kiya gaya/i);
});

test('clarification without context asks for the previous reply, not a greeting', () => {
  assert.doesNotMatch(clarificationFallback(''), /Victor online|Hey there|personal AI assistant/i);
});
