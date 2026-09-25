export const SECURITY_POLICY_VERSION = 'victor-security-policy-v1';

export const SECURITY_ZONE = Object.freeze({
  GREEN: 'GREEN',
  AMBER: 'AMBER',
  RED: 'RED',
});

const CAPABILITIES = Object.freeze({
  'repo.read': { zone: SECURITY_ZONE.GREEN, founder_gate: false, reversible: true },
  'evidence.read': { zone: SECURITY_ZONE.GREEN, founder_gate: false, reversible: true },
  'sandbox.execute': { zone: SECURITY_ZONE.GREEN, founder_gate: false, reversible: true },
  'repo.branch.write': { zone: SECURITY_ZONE.AMBER, founder_gate: false, reversible: true },
  'repo.pr.write': { zone: SECURITY_ZONE.AMBER, founder_gate: false, reversible: true },
  'production.reversible_change': { zone: SECURITY_ZONE.AMBER, founder_gate: false, reversible: true },
  'credential.rotate': { zone: SECURITY_ZONE.RED, founder_gate: true, reversible: false },
  'security.policy.change': { zone: SECURITY_ZONE.RED, founder_gate: true, reversible: false },
  'authority.expand': { zone: SECURITY_ZONE.RED, founder_gate: true, reversible: false },
  'production.destructive_change': { zone: SECURITY_ZONE.RED, founder_gate: true, reversible: false },
  'pause.override': { zone: SECURITY_ZONE.RED, founder_gate: true, reversible: false },
});

export function getSecurityCapability(capabilityId) {
  const rule = CAPABILITIES[String(capabilityId || '')];
  return rule ? { capability_id: capabilityId, ...rule } : null;
}

export function securityCapabilityRegistry() {
  return Object.entries(CAPABILITIES).map(([capability_id, value]) => ({ capability_id, ...value }));
}

function leaseIsActive(lease, nowMs = Date.now()) {
  if (!lease || lease.status !== 'ACTIVE') return false;
  if (!lease.expires_at_utc) return false;
  const expires = Date.parse(lease.expires_at_utc);
  return Number.isFinite(expires) && expires > nowMs;
}

export function evaluateSecurityRequest({
  actor = 'victor',
  capability_id,
  founder_approved = false,
  action_contract_authorized = false,
  lease = null,
  policy_version = SECURITY_POLICY_VERSION,
  emergency_pause = false,
  now_ms = Date.now(),
} = {}) {
  const capability = getSecurityCapability(capability_id);

  if (emergency_pause === true && capability_id !== 'evidence.read') {
    return { decision: 'DENY', reason: 'EMERGENCY_PAUSE_ACTIVE', policy_version };
  }

  if (policy_version !== SECURITY_POLICY_VERSION) {
    return { decision: 'DENY', reason: 'UNSUPPORTED_SECURITY_POLICY_VERSION', policy_version };
  }

  if (!capability) {
    return { decision: 'DENY', reason: 'CAPABILITY_NOT_REGISTERED', policy_version };
  }

  if (String(actor || '').toLowerCase() === 'victor' && capability_id === 'authority.expand') {
    return { decision: 'DENY', reason: 'SELF_AUTHORITY_GRANT_PROHIBITED', policy_version, zone: capability.zone };
  }

  if (capability.founder_gate === true && founder_approved !== true) {
    return { decision: 'DENY', reason: 'FOUNDER_APPROVAL_REQUIRED', policy_version, zone: capability.zone };
  }

  if (capability.zone === SECURITY_ZONE.GREEN) {
    return { decision: 'ALLOW', reason: 'GREEN_CAPABILITY', policy_version, zone: capability.zone };
  }

  if (capability.zone === SECURITY_ZONE.AMBER) {
    if (action_contract_authorized !== true) {
      return { decision: 'DENY', reason: 'ACTION_CONTRACT_REQUIRED', policy_version, zone: capability.zone };
    }
    if (!leaseIsActive(lease, now_ms)) {
      return { decision: 'DENY', reason: 'ACTIVE_EXECUTION_LEASE_REQUIRED', policy_version, zone: capability.zone };
    }
    return { decision: 'ALLOW', reason: 'AMBER_GOVERNED_REVERSIBLE', policy_version, zone: capability.zone };
  }

  if (capability.zone === SECURITY_ZONE.RED) {
    if (founder_approved !== true) {
      return { decision: 'DENY', reason: 'FOUNDER_APPROVAL_REQUIRED', policy_version, zone: capability.zone };
    }
    if (capability_id === 'authority.expand' && String(actor || '').toLowerCase() === 'victor') {
      return { decision: 'DENY', reason: 'SELF_AUTHORITY_GRANT_PROHIBITED', policy_version, zone: capability.zone };
    }
    return { decision: 'ALLOW', reason: 'FOUNDER_GATED_RED_CAPABILITY', policy_version, zone: capability.zone };
  }

  return { decision: 'DENY', reason: 'FAIL_CLOSED', policy_version };
}

export function validateSecurityPolicyUpdate(candidate = {}) {
  if (!candidate || typeof candidate !== 'object') return { valid: false, reason: 'INVALID_POLICY_OBJECT' };
  if (!candidate.version || typeof candidate.version !== 'string') return { valid: false, reason: 'POLICY_VERSION_REQUIRED' };
  if (candidate.fail_open === true) return { valid: false, reason: 'FAIL_OPEN_PROHIBITED' };
  if (candidate.allow_self_authority_expansion === true) return { valid: false, reason: 'SELF_AUTHORITY_EXPANSION_PROHIBITED' };
  if (candidate.disable_founder_gates === true) return { valid: false, reason: 'FOUNDER_GATE_DISABLE_PROHIBITED' };
  return { valid: true, reason: 'POLICY_UPDATE_CANDIDATE_ACCEPTABLE_FOR_SANDBOX_TEST_ONLY' };
}
