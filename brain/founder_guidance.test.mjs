import test from 'node:test';
import assert from 'node:assert/strict';

import {
  founderGuidanceCapability,
  buildFounderGuidanceRequest,
  persistFounderGuidanceRequest,
  attachFounderGuidanceMessage,
  readActiveFounderGuidance,
  shouldTreatAsFounderGuidanceAnswer,
  recordFounderGuidanceAnswer,
  founderGuidanceContext,
  consumeFounderGuidance,
  formatFounderGuidanceQuestion,
} from './founder_guidance.mjs';

function fakeEnv() {
  const data = new Map();
  return {
    __data: data,
    VICTOR_CONVERSATION_STATE: {
      async get(key, options = {}) {
        const value = data.get(key);
        if (value == null) return null;
        if (options?.type === 'json') return JSON.parse(value);
        return value;
      },
      async put(key, value) { data.set(key, value); },
    },
  };
}

const goal = {
  goal_id: 'ORG-REVENUE-001',
  objective: 'Generate verified real affiliate commercial revenue.',
};

const reasonedPlan = {
  strategy_summary: 'Two valid commercial priority policies conflict after bounded investigation.',
  needs_founder_guidance: true,
  founder_question: 'When landed cost remains within the locked ceiling, should verified conversion evidence outrank margin?',
  unknowns: ['Priority between conversion evidence and margin is not defined.'],
  evidence_needed: ['Founder priority rule'],
};

const runtimeGoal = {
  recovery_generation: 3,
  last_status: 'NO_PROGRESS',
  last_root_cause: 'POLICY_PRECEDENCE_UNDEFINED',
  last_progress_delta: { reason: 'NO_POLICY_PRECEDENCE' },
  evidence: ['conversion-test.json', 'margin-analysis.json'],
};

test('guidance storage requires durable binding', () => {
  assert.equal(founderGuidanceCapability({}).available, false);
  assert.equal(founderGuidanceCapability(fakeEnv()).available, true);
});

test('builds one precise scoped guidance request after bounded investigation', () => {
  const request = buildFounderGuidanceRequest({ goal, reasonedPlan, runtimeGoal });
  assert.equal(request.status, 'PENDING');
  assert.equal(request.goal_id, 'ORG-REVENUE-001');
  assert.equal(request.provenance, 'INFERRED_REQUEST');
  assert.match(request.exact_question, /conversion evidence outrank margin/i);
  assert.ok(request.checked.some(item => item.includes('POLICY_PRECEDENCE_UNDEFINED')));
  assert.equal(request.generation, 4);
});

test('request without precise guidance question is rejected', () => {
  assert.throws(
    () => buildFounderGuidanceRequest({ goal, reasonedPlan: { needs_founder_guidance: true }, runtimeGoal }),
    error => error.code === 'FOUNDER_GUIDANCE_QUESTION_REQUIRED',
  );
});

test('duplicate same pending question is not re-created', async () => {
  const env = fakeEnv();
  const request = buildFounderGuidanceRequest({ goal, reasonedPlan, runtimeGoal });
  const first = await persistFounderGuidanceRequest(env, request);
  const second = await persistFounderGuidanceRequest(env, request);
  assert.equal(first.status, 'PERSISTED');
  assert.equal(second.status, 'ALREADY_PENDING');
  assert.equal(second.record.guidance_id, first.record.guidance_id);
});

test('guidance answer is accepted only by reply binding or explicit Guidance prefix', async () => {
  const env = fakeEnv();
  const request = buildFounderGuidanceRequest({ goal, reasonedPlan, runtimeGoal });
  await persistFounderGuidanceRequest(env, request);
  const bound = await attachFounderGuidanceMessage(env, goal.goal_id, 901);
  const pending = bound.record;

  assert.equal(shouldTreatAsFounderGuidanceAnswer('hello', { message_id: 1 }, pending), false);
  assert.equal(shouldTreatAsFounderGuidanceAnswer('conversion ko priority do', { reply_to_message: { message_id: 901 } }, pending), true);
  assert.equal(shouldTreatAsFounderGuidanceAnswer('Guidance: conversion ko priority do', {}, pending), true);
});

test('Founder answer is stored with FOUNDER_CONFIRMED provenance and can be consumed once applied', async () => {
  const env = fakeEnv();
  const request = buildFounderGuidanceRequest({ goal, reasonedPlan, runtimeGoal });
  await persistFounderGuidanceRequest(env, request);
  await attachFounderGuidanceMessage(env, goal.goal_id, 901);
  const pending = await readActiveFounderGuidance(env);

  const answered = await recordFounderGuidanceAnswer(
    env,
    pending,
    'Guidance: conversion evidence ko priority do jab landed-cost ceiling satisfy ho.',
    { chatId: '123', messageId: 902 },
  );
  assert.equal(answered.status, 'ANSWERED');
  assert.equal(answered.record.provenance, 'FOUNDER_CONFIRMED');
  assert.match(answered.record.answer, /conversion evidence ko priority do/i);

  const context = founderGuidanceContext(answered.record);
  assert.equal(context.provenance, 'FOUNDER_CONFIRMED');
  assert.equal(context.scope, 'GOAL');

  const consumed = await consumeFounderGuidance(env, goal.goal_id, { actionId: 'action-1', strategySummary: 'apply guidance' });
  assert.equal(consumed.status, 'CONSUMED');
  assert.equal(consumed.record.consumed_by_action_id, 'action-1');
});

test('Founder question format contains checked evidence and exact question', () => {
  const request = buildFounderGuidanceRequest({ goal, reasonedPlan, runtimeGoal });
  const text = formatFounderGuidanceQuestion(request);
  assert.match(text, /Checked:/);
  assert.match(text, /Question:/);
  assert.match(text, /Guidance:/);
});
