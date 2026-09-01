import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFactReceipt, reconcileReceiptSet, resolveTruthReceipts } from './truth_resolver.mjs';

test('higher truth precedence beats fresher lower-priority historical log', () => {
  const fetched = '2026-09-02T00:00:00Z';
  const receipts = [
    makeFactReceipt({ fact: 'rio.instagram_auto_publish', value: false, sourceClass: 'HISTORICAL_LOG', sourceUri: 'telegram://rio-alerts/old', observedAt: '2026-09-01T23:59:00Z', fetchedAt: fetched }),
    makeFactReceipt({ fact: 'rio.instagram_auto_publish', value: true, sourceClass: 'CANONICAL_STATE', sourceUri: 'github://rio/data/control.json', observedAt: '2026-09-01T23:00:00Z', fetchedAt: fetched }),
  ];
  const result = reconcileReceiptSet(receipts);
  assert.equal(result.selected.value, true);
  assert.equal(result.selected.source_class, 'CANONICAL_STATE');
  assert.equal(result.conflict, true);
  assert.equal(result.rejected[0].reason, 'LOWER_PRECEDENCE_CONFLICT');
});

test('same precedence selects fresh receipt and rejects stale conflicting receipt', () => {
  const fetched = '2026-09-02T00:00:00Z';
  const stale = makeFactReceipt({ fact: 'rio.heartbeat.state', value: 'FAILED', sourceClass: 'CANONICAL_STATE', sourceUri: 'github://rio/data/old.json', observedAt: '2026-09-01T20:00:00Z', fetchedAt: fetched, staleAfterMs: 30 * 60 * 1000 });
  const fresh = makeFactReceipt({ fact: 'rio.heartbeat.state', value: 'COMPLETED', sourceClass: 'CANONICAL_STATE', sourceUri: 'github://rio/data/heartbeat_runner_status.json', observedAt: '2026-09-01T23:55:00Z', fetchedAt: fetched, staleAfterMs: 30 * 60 * 1000 });
  const result = reconcileReceiptSet([stale, fresh]);
  assert.equal(result.selected.value, 'COMPLETED');
  assert.equal(result.selected.stale, false);
  assert.equal(result.rejected[0].reason, 'STALE_CONFLICT');
});

test('resolver reports stale-only facts instead of silently upgrading them', () => {
  const receipt = makeFactReceipt({ fact: 'aura3.latest_commit', value: 'abc', sourceClass: 'WORKFLOW_JOB', sourceUri: 'github://aura3/commits/abc', observedAt: '2026-08-31T10:00:00Z', fetchedAt: '2026-09-02T00:00:00Z', staleAfterMs: 60 * 60 * 1000 });
  const resolved = resolveTruthReceipts([receipt]);
  assert.equal(resolved.facts['aura3.latest_commit'].status, 'RESOLVED_STALE_ONLY');
  assert.deepEqual(resolved.stale_only, ['aura3.latest_commit']);
});
