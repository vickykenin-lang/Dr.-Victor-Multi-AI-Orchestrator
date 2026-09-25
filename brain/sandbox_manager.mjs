import crypto from 'node:crypto';

export const SANDBOX_PROFILE_VERSION = 'victor-sandbox-v1';

export function createSandboxSpec({ objective_id, action_id, requested_tools = [], network_allowlist = [], budgets = {} } = {}) {
  if (!objective_id || !action_id) throw new Error('objective_id and action_id are required');
  const sandbox_id = `sbx_${crypto.createHash('sha256').update(`${objective_id}:${action_id}`).digest('hex').slice(0, 16)}`;
  const normalizedTools = [...new Set(requested_tools.map(String))].filter(Boolean);
  const normalizedNetwork = [...new Set(network_allowlist.map(String))].filter(Boolean);

  return {
    schema_version: 1,
    profile_version: SANDBOX_PROFILE_VERSION,
    sandbox_id,
    objective_id,
    action_id,
    lifecycle: 'DISPOSABLE',
    filesystem: { mode: 'ISOLATED_EPHEMERAL', persist_after_teardown: false },
    git: { protected_branch_write: false, isolated_branch_only: true },
    credentials: { master_credentials_available: false, production_credentials_available: false, secret_handles_only: true },
    network: { default: 'DENY', allowlist: normalizedNetwork },
    tools: normalizedTools,
    budgets: {
      runtime_seconds: Math.max(1, Math.min(Number(budgets.runtime_seconds || 900), 3600)),
      retry_count: Math.max(0, Math.min(Number(budgets.retry_count ?? 3), 10)),
      external_calls: Math.max(0, Math.min(Number(budgets.external_calls ?? 25), 200)),
      storage_mb: Math.max(16, Math.min(Number(budgets.storage_mb || 512), 4096)),
      spend_units: Math.max(0, Math.min(Number(budgets.spend_units || 0), 1000)),
    },
    evidence_export_required: true,
    teardown_required: true,
  };
}

export function validateSandboxSpec(spec = {}) {
  if (spec?.profile_version !== SANDBOX_PROFILE_VERSION) return { valid: false, reason: 'UNSUPPORTED_SANDBOX_PROFILE' };
  if (spec?.credentials?.master_credentials_available !== false) return { valid: false, reason: 'MASTER_CREDENTIAL_EXPOSURE_PROHIBITED' };
  if (spec?.credentials?.production_credentials_available !== false) return { valid: false, reason: 'PRODUCTION_CREDENTIAL_EXPOSURE_PROHIBITED' };
  if (spec?.network?.default !== 'DENY') return { valid: false, reason: 'NETWORK_DEFAULT_DENY_REQUIRED' };
  if (spec?.git?.protected_branch_write !== false) return { valid: false, reason: 'PROTECTED_BRANCH_WRITE_PROHIBITED' };
  if (spec?.lifecycle !== 'DISPOSABLE' || spec?.teardown_required !== true) return { valid: false, reason: 'DISPOSABLE_TEARDOWN_REQUIRED' };
  return { valid: true, reason: 'SANDBOX_SPEC_VALID' };
}

export function evaluateSandboxBudget({ spec, usage = {} } = {}) {
  const check = validateSandboxSpec(spec);
  if (!check.valid) return { allowed: false, safe_hold: true, reason: check.reason };
  const limits = spec.budgets || {};
  const exceeded = [];
  if (Number(usage.runtime_seconds || 0) > limits.runtime_seconds) exceeded.push('RUNTIME');
  if (Number(usage.retry_count || 0) > limits.retry_count) exceeded.push('RETRIES');
  if (Number(usage.external_calls || 0) > limits.external_calls) exceeded.push('EXTERNAL_CALLS');
  if (Number(usage.storage_mb || 0) > limits.storage_mb) exceeded.push('STORAGE');
  if (Number(usage.spend_units || 0) > limits.spend_units) exceeded.push('SPEND');
  return exceeded.length
    ? { allowed: false, safe_hold: true, reason: 'SANDBOX_BUDGET_EXCEEDED', exceeded }
    : { allowed: true, safe_hold: false, reason: 'WITHIN_SANDBOX_BUDGET', exceeded: [] };
}

export function buildSandboxEvidenceReceipt({ spec, status, evidence_refs = [], patch_ref = null } = {}) {
  const check = validateSandboxSpec(spec);
  if (!check.valid) throw new Error(check.reason);
  return {
    schema_version: 1,
    sandbox_id: spec.sandbox_id,
    objective_id: spec.objective_id,
    action_id: spec.action_id,
    status: String(status || 'UNKNOWN'),
    evidence_refs: [...new Set(evidence_refs.map(String))],
    patch_ref,
    production_applied: false,
    promotion_required: true,
    teardown_required: true,
  };
}
