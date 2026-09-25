export const ROLLBACK_CONTRACT_VERSION = 'victor-rollback-v1';

export function createRollbackContract({ previous_version, target_version, rollback_action, verification_probes = [], reversible = true } = {}) {
  if (!previous_version || !target_version || !rollback_action) throw new Error('previous_version, target_version and rollback_action are required');
  return {
    schema_version: 1,
    contract_version: ROLLBACK_CONTRACT_VERSION,
    previous_version: String(previous_version),
    target_version: String(target_version),
    rollback_action: String(rollback_action),
    reversible: reversible === true,
    verification_probes: [...new Set(verification_probes.map(String))].filter(Boolean),
    automatic_rollback_allowed: reversible === true,
  };
}

export function validateRollbackContract(contract = {}) {
  if (contract?.contract_version !== ROLLBACK_CONTRACT_VERSION) return { valid: false, reason: 'UNSUPPORTED_ROLLBACK_CONTRACT' };
  if (!contract.previous_version || !contract.target_version || !contract.rollback_action) return { valid: false, reason: 'ROLLBACK_FIELDS_MISSING' };
  if (contract.reversible !== true || contract.automatic_rollback_allowed !== true) return { valid: false, reason: 'REVERSIBLE_ROLLBACK_REQUIRED' };
  if (!Array.isArray(contract.verification_probes) || contract.verification_probes.length === 0) return { valid: false, reason: 'ROLLBACK_VERIFICATION_PROBE_REQUIRED' };
  return { valid: true, reason: 'ROLLBACK_CONTRACT_VALID' };
}
