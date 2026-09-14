import test from 'node:test';
import assert from 'node:assert/strict';
import { detectDeadEndLoop, isFounderOnlyDependency, isUnresolvedVictorReply, buildDeadEndRecoveryPrompt } from './anti_bogus_runtime.mjs';

test('detects unresolved Victor reply and escalates instead of repeating', () => {
  const session = {
    active_target: 'aura3',
    last_victor_reply: 'Fresh status verify nahi hua. Exact result clear nahi hai.',
    recent_turns: [
      { role: 'victor', text: 'Fresh status verify nahi hua. Exact result clear nahi hai.' },
    ],
  };
  const result = detectDeadEndLoop('check karo aur fix karo', session);
  assert.equal(result.matched, true);
  assert.equal(result.target, 'aura3');
  assert.match(buildDeadEndRecoveryPrompt(result, 'check karo aur fix karo'), /Do not repeat/i);
});

test('Founder-only dependency is not auto-retried', () => {
  const session = {
    active_target: 'rio',
    last_victor_reply: 'Credential permission required. Founder approval required.',
    recent_turns: [{ role: 'victor', text: 'Credential permission required. Founder approval required.' }],
  };
  const result = detectDeadEndLoop('retry karo', session);
  assert.equal(result.matched, false);
  assert.equal(result.founder_only, true);
  assert.equal(isFounderOnlyDependency(session.last_victor_reply), true);
});

test('recognizes unresolved replies', () => {
  assert.equal(isUnresolvedVictorReply('Fresh evidence available nahi hai; verify nahi hua.'), true);
  assert.equal(isUnresolvedVictorReply('Deployment live verified with fresh evidence.'), false);
});
