import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFactReceipts } from './fact_evidence_resolver.mjs';

test('freshly fetched configuration remains current even when last change is old', () => {
  const fetched = '2026-09-03T16:30:00.000Z';
  const receipts = buildFactReceipts({
    fetched_at_utc: fetched,
    rio: {
      control: {
        instagram_auto_publish: true,
        instagram_pause_reason: null,
        kill_switch: false,
        resumed_at: '2026-08-23T10:32:00.000Z',
      },
      production_control: {
        production_state: 'ACTIVE',
        activated_at: '2026-08-27T10:00:00.000Z',
      },
    },
  });
  for (const fact of ['rio.instagram_auto_publish', 'rio.kill_switch', 'rio.production_state']) {
    const receipt = receipts.find(item => item.fact === fact);
    assert.ok(receipt, fact);
    assert.equal(receipt.observed_at, fetched);
    assert.equal(receipt.stale, false);
    assert.equal(receipt.metadata?.semantics, 'CURRENT_CONFIGURATION_FROM_FRESH_GITHUB_READ');
  }
});

test('heartbeat freshness still ages from the heartbeat event timestamp', () => {
  const receipts = buildFactReceipts({
    fetched_at_utc: '2026-09-03T16:30:00.000Z',
    rio: {
      heartbeat_runner_status: {
        state: 'COMPLETED',
        finished_at_utc: '2026-09-03T14:30:00.000Z',
      },
    },
  });
  const receipt = receipts.find(item => item.fact === 'rio.heartbeat.runner_state');
  assert.equal(receipt.stale, true);
  assert.equal(receipt.stale_after_ms, 20 * 60 * 1000);
});
