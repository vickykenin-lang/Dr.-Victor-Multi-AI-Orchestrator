import assert from 'node:assert/strict';
import {
  evaluateRetry,
  createDeadLetterRecord,
  evaluateLease,
  evaluateRestartRecovery,
  evaluateIncidentResponse,
} from './unattended_reliability.mjs';

const retry = evaluateRetry({ attempt: 0, error_code: 'TIMEOUT', max_attempts: 3 });
assert.equal(retry.decision, 'RETRY');
assert.equal(retry.attempt, 1);
assert.equal(retry.production_action_allowed, false);

const exhausted = evaluateRetry({ attempt: 3, error_code: 'UPSTREAM_5XX', max_attempts: 3 });
assert.equal(exhausted.decision, 'DEAD_LETTER');
assert.equal(exhausted.reason, 'RETRY_BUDGET_EXHAUSTED');

const dlq = createDeadLetterRecord({ task_id: 'step13-test-task', error_code: 'UPSTREAM_5XX', attempt: 3, observed_at_ms: 1000 });
assert.equal(dlq.record_type, 'DEAD_LETTER');
assert.equal(dlq.recovery_state, 'GOVERNED_REVIEW_REQUIRED');
assert.equal(dlq.automatic_production_replay_allowed, false);
assert(Object.isFrozen(dlq));

const activeLease = evaluateLease({ owner: 'tony_stark', now_ms: 1000, lease_expires_at_ms: 2000, candidate_owner: 'aura3' });
assert.equal(activeLease.decision, 'KEEP_OWNER');

const expiredLease = evaluateLease({ owner: 'tony_stark', now_ms: 3000, lease_expires_at_ms: 2000, candidate_owner: 'aura3' });
assert.equal(expiredLease.decision, 'REASSIGN_BOUNDED');
assert.equal(expiredLease.previous_owner, 'tony_stark');
assert.equal(expiredLease.new_owner, 'aura3');
assert.equal(expiredLease.production_action_allowed, false);

const noCandidate = evaluateLease({ owner: 'tony_stark', now_ms: 3000, lease_expires_at_ms: 2000 });
assert.equal(noCandidate.decision, 'SAFE_HOLD');

const restore = evaluateRestartRecovery({ checkpoint_present: true, checkpoint_valid: true, checkpoint_age_ms: 60_000 });
assert.equal(restore.decision, 'RESTORE_BOUNDED_STATE');
assert.equal(restore.production_action_allowed, false);

const staleCheckpoint = evaluateRestartRecovery({ checkpoint_present: true, checkpoint_valid: true, checkpoint_age_ms: 60 * 60 * 1000 });
assert.equal(staleCheckpoint.decision, 'SAFE_HOLD');
assert.equal(staleCheckpoint.reason, 'CHECKPOINT_STALE');

const incident = evaluateIncidentResponse({ health_ok: false, watchdog_ok: true, security_ok: true });
assert.equal(incident.decision, 'SAFE_HOLD');
assert.equal(incident.incident, true);
assert.equal(incident.automatic_production_recovery_allowed, false);
assert.equal(incident.consequential_execution_trigger, 'founder-command');

const healthy = evaluateIncidentResponse({ health_ok: true, watchdog_ok: true, security_ok: true });
assert.equal(healthy.decision, 'CONTINUE_BOUNDED');
assert.equal(healthy.automatic_production_recovery_allowed, false);

console.log('STEP13_UNATTENDED_RELIABILITY_MECHANISMS_PASS');
