import assert from 'node:assert/strict';
import { auditStep13Continuity, STEP13_WINDOW_END } from './step13_continuity_audit.mjs';

const runs = [
  { id: 1, event: 'schedule', created_at: '2026-09-25T21:00:00Z', status: 'completed', conclusion: 'success', head_sha: 'a' },
  { id: 2, event: 'schedule', created_at: '2026-09-25T21:15:00Z', status: 'completed', conclusion: 'success', head_sha: 'a' },
  { id: 3, event: 'schedule', created_at: '2026-09-25T22:00:00Z', status: 'completed', conclusion: 'failure', head_sha: 'b' },
  { id: 4, event: 'workflow_dispatch', created_at: '2026-09-25T22:15:00Z', status: 'completed', conclusion: 'success', head_sha: 'b' },
];

const pre = auditStep13Continuity(runs, { now_ms: Date.parse('2026-09-27T00:00:00Z') });
assert.equal(pre.window_mature, false);
assert.equal(pre.decision, 'PENDING_WINDOW_MATURITY');
assert.equal(pre.final_step13_pass, false);
assert.equal(pre.observed_schedule_runs, 3);
assert.equal(pre.conclusions.success, 2);
assert.equal(pre.conclusions.failure, 1);
assert.equal(pre.detected_gaps_over_30_minutes.length, 1);
assert.equal(pre.non_success_runs.length, 1);
assert(pre.closure_blockers.includes('REAL_168_HOUR_WINDOW_NOT_MATURE'));
assert(pre.closure_blockers.includes('SCHEDULE_GAPS_REQUIRE_RECONCILIATION'));
assert(pre.closure_blockers.includes('NON_SUCCESS_RUNS_REQUIRE_CLASSIFICATION'));

const mature = auditStep13Continuity(runs, { now_ms: STEP13_WINDOW_END + 1000 });
assert.equal(mature.window_mature, true);
assert.equal(mature.decision, 'MATURITY_REACHED_RECONCILIATION_REQUIRED');
assert.equal(mature.final_step13_pass, false);
assert(!mature.closure_blockers.includes('REAL_168_HOUR_WINDOW_NOT_MATURE'));
assert(mature.closure_blockers.includes('FINAL_HUMAN_OR_GOVERNED_CLOSURE_AUDIT_REQUIRED'));

const empty = auditStep13Continuity([], { now_ms: STEP13_WINDOW_END + 1000 });
assert.equal(empty.observed_schedule_runs, 0);
assert.equal(empty.final_step13_pass, false);

console.log('STEP13_CONTINUITY_AUDITOR_TESTS_PASS');
