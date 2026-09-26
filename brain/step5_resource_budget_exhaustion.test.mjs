import test from 'node:test';
import assert from 'node:assert/strict';
import { createSandboxSpec, evaluateSandboxBudget } from './sandbox_manager.mjs';
import { runShadowAutonomy } from './shadow_autonomy_runtime.mjs';

test('Step 5.1 runtime and retry ceilings are bounded and exhaustion fails closed', () => {
  const spec = createSandboxSpec({
    objective_id: 'OBJ-S5', action_id: 'ACT-1', budgets: { runtime_seconds: 10, retry_count: 1 },
  });
  const result = evaluateSandboxBudget({ spec, usage: { runtime_seconds: 11, retry_count: 2 } });
  assert.equal(result.allowed, false);
  assert.equal(result.safe_hold, true);
  assert.equal(result.continuation_allowed, false);
  assert.deepEqual(result.exceeded, ['RUNTIME', 'RETRIES']);
});

test('Step 5.2 CPU memory PID and storage ceilings are explicit and independently enforced', () => {
  const spec = createSandboxSpec({
    objective_id: 'OBJ-S5', action_id: 'ACT-2',
    budgets: { cpu_seconds: 10, memory_mb: 128, pid_count: 4, storage_mb: 32 },
  });
  const result = evaluateSandboxBudget({
    spec,
    usage: { cpu_seconds: 11, memory_mb: 129, pid_count: 5, storage_mb: 33 },
  });
  assert.equal(result.safe_hold, true);
  assert.deepEqual(result.exceeded, ['CPU', 'MEMORY', 'PIDS', 'STORAGE']);
});

test('Step 5.3 network egress API/external calls and spend ceilings are enforced', () => {
  const spec = createSandboxSpec({
    objective_id: 'OBJ-S5', action_id: 'ACT-3',
    budgets: { network_egress_mb: 2, external_calls: 2, api_calls: 3, spend_units: 5 },
  });
  const result = evaluateSandboxBudget({
    spec,
    usage: { network_egress_mb: 3, external_calls: 3, api_calls: 4, spend_units: 6 },
  });
  assert.equal(result.safe_hold, true);
  assert.deepEqual(result.exceeded, ['NETWORK_EGRESS', 'EXTERNAL_CALLS', 'API_CALLS', 'SPEND']);
});

test('Step 5.4 configured ceilings are hard-clamped and exact-boundary usage remains allowed', () => {
  const spec = createSandboxSpec({
    objective_id: 'OBJ-S5', action_id: 'ACT-4',
    budgets: {
      runtime_seconds: 99999, retry_count: 999, cpu_seconds: 99999, memory_mb: 99999,
      pid_count: 99999, storage_mb: 99999, network_egress_mb: 99999,
      external_calls: 99999, api_calls: 99999, spend_units: 99999,
    },
  });
  assert.deepEqual(spec.budgets, {
    runtime_seconds: 3600,
    retry_count: 10,
    cpu_seconds: 1800,
    memory_mb: 4096,
    pid_count: 512,
    storage_mb: 4096,
    network_egress_mb: 1024,
    external_calls: 200,
    api_calls: 200,
    spend_units: 1000,
  });
  const result = evaluateSandboxBudget({ spec, usage: { ...spec.budgets } });
  assert.equal(result.allowed, true);
  assert.equal(result.continuation_allowed, true);
});

test('Step 5.5 exhaustion blocks new dispatch and retains an evidence receipt', () => {
  const result = runShadowAutonomy({
    founder_text: 'Victor execute block 5',
    objective_id: 'OBJ-S5',
    action_id: 'ACT-5',
    budget_usage: { memory_mb: 513 },
    now_utc: '2026-09-26T09:10:00Z',
  });
  assert.equal(result.decision, 'SAFE_HOLD');
  assert.equal(result.reason, 'RESOURCE_BUDGET_SAFE_HOLD');
  assert.equal(result.department_dispatch_allowed, false);
  assert.equal(result.production_apply_allowed, false);
  assert.equal(result.continuation_allowed, false);
  assert.equal(result.budget.safe_hold, true);
  assert.equal(result.sandbox_receipt.status, 'SAFE_HOLD_BUDGET_EXCEEDED');
  assert.ok(result.sandbox_receipt.evidence_refs.includes('budget:MEMORY'));
  assert.equal(result.sandbox_receipt.production_applied, false);
});

test('Step 5.6 multi-limit exhaustion cannot continue uncontrolled and records every exceeded class', () => {
  const result = runShadowAutonomy({
    founder_text: 'Victor execute block 5',
    objective_id: 'OBJ-S5',
    action_id: 'ACT-6',
    budget_usage: {
      runtime_seconds: 901,
      retry_count: 4,
      cpu_seconds: 301,
      memory_mb: 513,
      pid_count: 65,
      storage_mb: 513,
      network_egress_mb: 1,
      external_calls: 26,
      api_calls: 26,
      spend_units: 1,
    },
    now_utc: '2026-09-26T09:10:00Z',
  });
  assert.equal(result.decision, 'SAFE_HOLD');
  assert.equal(result.continuation_allowed, false);
  assert.equal(result.department_dispatch_allowed, false);
  assert.equal(result.production_apply_allowed, false);
  assert.deepEqual(result.budget.exceeded, [
    'RUNTIME', 'RETRIES', 'CPU', 'MEMORY', 'PIDS', 'STORAGE',
    'NETWORK_EGRESS', 'EXTERNAL_CALLS', 'API_CALLS', 'SPEND',
  ]);
  for (const key of result.budget.exceeded) {
    assert.ok(result.sandbox_receipt.evidence_refs.includes(`budget:${key}`));
  }
});
