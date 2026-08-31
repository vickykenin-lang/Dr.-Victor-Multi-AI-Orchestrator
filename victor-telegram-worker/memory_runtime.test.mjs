import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeFounderDecisions,
  buildMemoryContext,
  isExplicitMemoryDirective,
  recallMemory,
  resolveFounderEntityQuery,
} from './memory_runtime.mjs';

const sources = [
  {
    name: 'FOUNDER_MEMORY', ok: true,
    text: JSON.stringify({ communication: { telegram: { formatting: 'simple', bold: false, emphasis: 'inverted_commas' } } }),
  },
  {
    name: 'DECISIONS', ok: true,
    text: [
      JSON.stringify({ type: 'founder_directive', status: 'active', text: 'Telegram formatting simple rakho, bold mat karo.' }),
      JSON.stringify({ id: 'aura-alias', type: 'founder_locked_decision', status: 'active', priority: 'critical', summary: 'Bare AURA means AURA3; only explicit AURA2 means AURA2.' }),
      JSON.stringify({ id: 'aura2-hold', type: 'founder_locked_decision', status: 'active', priority: 'critical', summary: 'AURA2 is HOLD until Founder changes it.' }),
      JSON.stringify({ id: 'old-rule', type: 'founder_locked_decision', status: 'superseded', summary: 'AURA2 is active.' }),
    ].join('\n'),
  },
  {
    name: 'OPERATIONAL_MEMORY', ok: true,
    text: JSON.stringify({ event: 'drive_sync', status: 'PASS' }),
  },
];

test('detects explicit Founder memory directives including record karo', () => {
  assert.equal(isExplicitMemoryDirective('Filhal k liye lock karo'), true);
  assert.equal(isExplicitMemoryDirective('Isko yaad rakho'), true);
  assert.equal(isExplicitMemoryDirective('record karo- aura 2 hold me rakho'), true);
  assert.equal(isExplicitMemoryDirective('Save this decision'), true);
  assert.equal(isExplicitMemoryDirective('Status batao'), false);
  assert.equal(isExplicitMemoryDirective('Final reply me verified root cause aur next action do'), false);
  assert.equal(isExplicitMemoryDirective('AURA3 final certification evidence ke saath do'), false);
  assert.equal(isExplicitMemoryDirective('Record status aur exact next action batao'), false);
});

test('bare AURA deterministically resolves to AURA3', () => {
  assert.equal(resolveFounderEntityQuery('aura ka status kya hai').entity_id, 'aura3');
});

test('explicit AURA2 resolves to AURA2', () => {
  assert.equal(resolveFounderEntityQuery('aura 2 ka status batao').entity_id, 'aura2');
});

test('Tony, HULK and Vision resolve deterministically', () => {
  assert.equal(resolveFounderEntityQuery('Tony onboarding status check karo').entity_id, 'tony_stark');
  assert.equal(resolveFounderEntityQuery('Hulk kya kar raha hai').entity_id, 'hulk');
  assert.equal(resolveFounderEntityQuery('Vision ka status').entity_id, 'vision');
});

test('active Founder decisions exclude superseded rules', () => {
  const active = activeFounderDecisions(sources);
  assert.ok(active.some(x => x.id === 'aura2-hold'));
  assert.ok(!active.some(x => x.id === 'old-rule'));
});

test('recalls relevant communication memory', () => {
  const result = recallMemory('Telegram formatting bold kaise karna hai?', sources, 3);
  assert.ok(result.length >= 1);
  assert.match(JSON.stringify(result), /telegram|bold|format/i);
});

test('memory context keeps active Founder decisions globally available', () => {
  const result = buildMemoryContext('weather in Delhi', sources, 3);
  assert.equal(result.memories.length, 0);
  assert.ok(result.activeFounderDecisions.some(x => x.id === 'aura2-hold'));
  assert.match(result.prompt, /ACTIVE FOUNDER DECISIONS/i);
});
