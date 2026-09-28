import test from 'node:test';
import assert from 'node:assert/strict';
import { getCapability, registryHealth, listCapabilities } from './capability_registry.mjs';
import { buildCapabilityGapPlan, acquireCapability } from './capability_acquisition.mjs';
import { providerStatus, providerCatalog } from './capability_provider_runtime.mjs';
import { createCapabilityTask, readCapabilityTask, transitionCapabilityTask } from './capability_task_state.mjs';
import { routeDeterministically } from './single_router.mjs';

function mockKv() {
  const m = new Map();
  return { async get(k) { return m.get(k) ?? null; }, async put(k, v) { m.set(k, v); } };
}

test('registry distinguishes Worker-runtime execution from operator control-plane access', () => {
  assert.equal(getCapability('github')?.available, false);
  assert.equal(getCapability('github')?.control_plane_available, true);
  assert.equal(getCapability('cloudflare')?.runtime_execute, false);
  assert.equal(getCapability('department.rio.read')?.available, true);
  assert.ok(listCapabilities().length >= 10);
  assert.equal(registryHealth().authority_model, 'CAPABILITY_DOES_NOT_SELF_GRANT_EXTERNAL_AUTHORITY');
});

test('missing media capability produces sandbox-first acquisition plan, not false completion', () => {
  const plan = buildCapabilityGapPlan({ capability_id: 'video_generation' });
  assert.equal(plan.state, 'CAPABILITY_GAP');
  assert.equal(plan.sandbox_required, true);
  assert.equal(plan.production_apply_allowed, false);
  assert.ok(plan.acquisition_sequence.includes('DISCOVER_REGISTERED_PROVIDER_OR_CONNECTOR'));
  assert.ok(plan.acquisition_sequence.includes('SANDBOX_OR_STAGING_TEST'));
  assert.equal(plan.truthful_completion_rule, 'DO_NOT_MARK_ORIGINAL_TASK_COMPLETED_UNTIL_OUTPUT_IS_VERIFIED');
});

test('department runtime capability remains directly available', () => {
  const plan = buildCapabilityGapPlan({ capability_id: 'department.rio.read' });
  assert.equal(plan.state, 'CAPABILITY_AVAILABLE');
  assert.deepEqual(plan.acquisition_sequence, []);
});

test('external provider contract reports exact missing binding without pretending installation', () => {
  const s = providerStatus({}, 'image_generation');
  assert.equal(s.state, 'NEEDS_ADAPTER_ENDPOINT');
  assert.equal(s.endpoint_env, 'VICTOR_IMAGE_ADAPTER_URL');
  assert.ok(providerCatalog().some(p => p.capability_id === 'video_generation'));
  assert.ok(providerCatalog().some(p => p.capability_id === 'github'));
});

test('capability task state is resumable and transition controlled', async () => {
  const env = { VICTOR_CONVERSATION_STATE: mockKv() };
  await createCapabilityTask(env, { taskId: 't1', text: 'make a reel', capabilityId: 'video_generation' });
  await transitionCapabilityTask(env, 't1', 'PLANNED');
  await transitionCapabilityTask(env, 't1', 'CAPABILITY_GAP');
  const state = await readCapabilityTask(env, 't1');
  assert.equal(state.state, 'CAPABILITY_GAP');
  await assert.rejects(() => transitionCapabilityTask(env, 't1', 'COMPLETED'), /INVALID_CAPABILITY_TASK_TRANSITION/);
});

test('acquisition persists WAITING_AUTH instead of false completion when adapter is missing', async () => {
  const env = { VICTOR_CONVERSATION_STATE: mockKv() };
  const result = await acquireCapability(env, { taskId: 't2', text: 'generate an image', capabilityId: 'image_generation' });
  assert.equal(result.state, 'WAITING_AUTH');
  assert.equal(result.resume, false);
  assert.equal(result.task.state, 'WAITING_AUTH');
  assert.equal(result.task.requested_capability, 'image_generation');
});

test('external authority remains Founder-gated during acquisition', () => {
  const plan = buildCapabilityGapPlan({ capability_id: 'image_generation' });
  for (const boundary of ['new credential/secret', 'paid subscription or spend', 'destructive operation', 'authority expansion', 'RED production action']) assert.ok(plan.founder_authorization_required_for.includes(boundary));
});

test('hard deterministic controls remain available while normal chat defaults to chat', () => {
  assert.equal(routeDeterministically('STOP').type, 'STOP');
  assert.equal(routeDeterministically('Aaj kya date hai?').type, 'CHAT');
  assert.equal(routeDeterministically('Hi Victor').type, 'CHAT');
  assert.equal(routeDeterministically('To ek kaam karo bhag jao yaha se').type, 'CHAT');
});
