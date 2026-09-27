export const STEP13_WINDOW_START = Date.parse('2026-09-25T20:53:03Z');
export const STEP13_WINDOW_END = Date.parse('2026-10-02T20:53:03Z');
export const STEP13_EXPECTED_SIGNALS = 672;
export const STEP13_EXPECTED_CADENCE_MS = 15 * 60 * 1000;
export const STEP13_GAP_ALERT_MS = 30 * 60 * 1000;

function parseTime(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function auditStep13Continuity(runs = [], { now_ms = Date.now() } = {}) {
  const scheduleRuns = runs
    .filter(r => r && r.event === 'schedule')
    .map(r => ({
      id: r.id,
      created_at: r.created_at,
      created_ms: parseTime(r.created_at),
      status: r.status || null,
      conclusion: r.conclusion || null,
      head_sha: r.head_sha || null,
    }))
    .filter(r => r.created_ms !== null && r.created_ms >= STEP13_WINDOW_START && r.created_ms <= STEP13_WINDOW_END)
    .sort((a, b) => a.created_ms - b.created_ms);

  const conclusions = {};
  for (const r of scheduleRuns) {
    const key = r.conclusion || r.status || 'unknown';
    conclusions[key] = (conclusions[key] || 0) + 1;
  }

  const gaps = [];
  for (let i = 1; i < scheduleRuns.length; i += 1) {
    const gap_ms = scheduleRuns[i].created_ms - scheduleRuns[i - 1].created_ms;
    if (gap_ms > STEP13_GAP_ALERT_MS) {
      gaps.push({
        from_run_id: scheduleRuns[i - 1].id,
        to_run_id: scheduleRuns[i].id,
        from: scheduleRuns[i - 1].created_at,
        to: scheduleRuns[i].created_at,
        gap_minutes: Math.round((gap_ms / 60000) * 100) / 100,
        classification: 'REQUIRES_RECONCILIATION',
      });
    }
  }

  const failures = scheduleRuns.filter(r => ['failure', 'cancelled', 'timed_out', 'action_required', 'stale'].includes(r.conclusion));
  const windowMature = Number(now_ms) >= STEP13_WINDOW_END;
  const observed = scheduleRuns.length;
  const missing_vs_nominal = Math.max(0, STEP13_EXPECTED_SIGNALS - observed);

  return {
    schema_version: 1,
    audit: 'VICTOR_V2_STEP13_CONTINUITY',
    window_start_utc: new Date(STEP13_WINDOW_START).toISOString(),
    window_end_utc: new Date(STEP13_WINDOW_END).toISOString(),
    evaluated_at_utc: new Date(Number(now_ms)).toISOString(),
    window_mature: windowMature,
    expected_cadence_minutes: 15,
    nominal_expected_signals: STEP13_EXPECTED_SIGNALS,
    observed_schedule_runs: observed,
    missing_vs_nominal,
    conclusions,
    detected_gaps_over_30_minutes: gaps,
    non_success_runs: failures,
    first_observed_at: scheduleRuns[0]?.created_at || null,
    last_observed_at: scheduleRuns.at(-1)?.created_at || null,
    final_step13_pass: false,
    decision: windowMature ? 'MATURITY_REACHED_RECONCILIATION_REQUIRED' : 'PENDING_WINDOW_MATURITY',
    closure_blockers: [
      ...(!windowMature ? ['REAL_168_HOUR_WINDOW_NOT_MATURE'] : []),
      ...(gaps.length ? ['SCHEDULE_GAPS_REQUIRE_RECONCILIATION'] : []),
      ...(failures.length ? ['NON_SUCCESS_RUNS_REQUIRE_CLASSIFICATION'] : []),
      'FINAL_HUMAN_OR_GOVERNED_CLOSURE_AUDIT_REQUIRED',
    ],
    truth_rule: 'This auditor never grants final Step 13 PASS. It inventories real schedule evidence and remains fail-closed until a governed closure audit reconciles continuity, gaps, failures, and retained evidence.',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const payload = input.trim() ? JSON.parse(input) : {};
  const runs = Array.isArray(payload) ? payload : (payload.workflow_runs || []);
  const report = auditStep13Continuity(runs, { now_ms: Date.now() });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
