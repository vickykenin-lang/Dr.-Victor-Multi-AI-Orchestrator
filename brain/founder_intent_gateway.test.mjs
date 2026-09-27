import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyFounderIntent,
  FOUNDER_INTENT,
  mayCreateExecutionContract,
  temporaryLlmAuthorityStatus,
  TEMPORARY_LLM_AUTHORITY,
} from './founder_intent_gateway.mjs';

test('joke/chat remains conversational and does not dispatch', () => {
  const r = classifyFounderIntent('Dark humor sunao', { now_utc: '2026-09-28T00:00:00Z' });
  assert.equal(r.intent, FOUNDER_INTENT.CHAT);
  assert.equal(r.execution_allowed, false);
  assert.equal(mayCreateExecutionContract(r), false);
});

test('where did that joke come from is a question, not execution', () => {
  const r = classifyFounderIntent('Ye joke tumhe kaha mila?', { now_utc: '2026-09-28T00:00:00Z' });
  assert.equal(r.intent, FOUNDER_INTENT.QUESTION);
  assert.equal(r.execution_allowed, false);
});

test('LLM connectivity question is a question, not department work', () => {
  const r = classifyFounderIntent('Founder ke taur par batao koi LLM connected hai?', { now_utc: '2026-09-28T00:00:00Z' });
  assert.equal(r.intent, FOUNDER_INTENT.QUESTION);
  assert.equal(r.execution_allowed, false);
});

test('LLM test question is system test, not RIO execution', () => {
  const r = classifyFounderIntent('LLM kese test karoge?', { now_utc: '2026-09-28T00:00:00Z' });
  assert.equal(r.intent, FOUNDER_INTENT.SYSTEM_TEST);
  assert.equal(r.execution_allowed, false);
  assert.notEqual(r.target, 'rio');
});

test('I want to test you is SYSTEM_TEST', () => {
  const r = classifyFounderIntent('I want to test you', { now_utc: '2026-09-28T00:00:00Z' });
  assert.equal(r.intent, FOUNDER_INTENT.SYSTEM_TEST);
  assert.equal(r.execution_allowed, false);
});

test('Founder RIO stop overrides routing and forbids execution', () => {
  const r = classifyFounderIntent('Rio par kaam band karo', { active_target: 'rio', now_utc: '2026-09-28T00:00:00Z' });
  assert.equal(r.intent, FOUNDER_INTENT.STOP_PAUSE);
  assert.equal(r.target, 'rio');
  assert.equal(r.requires_deterministic_stop, true);
  assert.equal(r.execution_allowed, false);
  assert.equal(mayCreateExecutionContract(r), false);
});

test('repeated Founder correction remains STOP', () => {
  const r = classifyFounderIntent('Mene kaha Rio par kaam close karo', { active_target: 'rio', now_utc: '2026-09-28T00:00:00Z' });
  assert.equal(r.intent, FOUNDER_INTENT.STOP_PAUSE);
  assert.equal(r.target, 'rio');
  assert.equal(r.execution_allowed, false);
});

test('explicit execute command may create execution contract', () => {
  const r = classifyFounderIntent('Victor execute block 2', { now_utc: '2026-09-28T00:00:00Z' });
  assert.equal(r.intent, FOUNDER_INTENT.EXECUTION_COMMAND);
  assert.equal(r.execution_allowed, true);
  assert.equal(mayCreateExecutionContract(r), true);
});

test('30-day authority window is active and requires Founder approval for extension', () => {
  const s = temporaryLlmAuthorityStatus(Date.parse('2026-10-10T00:00:00Z'));
  assert.equal(s.active, true);
  assert.equal(s.extension_requires_explicit_founder_approval, true);
  assert.equal(s.ends_at_utc, TEMPORARY_LLM_AUTHORITY.ends_at_utc);
});

test('natural reminder command is executable during Bedrock authority window', () => {
  const r = classifyFounderIntent('Mujhe kal subah 7 baje office jana hai, msg bhej kar remind karva dena', {
    now_utc: '2026-09-28T00:00:00Z',
  });
  assert.equal(r.intent, FOUNDER_INTENT.EXECUTION_COMMAND);
  assert.equal(r.execution_allowed, true);
  assert.equal(r.temporary_llm_authority, true);
  assert.equal(r.reason, 'TEMPORARY_BEDROCK_AUTHORITY_NATURAL_IMPERATIVE');
});

test('natural check command is executable during authority window', () => {
  const r = classifyFounderIntent('Aura 3 ko check karo', { now_utc: '2026-09-28T00:00:00Z' });
  assert.equal(r.intent, FOUNDER_INTENT.EXECUTION_COMMAND);
  assert.equal(r.execution_allowed, true);
});

test('natural imperative stops receiving temporary authority after 30 days', () => {
  const r = classifyFounderIntent('Aura 3 ko check karo', { now_utc: '2026-10-28T00:00:00Z' });
  assert.equal(r.intent, FOUNDER_INTENT.CHAT);
  assert.equal(r.execution_allowed, false);
  assert.equal(r.reason, 'TEMPORARY_BEDROCK_AUTHORITY_EXPIRED_EXTENSION_REQUIRES_FOUNDER_APPROVAL');
});

test('question wording remains non-execution even inside temporary authority window', () => {
  const r = classifyFounderIntent('Kya tum mujhe kal remind kar sakte ho?', { now_utc: '2026-09-28T00:00:00Z' });
  assert.equal(r.intent, FOUNDER_INTENT.QUESTION);
  assert.equal(r.execution_allowed, false);
});
