import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFactRequest } from './fact_runtime.mjs';

test('exact RIO heartbeat timestamp is fact query', () => {
  const q = classifyFactRequest('data/rio_work_status.json se last successful heartbeat ka exact timestamp batao');
  assert.equal(q.matched, true);
  assert.equal(q.asksHeartbeat, true);
  assert.ok(q.targets.includes('rio'));
});

test('heartbeat count request is detected', () => {
  const q = classifyFactRequest('total kitne heartbeat cycles fail hue aur kitne complete hue exact number batao');
  assert.equal(q.matched, true);
  assert.equal(q.asksCounts, true);
});

test('AURA3 last commit request targets AURA3', () => {
  const q = classifyFactRequest('AURA3 GitHub repo ka last commit activity date batao');
  assert.equal(q.asksCommit, true);
  assert.ok(q.targets.includes('aura3'));
});

test('multi-target question preserves all named departments', () => {
  const q = classifyFactRequest('Tony ka last commit aur AURA3 repo ka last activity date exact batao');
  assert.ok(q.targets.includes('tony_stark'));
  assert.ok(q.targets.includes('aura3'));
});

test('Instagram pause truth is evidence query', () => {
  const q = classifyFactRequest('RIO Instagram auto-publish abhi paused hai ya enabled? exact current setting batao');
  assert.equal(q.asksPause, true);
  assert.ok(q.targets.includes('rio'));
});
