import crypto from 'node:crypto';

export function quarantineUntrustedInput({ source = 'external', content = '', authority = 'UNTRUSTED' } = {}) {
  const text = String(content || '');
  const instructionLike = /(ignore (?:all|previous|prior) instructions|reveal|print|dump|send|upload).{0,80}(secret|token|key|credential)|(?:run|execute|deploy|delete|rotate|grant).{0,80}(without|bypass|ignore).{0,40}(approval|policy|gate|security)/i.test(text);
  return {
    source,
    authority: 'UNTRUSTED_DATA',
    quarantined: true,
    instruction_like: instructionLike,
    execution_authority: false,
    content_fingerprint: crypto.createHash('sha256').update(text).digest('hex'),
    reason: instructionLike ? 'PROMPT_INJECTION_PATTERN_DETECTED' : 'EXTERNAL_INPUT_QUARANTINED_BY_DEFAULT',
  };
}

export function validateEvidenceEnvelope({ source, observed_at_utc, payload_hash, provenance, current_time_utc = new Date().toISOString(), max_age_seconds = 900 } = {}) {
  const allowedProvenance = ['DIRECT_EXTERNAL', 'PLATFORM_API', 'RUNTIME_STATE', 'HISTORICAL_LOG', 'ADVISORY_MEMORY'];
  if (!source || !observed_at_utc || !payload_hash || !provenance) return { valid: false, reason: 'EVIDENCE_FIELDS_MISSING' };
  if (!allowedProvenance.includes(provenance)) return { valid: false, reason: 'PROVENANCE_INVALID' };
  if (!/^[a-f0-9]{32,128}$/i.test(String(payload_hash))) return { valid: false, reason: 'PAYLOAD_HASH_INVALID' };
  const observed = Date.parse(observed_at_utc);
  const now = Date.parse(current_time_utc);
  if (!Number.isFinite(observed) || !Number.isFinite(now)) return { valid: false, reason: 'EVIDENCE_TIME_INVALID' };
  const ageSeconds = Math.max(0, (now - observed) / 1000);
  if (ageSeconds > max_age_seconds && provenance !== 'HISTORICAL_LOG' && provenance !== 'ADVISORY_MEMORY') {
    return { valid: false, reason: 'FRESH_EVIDENCE_REQUIRED', age_seconds: ageSeconds };
  }
  return { valid: true, reason: 'EVIDENCE_ENVELOPE_VALID', age_seconds: ageSeconds, authority: provenance === 'ADVISORY_MEMORY' ? 'ADVISORY_ONLY' : 'EVIDENCE' };
}

export function evaluateCrossAgentRequest({ caller_authority = 'NONE', requested_authority = 'NONE', action_contract_authority = 'NONE' } = {}) {
  const rank = { NONE: 0, READ: 1, GREEN: 2, AMBER: 3, RED: 4 };
  const caller = rank[caller_authority] ?? 0;
  const requested = rank[requested_authority] ?? 0;
  const contract = rank[action_contract_authority] ?? 0;
  if (requested > contract) return { allowed: false, reason: 'REQUEST_EXCEEDS_ACTION_CONTRACT' };
  if (requested > caller && caller_authority !== 'NONE') return { allowed: false, reason: 'AGENT_AUTHORITY_INHERITANCE_PROHIBITED' };
  return { allowed: true, reason: 'REQUEST_WITHIN_EXPLICIT_CONTRACT' };
}

export function evaluateRollbackTarget({ target_version, approved_versions = [], revoked_versions = [] } = {}) {
  if (!target_version) return { allowed: false, reason: 'ROLLBACK_TARGET_REQUIRED' };
  if (revoked_versions.includes(target_version)) return { allowed: false, reason: 'ROLLBACK_TARGET_REVOKED' };
  if (!approved_versions.includes(target_version)) return { allowed: false, reason: 'ROLLBACK_TARGET_NOT_APPROVED' };
  return { allowed: true, reason: 'ROLLBACK_TARGET_APPROVED' };
}

export function evaluateOutputForSecretRisk(text = '') {
  const value = String(text || '');
  const patterns = [
    /ghp_[A-Za-z0-9]{20,}/,
    /github_pat_[A-Za-z0-9_]{20,}/,
    /sk-[A-Za-z0-9_-]{20,}/,
    /(?:token|secret|api[_ -]?key|password)\s*[:=]\s*[^\s]{12,}/i,
  ];
  const risky = patterns.some((pattern) => pattern.test(value));
  return { allowed: !risky, secret_risk_detected: risky, reason: risky ? 'POTENTIAL_SECRET_EXFILTRATION_BLOCKED' : 'OUTPUT_SECRET_SCAN_CLEAR' };
}
