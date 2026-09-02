import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExecutionPlan, shouldExecuteCrossDepartment } from './execution_plan.mjs';

test('builds ordered cross-department action plan without collapsing target', () => {
  const plan = buildExecutionPlan({
    raw_text: 'RIO ko recover karo aur Tony ko website fix karne bolo, AURA3 ko verify karvao',
    entities: ['rio', 'tony_stark', 'aura3'],
    requested_actions: ['repair', 'execute', 'verify'],
    success_condition: 'FOUNDER_INTENT_SATISFIED',
  });
  assert.equal(plan.mode, 'CROSS_DEPARTMENT_ACTION');
  assert.deepEqual(plan.steps.map(x => x.target), ['rio', 'tony_stark', 'aura3']);
  assert.equal(plan.steps.length, 3);
  assert.equal(shouldExecuteCrossDepartment(plan), true);
});

test('single target remains single-department and does not trigger cross execution', () => {
  const plan = buildExecutionPlan({ entities: ['rio'], requested_actions: ['repair'] });
  assert.equal(plan.mode, 'SINGLE_DEPARTMENT_ACTION');
  assert.equal(shouldExecuteCrossDepartment(plan), false);
});

test('Founder boundary suppresses automatic cross-department execution', () => {
  const plan = buildExecutionPlan({
    entities: ['rio', 'tony_stark'],
    requested_actions: ['execute'],
    founder_boundary: 'EXPLICIT_FOUNDER_DIRECTION',
  });
  assert.equal(plan.cross_department, true);
  assert.equal(shouldExecuteCrossDepartment(plan), false);
});
