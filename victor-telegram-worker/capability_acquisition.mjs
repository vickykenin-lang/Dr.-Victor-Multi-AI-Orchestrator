import { getCapability, listCapabilities } from './capability_registry.mjs';
import { providerStatus, verifyProvider } from './capability_provider_runtime.mjs';
import { createCapabilityTask, readCapabilityTask, transitionCapabilityTask } from './capability_task_state.mjs';

export const ACQUISITION_VERSION = 'VICTOR_CAPABILITY_ACQUISITION_V2';

export function buildCapabilityGapPlan(request = {}) {
  const desired = String(request.capability_id || request.capability || '').trim();
  const known = desired ? getCapability(desired) : null;
  const available = listCapabilities().filter(c => c.available);
  const alternatives = available.filter(c => !known || c.kind === known.kind || c.mode === 'read').slice(0, 6).map(c => c.id);
  return {
    version: ACQUISITION_VERSION,
    state: known?.available ? 'CAPABILITY_AVAILABLE' : 'CAPABILITY_GAP',
    requested_capability: desired || null,
    known_capability: known || null,
    alternatives,
    acquisition_sequence: known?.available ? [] : [
      'SEARCH_EXISTING_ALTERNATE_CAPABILITY', 'DISCOVER_REGISTERED_PROVIDER_OR_CONNECTOR',
      'ASSESS_AUTH_CREDENTIAL_SPEND_REQUIREMENTS', 'STAGE_ADAPTER_OR_SPECIALIST_WORKFLOW',
      'SANDBOX_OR_STAGING_TEST', 'VERIFY_INPUT_OUTPUT_AND_FAILURE_BEHAVIOR',
      'REGISTER_REUSABLE_CAPABILITY_AFTER_VERIFICATION', 'RESUME_ORIGINAL_TASK',
    ],
    sandbox_required: !known?.available,
    production_apply_allowed: false,
    founder_authorization_required_for: ['external account authorization', 'new credential/secret', 'paid subscription or spend', 'destructive operation', 'security weakening', 'authority expansion', 'RED production action'],
    truthful_completion_rule: 'DO_NOT_MARK_ORIGINAL_TASK_COMPLETED_UNTIL_OUTPUT_IS_VERIFIED',
  };
}

export function canSelfAcquire(plan = {}) {
  return plan.state === 'CAPABILITY_GAP' && plan.production_apply_allowed === false;
}

export async function acquireCapability(env, { taskId, text, capabilityId, risk = 'GREEN' } = {}) {
  let task = await readCapabilityTask(env, taskId);
  if (!task) task = await createCapabilityTask(env, { taskId, text, capabilityId, risk });
  if (task.state === 'RECEIVED') task = await transitionCapabilityTask(env, taskId, 'PLANNED');

  const known = getCapability(capabilityId);
  if (known?.available) {
    if (task.state === 'PLANNED') task = await transitionCapabilityTask(env, taskId, 'RESUMED', { note: 'CAPABILITY_ALREADY_AVAILABLE' });
    return { state: 'RESUMED', task, capability: known, resume: true, verified_provider: true };
  }

  if (task.state === 'PLANNED') task = await transitionCapabilityTask(env, taskId, 'CAPABILITY_GAP', { acquisition_plan: buildCapabilityGapPlan({ capability_id: capabilityId }) });
  if (task.state === 'CAPABILITY_GAP') task = await transitionCapabilityTask(env, taskId, 'ACQUIRING');

  const provider = providerStatus(env, capabilityId);
  if (!provider.registered || !provider.configured) {
    const authLikely = Boolean(provider.registered && provider.token_env);
    task = await transitionCapabilityTask(env, taskId, 'WAITING_AUTH', {
      provider,
      note: authLikely ? 'PROVIDER_ADAPTER_OR_CREDENTIAL_REQUIRED' : 'NO_PROVIDER_CONTRACT',
      required_founder_input: provider.registered ? { endpoint_binding: provider.endpoint_env, optional_secret_binding: provider.token_env } : null,
    });
    return { state: 'WAITING_AUTH', task, provider, resume: false, verified_provider: false };
  }

  task = await transitionCapabilityTask(env, taskId, 'STAGED', { provider });
  const verification = await verifyProvider(env, capabilityId);
  if (!verification.verified) {
    task = await transitionCapabilityTask(env, taskId, 'FAILED', { verification, note: 'PROVIDER_HEALTH_VERIFICATION_FAILED' });
    return { state: 'FAILED', task, provider, verification, resume: false, verified_provider: false };
  }
  task = await transitionCapabilityTask(env, taskId, 'VERIFIED', { verification });
  task = await transitionCapabilityTask(env, taskId, 'RESUMED', { note: 'CAPABILITY_VERIFIED_AND_TASK_RESUMED' });
  return { state: 'RESUMED', task, provider, verification, resume: true, verified_provider: true };
}
