import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFounderIntent, FOUNDER_INTENT, mayCreateExecutionContract } from './founder_intent_gateway.mjs';

test('joke/chat remains conversational and does not dispatch', () => {
  const r = classifyFounderIntent('Dark humor sunao');
  assert.equal(r.intent, FOUNDER_INTENT.CHAT);
  assert.equal(r.execution_allowed, false);
  assert.equal(mayCreateExecutionContract(r), false);
});

test('where did that joke come from is a question, not execution', () => {
  const r = classifyFounderIntent('Ye joke tumhe kaha mila?');
  assert.equal(r.intent, FOUNDER_INTENT.QUESTION);
  assert.equal(r.execution_allowed, false);
});

test('LLM connectivity question is a question, not department work', () => {
  const r = classifyFounderIntent('Founder ke taur par batao koi LLM connected hai?');
  assert.equal(r.intent, FOUNDER_INTENT.QUESTION);
  assert.equal(r.execution_allowed, false);
});

test('LLM test question is system test, not RIO execution', () => {
  const r = classifyFounderIntent('LLM kese test karoge?');
  assert.equal(r.intent, FOUNDER_INTENT.SYSTEM_TEST);
  assert.equal(r.execution_allowed, false);
  assert.notEqual(r.target, 'rio');
});

test('I want to test you is SYSTEM_TEST', () => {
  const r = classifyFounderIntent('I want to test you');
  assert.equal(r.intent, FOUNDER_INTENT.SYSTEM_TEST);
  assert.equal(r.execution_allowed, false);
});

test('Founder RIO stop overrides routing and forbids execution', () => {
  const r = classifyFounderIntent('Rio par kaam band karo', { active_target: 'rio' });
  assert.equal(r.intent, FOUNDER_INTENT.STOP_PAUSE);
  assert.equal(r.target, 'rio');
  assert.equal(r.requires_deterministic_stop, true);
  assert.equal(r.execution_allowed, false);
  assert.equal(mayCreateExecutionContract(r), false);
});

test('repeated Founder correction remains STOP', () => {
  const r = classifyFounderIntent('Mene kaha Rio par kaam close karo', { active_target: 'rio' });
  assert.equal(r.intent, FOUNDER_INTENT.STOP_PAUSE);
  assert.equal(r.target, 'rio');
  assert.equal(r.execution_allowed, false);
});

test('explicit execute command may create execution contract', () => {
  const r = classifyFounderIntent('Victor execute block 2');
  assert.equal(r.intent, FOUNDER_INTENT.EXECUTION_COMMAND);
  assert.equal(r.execution_allowed, true);
  assert.equal(mayCreateExecutionContract(r), true);
});
