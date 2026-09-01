import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyHulkRequest, hulkActionBlockedReply, hulkStatusReply, isCasualWellbeing } from './hulk_guard.mjs';

test('HULK action is never eligible to fall through to RIO routing', () => {
  const result = classifyHulkRequest('Hulk ko push karo or result ready karvao');
  assert.equal(result.matched, true);
  assert.equal(result.mode, 'HULK_ACTION');
  assert.equal(result.target, 'hulk');
});

test('HULK research question is status, not fabricated no-work claim', () => {
  const result = classifyHulkRequest('Hulk ne kya research kiya abhi tak?');
  assert.equal(result.mode, 'HULK_STATUS');
  assert.match(hulkStatusReply(), /fresh verified research evidence/i);
});

test('HULK action failure explains bridge instead of routing another department', () => {
  const reply = hulkActionBlockedReply();
  assert.match(reply, /RIO ko route nahi karunga/i);
  assert.match(reply, /NOT_VERIFIED/i);
});

test('casual wellbeing does not trigger system status narration', () => {
  assert.equal(isCasualWellbeing('Kya haal hai'), true);
});
