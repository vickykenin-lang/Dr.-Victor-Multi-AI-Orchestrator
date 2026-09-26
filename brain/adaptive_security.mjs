import crypto from 'node:crypto';
import { validateSecurityPolicyUpdate } from './security_kernel.mjs';

export const ADAPTIVE_SECURITY_VERSION = 'victor-adaptive-security-v2';

const REQUIRED_INVARIANTS = Object.freeze([
  'FAIL_CLOSED',
  'NO_SELF_AUTHORITY_EXPANSION',
  'FOUNDER_GATES_PRESERVED',
  'NO_MASTER_SECRET_EXPOSURE',
  'SANDBOX_BEFORE_UNTRUSTED_EXECUTION',
  'EVIDENCE_STAGE_SEPARATION',
]);

const PROTECTED_WEAKENING_FLAGS = Object.freeze([
  'fail_open',
  'disable_founder_gates',
  'allow_self_authority_expansion',
  'disable_security_kernel',
  'security_kernel_disabled',
  'disable_watchdog',
  'watchdog_disabled',
  'watchdog_fail_open',
  'disable_capability_policy',
  'capability_policy_disabled',
  'allow_authority_expansion',
  'allow_protected_governance_bypass',
  'bypass_protected_governance',
]);

const ZONE_RANK = Object.freeze({ GREEN: 1, AMBER: 2, RED: 3 });

function findProtectedWeakening(candidate = {}) {
  const reasons = [];

  for (const flag of PROTECTED_WEAKENING_FLAGS) {
    if (candidate?.[flag] === true) reasons.push(`PROTECTED_WEAKENING_FLAG:${flag}`);
  }

  if (candidate?.watchdog_required === false) reasons.push('WATCHDOG_REQUIREMENT_REMOVAL');
  if (candidate?.founder_gate_required === false) reasons.push('FOUNDER_GATE_REQUIREMENT_REMOVAL');
  if (candidate?.protected_governance_enabled === false) reasons.push('PROTECTED_GOVERNANCE_DISABLE');
  if (candidate?.security_kernel_required === false) reasons.push('SECURITY_KERNEL_REQUIREMENT_REMOVAL');

  const capabilityChanges = Array.isArray(candidate?.capability_policy_changes)
    ? candidate.capability_policy_changes
    : [];
  for (const change of capabilityChanges) {
    const fromZone = String(change?.from_zone || '').toUpperCase();
    const toZone = String(change?.to_zone || '').toUpperCase();
    if (ZONE_RANK[fromZone] && ZONE_RANK[toZone] && ZONE_RANK[toZone] < ZONE_RANK[fromZone]) {
      reasons.push(`CAPABILITY_ZONE_DOWNGRADE:${fromZone}->${toZone}`);
    }
    if (change?.founder_gate === false && fromZone === 'RED') {
      reasons.push('RED_CAPABILITY_FOUNDER_GATE_REMOVAL');
    }
    if (change?.self_grant === true || change?.allow_self_grant === true) {
      reasons.push('CAPABILITY_SELF_GRANT_ATTEMPT');
    }
  }

  const authorityChanges = Array.isArray(candidate?.authority_changes) ? candidate.authority_changes : [];
  for (const change of authorityChanges) {
    if (String(change?.actor || '').toLowerCase() === 'victor' && change?.expand === true) {
      reasons.push('VICTOR_SELF_AUTHORITY_EXPANSION_ATTEMPT');
    }
  }

  return [...new Set(reasons)];
}

export function securityControlRegistry(controls = []) {
  const normalized = controls.map((control) => ({
    id: String(control?.id || ''),
    version: String(control?.version || ''),
    mode: ['OBSERVE', 'ENFORCE'].includes(control?.mode) ? control.mode : 'OBSERVE',
    source: String(control?.source || 'internal'),
    capabilities: [...new Set((control?.capabilities || []).map(String))],
  })).filter((control) => control.id && control.version);
  return {
    framework_version: ADAPTIVE_SECURITY_VERSION,
    required_invariants: [...REQUIRED_INVARIANTS],
    controls: normalized,
  };
}

export function evaluateSecurityUpdateCandidate(candidate = {}) {
  const base = validateSecurityPolicyUpdate(candidate);
  if (!base.valid) return { decision: 'REJECT', reason: base.reason, founder_gate: true, protected_change: true };
  if (!candidate.control_id || !candidate.version) return { decision: 'REJECT', reason: 'CONTROL_ID_AND_VERSION_REQUIRED', founder_gate: true, protected_change: true };
  if (!Array.isArray(candidate.invariants_preserved)) return { decision: 'REJECT', reason: 'INVARIANT_ATTESTATION_REQUIRED', founder_gate: true, protected_change: true };
  const missing = REQUIRED_INVARIANTS.filter((item) => !candidate.invariants_preserved.includes(item));
  if (missing.length) return { decision: 'REJECT', reason: 'REQUIRED_INVARIANTS_MISSING', missing, founder_gate: true, protected_change: true };

  const protectedWeakening = findProtectedWeakening(candidate);
  if (protectedWeakening.length) {
    return {
      decision: 'REJECT',
      reason: 'PROTECTED_SELF_MODIFICATION_PROHIBITED',
      founder_gate: true,
      protected_change: true,
      blockers: protectedWeakening,
      required_tests: ['REGRESSION', 'RED_TEAM', 'FAIL_CLOSED', 'ROLLBACK'],
    };
  }

  const founderGate = Boolean(candidate.material_authority_change || candidate.security_boundary_change);
  return {
    decision: 'SANDBOX_TEST_REQUIRED',
    reason: 'ADAPTIVE_SECURITY_UPDATE_CANDIDATE',
    founder_gate: founderGate,
    protected_change: founderGate,
    required_tests: ['REGRESSION', 'RED_TEAM', 'FAIL_CLOSED', 'ROLLBACK'],
  };
}

export function buildSecurityUpdateReceipt({ candidate, tests = {}, approved_for_enforcement = false, founder_approved = false } = {}) {
  const evaluation = evaluateSecurityUpdateCandidate(candidate || {});
  const required = evaluation.required_tests || [];
  const passed = required.length > 0 && required.every((name) => tests?.[name] === true);
  const founderSatisfied = evaluation.founder_gate !== true || founder_approved === true;
  const canEnforce = evaluation.decision === 'SANDBOX_TEST_REQUIRED'
    && passed
    && approved_for_enforcement === true
    && founderSatisfied;
  return {
    framework_version: ADAPTIVE_SECURITY_VERSION,
    control_id: candidate?.control_id || null,
    candidate_version: candidate?.version || null,
    candidate_fingerprint: crypto.createHash('sha256').update(JSON.stringify(candidate || {})).digest('hex'),
    sandbox_tests_passed: passed,
    approved_for_enforcement: approved_for_enforcement === true,
    founder_approved: founder_approved === true,
    enforcement_allowed: canEnforce,
    production_applied: false,
    founder_gate: evaluation.founder_gate ?? true,
    protected_change: evaluation.protected_change ?? true,
    decision: canEnforce ? 'ENFORCEMENT_CANDIDATE_APPROVED' : 'NOT_ENFORCEABLE',
    evaluation,
  };
}
