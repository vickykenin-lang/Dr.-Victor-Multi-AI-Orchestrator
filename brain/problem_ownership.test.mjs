import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyOwnedProblem, buildOwnedProblemPrompt } from './problem_ownership.mjs';

test('RIO Instagram delay becomes owned recovery problem', () => {
  const result = classifyOwnedProblem('RIO ka Instagram post abhi tak kyu develop nahi hua? jo issue hai khud fix karo aur publish karvao');
  assert.equal(result.matched, true);
  assert.equal(result.target, 'rio');
  assert.equal(result.mode, 'OWNED_PROBLEM_RECOVERY');
});

test('plain RIO status question is not automatically converted to recovery', () => {
  const result = classifyOwnedProblem('RIO ka status batao');
  assert.equal(result.matched, false);
});

test('owned recovery prompt requires fix-and-continue instead of report-only', () => {
  const prompt = buildOwnedProblemPrompt('rio', 'post kyu nahi hua, fix karo');
  assert.match(prompt, /own the problem to the verified outcome/i);
  assert.match(prompt, /do not stop at diagnosis/i);
  assert.match(prompt, /requires_follow_up=true/i);
});
