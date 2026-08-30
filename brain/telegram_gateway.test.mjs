import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyTelegramBrainIntent,
  shouldForceFiveWhysFromRuntime,
  buildCrossDepartmentSupportPrompt,
} from './telegram_gateway.mjs';

test('complex Founder goal review goes to Brain before department routing', () => {
  const result = classifyTelegramBrainIntent('Victor, RIO ke current revenue goal ko review karo. Same recommendation repeat ho to Brain use karke Five Whys chalao.');
  assert.equal(result.mode, 'EXECUTIVE_GOAL_REVIEW');
});

test('simple department status query remains direct and low-latency', () => {
  const result = classifyTelegramBrainIntent('Tony kya kar rha hai?');
  assert.equal(result.mode, 'LEGACY_DIRECT_STATUS');
});

test('Tony to RIO website support becomes cross-department engineering task', () => {
  const result = classifyTelegramBrainIntent('Tony ko RIO ka website plan banane me help par lagao');
  assert.equal(result.mode, 'CROSS_DEPARTMENT_SUPPORT');
  assert.equal(result.plan.department, 'tony_stark');
  assert.equal(result.plan.beneficiary, 'rio');
});

test('runtime repeat counters force Five Whys immediately before next dispatch', () => {
  assert.equal(shouldForceFiveWhysFromRuntime({ same_recommendation_count: 3 }), true);
  assert.equal(shouldForceFiveWhysFromRuntime({ same_failure_count: 2 }), true);
  assert.equal(shouldForceFiveWhysFromRuntime({ brain_review: { repeat_loop_detected: true } }), true);
  assert.equal(shouldForceFiveWhysFromRuntime({ same_recommendation_count: 1 }), false);
});

test('cross-department prompt produces concrete governed task contract', () => {
  const intent = classifyTelegramBrainIntent('Tony ko RIO ka website plan banane me help par lagao');
  const prompt = buildCrossDepartmentSupportPrompt(intent.plan, 'Tony ko RIO ka website plan banane me help par lagao');
  assert.match(prompt, /CROSS-DEPARTMENT TASK CONTRACT/);
  assert.match(prompt, /website technical architecture/i);
  assert.match(prompt, /Evidence required:/);
  assert.match(prompt, /Next handoff:/);
});
