import crypto from 'node:crypto';
import { validateSecurityPolicyUpdate } from './security_kernel.mjs';

export const ADAPTIVE_SECURITY_VERSION = 'victor-adaptive-security-v1';

const REQUIRED_INVARIANTS = Object.freeze([
  'FAIL_CLOSED',
  'NO_SELF_AUTHORITY_EXPANSION',
  'FOUNDER_GATES_PRESERVED',
  'NO_MASTER_SECRET_EXPOSURE',
  'SANDBOX_BEFORE_UNTRUSTED_EXECUTION',
  'EVIDENCE_STAGE_SEPARATION',
]);

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
  if (!base.valid) return { decision: 'REJECT', reason: base.reason, founder_gate: true };
  if (!candidate.control_id || !candidate.version) return { decision: 'REJECT', reason: 'CONTROL_ID_AND_VERSION_REQUIRED', founder_gate: true };
  if (!Array.isArray(candidate.invariants_preserved)) return { decision: 'REJECT', reason: 'INVARIANT_ATTESTATION_REQUIRED', founder_gate: true };
  const missing = REQUIRED_INVARIANTS.filter((item) => !candidate.invariants_preserved.includes(item));
  if (missing.length) return { decision: 'REJECT', reason: 'REQUIRED_INVARIANTS_MISSING', missing, founder_gate: true };
  return {
    decision: 'SANDBOX_TEST_REQUIRED',
    reason: 'ADAPTIVE_SECURITY_UPDATE_CANDIDATE',
    founder_gate: Boolean(candidate.material_authority_change || candidate.security_boundary_change),
    required_tests: ['REGRESSION', 'RED_TEAM', 'FAIL_CLOSED', 'ROLLBACK'],
  };
}

export function buildSecurityUpdateReceipt({ candidate, tests = {}, approved_for_enforcement = false } = {}) {
  const evaluation = evaluateSecurityUpdateCandidate(candidate || {});
  const required = evaluation.required_tests || [];
  const passed = required.length > 0 && required.every((name) => tests?.[name] === true);
  const canEnforce = evaluation.decision === 'SANDBOX_TEST_REQUIRED' && passed && approved_for_enforcement === true;
  return {
    framework_version: ADAPTIVE_SECURITY_VERSION,
    control_id: candidate?.control_id || null,
    candidate_version: candidate?.version || null,
    candidate_fingerprint: crypto.createHash('sha256').update(JSON.stringify(candidate || {})).digest('hex'),
    sandbox_tests_passed: passed,
    enforcement_allowed: canEnforce,
    founder_gate: evaluation.founder_gate ?? true,
    decision: canEnforce ? 'ENFORCEMENT_CANDIDATE_APPROVED' : 'NOT_ENFORCEABLE',
    evaluation,
  };
}
