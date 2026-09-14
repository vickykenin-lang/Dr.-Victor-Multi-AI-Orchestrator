import test from 'node:test';
import assert from 'node:assert/strict';
import { assessReplyNaturalness } from './reply_integrity.mjs';

test('rejects unsolicited scripted next-step wrapper', () => {
  const reply = `Sabhi systems mein scripted messages ka check ho gaya hai — 12 posts actually published hain, aur koi error ya blocker nahi hai.\nGOAL_PROGRESS_VERIFIED status hai, aur RIO ka autonomous business cycle properly chal raha hai.\nNote: New-design creative ke liye fresh verified evidence nahi hai.\nNext step: Koi aur high-impact revenue action choose karein`;
  const result = assessReplyNaturalness(reply, 'scripted message check karo');
  assert.equal(result.ok, false);
  assert.ok(result.violations.includes('UNSOLICITED_NEXT_STEP_SECTION'));
  assert.ok(result.violations.includes('UNSOLICITED_ACTION_CTA'));
  assert.ok(result.violations.includes('SCRIPTED_TEMPLATE_SECTION'));
});

test('allows next step when Founder explicitly asks for it', () => {
  const result = assessReplyNaturalness('Next step: Cognee live test run karo.', 'ab next step kya hai?');
  assert.equal(result.ok, true);
});

test('allows concise direct evidence answer', () => {
  const result = assessReplyNaturalness('12 published posts ka fresh evidence available hai; new-design creative ka fresh evidence abhi available nahi hai.', 'RIO ka current result batao');
  assert.equal(result.ok, true);
});

test('rejects unsolicited follow-up offer', () => {
  const result = assessReplyNaturalness('Fresh evidence available nahi hai. Agar aapko status chahiye, main verify karunga.', 'is it verified?');
  assert.equal(result.ok, false);
  assert.ok(result.violations.includes('UNSOLICITED_FOLLOWUP_OFFER'));
});
