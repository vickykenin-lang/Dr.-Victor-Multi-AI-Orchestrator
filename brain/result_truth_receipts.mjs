import { makeFactReceipt, resolveTruthReceipts } from './truth_resolver.mjs';

function unique(values = []) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function observedAt(result = {}) {
  return result.observed_at || result.completed_at || result.updated_at || new Date().toISOString();
}

function externalVerificationOf(result = {}) {
  const strict = result.strict_supervision || {};
  const finalOutcome = result.final_outcome || strict.final_outcome || {};
  const explicit = result.external_verification || finalOutcome.external_verification || null;
  if (!explicit || explicit.verified !== true) return null;
  const evidence = unique(Array.isArray(explicit.evidence) ? explicit.evidence : []);
  if (!evidence.length) return null;
  return {
    verified: true,
    objective_met: explicit.objective_met === true || finalOutcome.objective_met === true,
    platform: explicit.platform || null,
    external_id: explicit.external_id || explicit.media_id || explicit.transaction_id || null,
    permalink: explicit.permalink || explicit.url || null,
    evidence,
  };
}

export function buildResultTruthReceipts(result = {}, { target = null, taskId = null, fetchedAt = new Date().toISOString() } = {}) {
  const strict = result.strict_supervision || {};
  const finalOutcome = result.final_outcome || strict.final_outcome || {};
  const sender = target || result.sender || 'unknown';
  const task = taskId || result.task_id || 'unknown';
  const sourceUri = `department://${sender}/task/${task}`;
  const at = observedAt(result);
  const receipts = [];

  const pushEnvelope = (fact, value, metadata = null) => {
    if (value === undefined || value === null) return;
    receipts.push(makeFactReceipt({
      fact,
      value,
      sourceClass: 'DEPARTMENT_ENVELOPE',
      sourceUri,
      observedAt: at,
      fetchedAt,
      staleAfterMs: 30 * 60 * 1000,
      confidence: result.__victor_verified === true ? 'HIGH' : 'MEDIUM',
      scope: { target: sender, task_id: task },
      metadata,
    }));
  };

  pushEnvelope(`${sender}.result.status`, strict.status || result.execution_status || 'UNKNOWN');
  pushEnvelope(`${sender}.result.blocker`, strict.error_or_blocker ?? result.blockers ?? null);
  pushEnvelope(`${sender}.result.next_action`, strict.next_action || result.next_valid_action || null);
  pushEnvelope(`${sender}.result.requires_follow_up`, strict.requires_follow_up === true);
  pushEnvelope(`${sender}.result.work_performed`, Boolean(
    result.governed_business_cycle_performed === true ||
    result.public_action_performed === true ||
    result.changed_files?.length ||
    result.snapshot?.changed_files?.length
  ));

  if (Object.keys(finalOutcome).length) {
    pushEnvelope(`${sender}.result.final_outcome_claim`, {
      verified: finalOutcome.verified === true,
      objective_met: finalOutcome.objective_met === true,
      evidence: unique(Array.isArray(finalOutcome.evidence) ? finalOutcome.evidence : []),
    }, { note: 'Department final-outcome claim; not automatically an external-platform result.' });
  }

  const external = externalVerificationOf(result);
  if (external) {
    const platformUri = external.permalink || `external://${external.platform || sender}/${external.external_id || task}`;
    receipts.push(makeFactReceipt({
      fact: `${sender}.external.objective_outcome`,
      value: external,
      sourceClass: 'EXTERNAL_RESULT',
      sourceUri: platformUri,
      observedAt: at,
      fetchedAt,
      staleAfterMs: Number.POSITIVE_INFINITY,
      confidence: 'HIGH',
      scope: { target: sender, task_id: task, platform: external.platform },
      metadata: { evidence_count: external.evidence.length },
    }));
  }

  return receipts;
}

export function attachResultTruth(result = {}, options = {}) {
  const receipts = buildResultTruthReceipts(result, options);
  return {
    ...result,
    truth_receipts: [...(Array.isArray(result.truth_receipts) ? result.truth_receipts : []), ...receipts],
    resolved_truth: resolveTruthReceipts([...(Array.isArray(result.truth_receipts) ? result.truth_receipts : []), ...receipts]),
  };
}
