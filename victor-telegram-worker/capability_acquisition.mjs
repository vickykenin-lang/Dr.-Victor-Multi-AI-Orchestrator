import { getCapability, listCapabilities } from './capability_registry.mjs';

const ACQUISITION_VERSION = 'VICTOR_CAPABILITY_ACQUISITION_V1';

export function buildCapabilityGapPlan(request = {}) {
  const desired = String(request.capability_id || request.capability || '').trim();
  const known = desired ? getCapability(desired) : null;
  const available = listCapabilities().filter(c => c.available);
  const alternatives = available
    .filter(c => !known || c.kind === known.kind || c.mode === 'read')
    .slice(0, 5)
    .map(c => c.id);

  return {
    version: ACQUISITION_VERSION,
    state: known?.available ? 'CAPABILITY_AVAILABLE' : 'CAPABILITY_GAP',
    requested_capability: desired || null,
    known_capability: known || null,
    alternatives,
    acquisition_sequence: known?.available ? [] : [
      'SEARCH_EXISTING_ALTERNATE_CAPABILITY',
      'DISCOVER_EXTERNAL_PROVIDER_OR_CONNECTOR',
      'ASSESS_AUTH_CREDENTIAL_SPEND_REQUIREMENTS',
      'BUILD_ADAPTER_OR_SPECIALIST_AGENT_IF_NEEDED',
      'SANDBOX_OR_STAGING_TEST',
      'VERIFY_INPUT_OUTPUT_AND_FAILURE_BEHAVIOR',
      'REGISTER_REUSABLE_CAPABILITY_AFTER_VERIFICATION',
      'REQUEST_FOUNDER_AUTHORIZATION_ONLY_IF_EXTERNAL_AUTHORITY_IS_REQUIRED',
      'RESUME_ORIGINAL_TASK',
    ],
    sandbox_required: !known?.available,
    production_apply_allowed: false,
    founder_authorization_required_for: [
      'external account authorization',
      'new credential/secret',
      'paid subscription or spend',
      'destructive operation',
      'security weakening',
      'authority expansion',
      'RED production action',
    ],
    truthful_completion_rule: 'DO_NOT_MARK_ORIGINAL_TASK_COMPLETED_UNTIL_OUTPUT_IS_VERIFIED',
  };
}

export function canSelfAcquire(plan = {}) {
  if (plan.state !== 'CAPABILITY_GAP') return false;
  return plan.production_apply_allowed === false;
}
