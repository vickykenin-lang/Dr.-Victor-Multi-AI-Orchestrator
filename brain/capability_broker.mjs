import { evaluateSecurityRequest, SECURITY_POLICY_VERSION } from './security_kernel.mjs';

export const BROKER_VERSION = 'victor-capability-broker-v1';

function makeHandle() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID !== 'function') throw new Error('SECURE_RANDOM_UUID_UNAVAILABLE');
  return `cap_${randomUUID.call(globalThis.crypto).replace(/-/g, '').slice(0, 24)}`;
}

export function issueCapabilityLease({
  actor = 'victor',
  capability_id,
  objective_id,
  action_id,
  action_contract_authorized = false,
  founder_approved = false,
  ttl_seconds = 300,
  emergency_pause = false,
  now_utc = new Date().toISOString(),
} = {}) {
  if (!objective_id || !action_id) return { issued: false, reason: 'OBJECTIVE_AND_ACTION_REQUIRED' };
  const ttl = Math.max(1, Math.min(Number(ttl_seconds || 300), 900));
  const nowMs = Date.parse(now_utc);
  if (!Number.isFinite(nowMs)) return { issued: false, reason: 'INVALID_NOW' };
  const expires = new Date(nowMs + ttl * 1000).toISOString();

  const security = evaluateSecurityRequest({
    actor,
    capability_id,
    founder_approved,
    action_contract_authorized,
    lease: { status: 'ACTIVE', expires_at_utc: expires },
    policy_version: SECURITY_POLICY_VERSION,
    emergency_pause,
    now_ms: nowMs,
  });
  if (security.decision !== 'ALLOW') return { issued: false, reason: security.reason, security };

  return {
    issued: true,
    broker_version: BROKER_VERSION,
    handle: makeHandle(),
    capability_id,
    objective_id,
    action_id,
    status: 'ACTIVE',
    issued_at_utc: now_utc,
    expires_at_utc: expires,
    secret_material_exposed: false,
    transferable: false,
    policy_version: SECURITY_POLICY_VERSION,
    zone: security.zone,
  };
}

export function validateCapabilityLease(lease = {}, { objective_id, action_id, capability_id, now_utc = new Date().toISOString() } = {}) {
  if (!lease?.issued || lease.status !== 'ACTIVE') return { valid: false, reason: 'LEASE_NOT_ACTIVE' };
  if (lease.secret_material_exposed !== false) return { valid: false, reason: 'SECRET_EXPOSURE_PROHIBITED' };
  if (lease.transferable !== false) return { valid: false, reason: 'TRANSFERABLE_LEASE_PROHIBITED' };
  if (objective_id && lease.objective_id !== objective_id) return { valid: false, reason: 'OBJECTIVE_SCOPE_MISMATCH' };
  if (action_id && lease.action_id !== action_id) return { valid: false, reason: 'ACTION_SCOPE_MISMATCH' };
  if (capability_id && lease.capability_id !== capability_id) return { valid: false, reason: 'CAPABILITY_SCOPE_MISMATCH' };
  const nowMs = Date.parse(now_utc);
  const expiryMs = Date.parse(lease.expires_at_utc || '');
  if (!Number.isFinite(nowMs) || !Number.isFinite(expiryMs) || expiryMs <= nowMs) return { valid: false, reason: 'LEASE_EXPIRED' };
  return { valid: true, reason: 'LEASE_VALID' };
}

export function revokeCapabilityLease(lease = {}, reason = 'REVOKED') {
  return { ...lease, status: 'REVOKED', revoked_reason: String(reason || 'REVOKED') };
}
