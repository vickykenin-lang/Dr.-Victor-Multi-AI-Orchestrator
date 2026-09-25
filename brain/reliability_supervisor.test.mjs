import assert from 'node:assert/strict';
import { evaluateSupervisionSignal, recoveryBoundary } from './reliability_supervisor.mjs';

const now = Date.now();

const healthy = evaluateSupervisionSignal({
  observed_at_ms: now,
  signal_at_ms: now - 5 * 60 * 1000,
  health_ok: true,
  v2_ready: true,
  endgame_ready: true,
  production_autonomy_enabled: false,
  consequential_trigger: 'founder-command',
});
assert.equal(healthy.decision, 'CONTINUE_BOUNDED');
assert.equal(healthy.production_action_allowed, false);
assert.deepEqual(healthy.recovery_capabilities.sort(), ['evidence.read','repo.read','sandbox.execute'].sort());

const stale = evaluateSupervisionSignal({
  observed_at_ms: now,
  signal_at_ms: now - 30 * 60 * 1000,
  health_ok: true,
  v2_ready: true,
  endgame_ready: true,
  production_autonomy_enabled: false,
  consequential_trigger: 'founder-command',
});
assert.equal(stale.decision, 'SAFE_HOLD');
assert.equal(stale.production_action_allowed, false);

const failed = evaluateSupervisionSignal({
  observed_at_ms: now,
  signal_at_ms: now,
  health_ok: false,
  v2_ready: true,
  endgame_ready: true,
  production_autonomy_enabled: false,
  consequential_trigger: 'founder-command',
});
assert.equal(failed.decision, 'SAFE_HOLD');

const boundaryChanged = evaluateSupervisionSignal({
  observed_at_ms: now,
  signal_at_ms: now,
  health_ok: true,
  v2_ready: true,
  endgame_ready: true,
  production_autonomy_enabled: true,
  consequential_trigger: 'scheduler',
});
assert.equal(boundaryChanged.decision, 'SAFE_HOLD');
assert(boundaryChanged.blockers.includes('PRODUCTION_AUTONOMY_MUST_REMAIN_DISABLED'));
assert(boundaryChanged.blockers.includes('CONSEQUENTIAL_TRIGGER_BOUNDARY_CHANGED'));

const boundary = recoveryBoundary();
assert.equal(boundary.interval_minutes, 15);
assert.equal(boundary.production_autonomy_enabled, false);
assert.equal(boundary.amber_unattended_allowed, false);
assert.equal(boundary.red_unattended_allowed, false);
assert.equal(boundary.consequential_execution_trigger, 'founder-command');

console.log('PACKAGE6_RELIABILITY_SUPERVISOR_TESTS_PASS');
