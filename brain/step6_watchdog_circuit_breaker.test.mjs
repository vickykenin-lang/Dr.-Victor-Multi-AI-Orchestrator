import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateWatchdog, watchdogOverridesVictor } from './safety_watchdog.mjs';
import { runShadowAutonomy } from './shadow_autonomy_runtime.mjs';

const HEALTHY = { watchdog_available: true, watchdog_healthy: true, heartbeat_age_seconds: 5 };

test('Step 6.1 healthy independent watchdog permits bounded continuation', () => {
  const wd = evaluateWatchdog({ ...HEALTHY, semantic_no_progress_count: 0, transient_retry_count: 0 });
  assert.equal(wd.decision, 'CONTINUE_BOUNDED');
  assert.equal(wd.allow_new_execution, true);
  assert.deepEqual(wd.triggers, []);
});

test('Step 6.2 unsafe and semantic no-progress execution trips circuit breaker', () => {
  const wd = evaluateWatchdog({
    ...HEALTHY,
    semantic_no_progress_count: 3,
    unexpected_external_side_effect: true,
    verification_failed_after_change: true,
  });
  assert.equal(wd.decision, 'SAFE_HOLD');
  assert.equal(wd.allow_new_execution, false);
  assert.ok(wd.triggers.includes('SEMANTIC_NO_PROGRESS_LIMIT'));
  assert.ok(wd.triggers.includes('UNEXPECTED_EXTERNAL_SIDE_EFFECT'));
  assert.ok(wd.triggers.includes('POST_CHANGE_VERIFICATION_FAILED'));
  const effective = watchdogOverridesVictor('CONTINUE', wd);
  assert.equal(effective.effective_decision, 'SAFE_HOLD');
  assert.equal(effective.authority, 'INDEPENDENT_WATCHDOG');
});

test('Step 6.3 unavailable watchdog fails closed', () => {
  const wd = evaluateWatchdog({ watchdog_available: false });
  assert.equal(wd.decision, 'SAFE_HOLD');
  assert.equal(wd.allow_new_execution, false);
  assert.ok(wd.triggers.includes('WATCHDOG_UNAVAILABLE'));
});

test('Step 6.4 unhealthy, missing-heartbeat and stale-heartbeat watchdog states fail closed', () => {
  const unhealthy = evaluateWatchdog({ watchdog_available: true, watchdog_healthy: false, heartbeat_age_seconds: 1 });
  assert.ok(unhealthy.triggers.includes('WATCHDOG_UNHEALTHY'));
  assert.equal(unhealthy.decision, 'SAFE_HOLD');

  const missing = evaluateWatchdog({ watchdog_available: true, watchdog_healthy: true });
  assert.ok(missing.triggers.includes('WATCHDOG_HEARTBEAT_MISSING'));
  assert.equal(missing.decision, 'SAFE_HOLD');

  const stale = evaluateWatchdog({ watchdog_available: true, watchdog_healthy: true, heartbeat_age_seconds: 181 });
  assert.ok(stale.triggers.includes('WATCHDOG_HEARTBEAT_STALE'));
  assert.equal(stale.decision, 'SAFE_HOLD');
});

test('Step 6.5 absent or malformed watchdog decision cannot silently fail open', () => {
  for (const decision of [null, undefined, {}, { decision: 'UNKNOWN' }]) {
    const effective = watchdogOverridesVictor('CONTINUE', decision);
    assert.equal(effective.effective_decision, 'SAFE_HOLD');
    assert.equal(effective.overridden, true);
    assert.ok(effective.triggers.includes('WATCHDOG_DECISION_UNAVAILABLE'));
  }
});

test('Step 6.6 shadow runtime requires healthy watchdog evidence for execution', () => {
  const missing = runShadowAutonomy({
    founder_text: 'Victor execute block 6', objective_id: 'OBJ-S6', action_id: 'ACT-MISSING',
  });
  assert.equal(missing.decision, 'SAFE_HOLD');
  assert.equal(missing.department_dispatch_allowed, false);
  assert.equal(missing.continuation_allowed, false);
  assert.ok(missing.watchdog.triggers.includes('WATCHDOG_UNAVAILABLE'));

  const healthy = runShadowAutonomy({
    founder_text: 'Victor execute block 6', objective_id: 'OBJ-S6', action_id: 'ACT-HEALTHY',
    watchdog_input: HEALTHY,
    now_utc: '2026-09-26T09:20:00Z',
  });
  assert.equal(healthy.decision, 'SANDBOX_EXECUTION_AUTHORIZED');
  assert.equal(healthy.department_dispatch_allowed, true);
  assert.equal(healthy.continuation_allowed, true);
});
