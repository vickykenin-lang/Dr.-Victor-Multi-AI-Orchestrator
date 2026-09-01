export const TRUTH_SOURCE_PRECEDENCE = Object.freeze({
  EXTERNAL_RESULT: 700,
  WORKFLOW_JOB: 600,
  DEPARTMENT_ENVELOPE: 500,
  CANONICAL_STATE: 400,
  HISTORICAL_LOG: 300,
  DURABLE_MEMORY: 200,
  CONVERSATION_CONTEXT: 100,
});

const DEFAULT_STALE_AFTER_MS = 30 * 60 * 1000;

function isoMs(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSourceClass(value) {
  const key = String(value || '').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(TRUTH_SOURCE_PRECEDENCE, key) ? key : 'CONVERSATION_CONTEXT';
}

export function makeFactReceipt({
  fact,
  value,
  sourceClass,
  sourceUri,
  observedAt = null,
  fetchedAt = new Date().toISOString(),
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
  confidence = 'HIGH',
  scope = null,
  metadata = null,
} = {}) {
  const source_class = normalizeSourceClass(sourceClass);
  const fetchedMs = isoMs(fetchedAt) ?? Date.now();
  const observedMs = isoMs(observedAt);
  const ageMs = observedMs == null ? null : Math.max(0, fetchedMs - observedMs);
  const stale = ageMs != null && Number.isFinite(staleAfterMs) && ageMs > staleAfterMs;
  return {
    fact: String(fact || '').trim(),
    value: value ?? null,
    source_class,
    source_precedence: TRUTH_SOURCE_PRECEDENCE[source_class],
    source_uri: String(sourceUri || '').trim() || null,
    observed_at: observedAt || null,
    fetched_at: fetchedAt || null,
    age_ms: ageMs,
    stale_after_ms: staleAfterMs,
    stale,
    confidence: String(confidence || 'UNKNOWN').toUpperCase(),
    scope,
    metadata,
  };
}

function valueFingerprint(value) {
  try { return JSON.stringify(value); } catch { return String(value); }
}

function compareReceipts(a, b) {
  const precedence = (b.source_precedence || 0) - (a.source_precedence || 0);
  if (precedence !== 0) return precedence;
  if (a.stale !== b.stale) return a.stale ? 1 : -1;
  const aObserved = isoMs(a.observed_at) ?? isoMs(a.fetched_at) ?? 0;
  const bObserved = isoMs(b.observed_at) ?? isoMs(b.fetched_at) ?? 0;
  return bObserved - aObserved;
}

export function reconcileReceiptSet(receipts = []) {
  const usable = (Array.isArray(receipts) ? receipts : [])
    .filter(item => item && item.fact && item.source_uri)
    .map(item => ({ ...item, source_class: normalizeSourceClass(item.source_class), source_precedence: TRUTH_SOURCE_PRECEDENCE[normalizeSourceClass(item.source_class)] }))
    .sort(compareReceipts);

  if (!usable.length) {
    return { status: 'UNRESOLVED', selected: null, rejected: [], conflict: false, reason: 'NO_USABLE_RECEIPTS' };
  }

  const selected = usable[0];
  const selectedFingerprint = valueFingerprint(selected.value);
  const conflicting = usable.filter(item => valueFingerprint(item.value) !== selectedFingerprint);
  const rejected = usable.slice(1).map(item => {
    let reason = 'LOWER_PRIORITY_DUPLICATE';
    if (valueFingerprint(item.value) !== selectedFingerprint) {
      if ((item.source_precedence || 0) < (selected.source_precedence || 0)) reason = 'LOWER_PRECEDENCE_CONFLICT';
      else if (item.stale && !selected.stale) reason = 'STALE_CONFLICT';
      else reason = 'OLDER_OR_LOWER_CONFIDENCE_CONFLICT';
    }
    return { receipt: item, reason };
  });

  return {
    status: selected.stale ? 'RESOLVED_STALE_ONLY' : 'RESOLVED',
    selected,
    rejected,
    conflict: conflicting.length > 0,
    reason: selected.stale ? 'BEST_AVAILABLE_RECEIPT_IS_STALE' : 'HIGHEST_PRECEDENCE_FRESHEST_RECEIPT',
  };
}

export function resolveTruthReceipts(receipts = []) {
  const grouped = new Map();
  for (const receipt of Array.isArray(receipts) ? receipts : []) {
    if (!receipt?.fact) continue;
    const key = String(receipt.fact);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(receipt);
  }
  const facts = {};
  for (const [fact, items] of grouped.entries()) facts[fact] = reconcileReceiptSet(items);
  return {
    schema_version: 1,
    truth_hierarchy: Object.keys(TRUTH_SOURCE_PRECEDENCE),
    facts,
    unresolved: Object.entries(facts).filter(([, result]) => result.status === 'UNRESOLVED').map(([fact]) => fact),
    stale_only: Object.entries(facts).filter(([, result]) => result.status === 'RESOLVED_STALE_ONLY').map(([fact]) => fact),
    conflicts: Object.entries(facts).filter(([, result]) => result.conflict).map(([fact]) => fact),
  };
}
