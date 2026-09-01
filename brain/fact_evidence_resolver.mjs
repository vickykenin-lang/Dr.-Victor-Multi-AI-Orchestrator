import { makeFactReceipt, resolveTruthReceipts } from './truth_resolver.mjs';

function push(receipts, fact, value, sourceUri, fetchedAt, observedAt = null, options = {}) {
  if (value === undefined || value === null) return;
  receipts.push(makeFactReceipt({
    fact,
    value,
    sourceClass: options.sourceClass || 'CANONICAL_STATE',
    sourceUri,
    fetchedAt,
    observedAt,
    staleAfterMs: options.staleAfterMs,
    confidence: options.confidence || 'HIGH',
    scope: options.scope || null,
    metadata: options.metadata || null,
  }));
}

export function buildFactReceipts(evidence = {}) {
  const fetchedAt = evidence.fetched_at_utc || new Date().toISOString();
  const receipts = [];
  const rio = evidence.rio || {};
  const runner = rio.heartbeat_runner_status || {};
  const control = rio.control || {};
  const production = rio.production_control || {};
  const work = rio.work_status || {};
  const igRun = rio.instagram_run_status || {};

  push(receipts, 'rio.heartbeat.runner_state', runner.state, 'github://vickykenin-lang/rio-affiliate-engine/data/heartbeat_runner_status.json', fetchedAt, runner.finished_at_utc || runner.started_at_utc, { staleAfterMs: 20 * 60 * 1000 });
  push(receipts, 'rio.heartbeat.finished_at_utc', runner.finished_at_utc, 'github://vickykenin-lang/rio-affiliate-engine/data/heartbeat_runner_status.json', fetchedAt, runner.finished_at_utc, { staleAfterMs: 20 * 60 * 1000 });
  push(receipts, 'rio.instagram_auto_publish', control.instagram_auto_publish, 'github://vickykenin-lang/rio-affiliate-engine/data/control.json', fetchedAt, control.resumed_at || null, { staleAfterMs: 24 * 60 * 60 * 1000 });
  push(receipts, 'rio.instagram_pause_reason', control.instagram_pause_reason, 'github://vickykenin-lang/rio-affiliate-engine/data/control.json', fetchedAt, control.maintenance_pause_set_at || control.resumed_at || null, { staleAfterMs: 24 * 60 * 60 * 1000 });
  push(receipts, 'rio.kill_switch', control.kill_switch, 'github://vickykenin-lang/rio-affiliate-engine/data/control.json', fetchedAt, control.resumed_at || null, { staleAfterMs: 24 * 60 * 60 * 1000 });
  push(receipts, 'rio.production_state', production.production_state, 'github://vickykenin-lang/rio-affiliate-engine/data/production_control.json', fetchedAt, production.activated_at || null, { staleAfterMs: 7 * 24 * 60 * 60 * 1000 });
  push(receipts, 'rio.work.status', work.status, 'github://vickykenin-lang/rio-affiliate-engine/data/rio_work_status.json', fetchedAt, work.updated_at || null, { staleAfterMs: 30 * 60 * 1000 });
  push(receipts, 'rio.work.blocker', work.blocker, 'github://vickykenin-lang/rio-affiliate-engine/data/rio_work_status.json', fetchedAt, work.updated_at || null, { staleAfterMs: 30 * 60 * 1000 });
  push(receipts, 'rio.instagram.last_run_status', igRun.status, 'github://vickykenin-lang/rio-affiliate-engine/data/instagram_run_status.json', fetchedAt, igRun.updated_at || null, { staleAfterMs: 24 * 60 * 60 * 1000 });

  if (rio.workflow_counts) {
    push(receipts, 'rio.workflow.counts', rio.workflow_counts.counts, 'github://vickykenin-lang/rio-affiliate-engine/actions/runs', fetchedAt, rio.workflow_counts.latest?.updated_at || rio.workflow_counts.latest?.created_at || null, {
      sourceClass: 'WORKFLOW_JOB',
      staleAfterMs: 30 * 60 * 1000,
      scope: rio.workflow_counts.scope,
      metadata: { note: rio.workflow_counts.note, fetched: rio.workflow_counts.rio_runs_fetched },
    });
    push(receipts, 'rio.workflow.latest_conclusion', rio.workflow_counts.latest?.conclusion, 'github://vickykenin-lang/rio-affiliate-engine/actions/runs', fetchedAt, rio.workflow_counts.latest?.updated_at || null, { sourceClass: 'WORKFLOW_JOB', staleAfterMs: 30 * 60 * 1000 });
  }

  for (const [target, repo] of [['rio', 'rio-affiliate-engine'], ['aura3', 'aura-3.0'], ['tony_stark', 'tony-stark-engineering']]) {
    const commit = evidence?.[target]?.latest_commit;
    if (!commit) continue;
    push(receipts, `${target}.latest_commit`, { sha: commit.sha, date: commit.date, message: commit.message, html_url: commit.html_url }, `github://vickykenin-lang/${repo}/commits/${commit.sha || 'latest'}`, fetchedAt, commit.date, {
      sourceClass: 'WORKFLOW_JOB',
      staleAfterMs: Number.POSITIVE_INFINITY,
      confidence: 'HIGH',
    });
  }

  return receipts;
}

export function attachResolvedTruth(evidence = {}) {
  const receipts = buildFactReceipts(evidence);
  return {
    ...evidence,
    truth_receipts: receipts,
    resolved_truth: resolveTruthReceipts(receipts),
  };
}
