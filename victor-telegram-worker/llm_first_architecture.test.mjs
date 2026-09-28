import test from 'node:test';
import assert from 'node:assert/strict';
import { getCapability, registryHealth, listCapabilities } from './capability_registry.mjs';
import { buildCapabilityGapPlan } from './capability_acquisition.mjs';
import { routeDeterministically } from './single_router.mjs';

test('capability registry exposes reusable existing capabilities', () => {
  assert.equal(getCapability('github')?.available, true);
  assert.equal(getCapability('cloudflare')?.available, true);
  assert.equal(getCapability('department.rio.read')?.risk, 'GREEN');
  assert.ok(listCapabilities().length >= 10);
  assert.equal(registryHealth().authority_model, 'CAPABILITY_DOES_NOT_SELF_GRANT_EXTERNAL_AUTHORITY');
});

test('missing media capability produces sandbox-first acquisition plan, not false completion', () => {
  const plan = buildCapabilityGapPlan({ capability_id: 'video_generation' });
  assert.equal(plan.state, 'CAPABILITY_GAP');
  assert.equal(plan.sandbox_required, true);
  assert.equal(plan.production_apply_allowed, false);
  assert.ok(plan.acquisition_sequence.includes('DISCOVER_EXTERNAL_PROVIDER_OR_CONNECTOR'));
  assert.ok(plan.acquisition_sequence.includes('SANDBOX_OR_STAGING_TEST'));
  assert.equal(plan.truthful_completion_rule, 'DO_NOT_MARK_ORIGINAL_TASK_COMPLETED_UNTIL_OUTPUT_IS_VERIFIED');
});

test('existing capability does not trigger acquisition', () => {
  const plan = buildCapabilityGapPlan({ capability_id: 'github' });
  assert.equal(plan.state, 'CAPABILITY_AVAILABLE');
  assert.deepEqual(plan.acquisition_sequence, []);
});

test('external authority remains Founder-gated during acquisition', () => {
  const plan = buildCapabilityGapPlan({ capability_id: 'image_generation' });
  for (const boundary of ['new credential/secret', 'paid subscription or spend', 'destructive operation', 'authority expansion', 'RED production action']) {
    assert.ok(plan.founder_authorization_required_for.includes(boundary));
  }
});

test('hard deterministic controls remain available while normal chat defaults to chat', () => {
  assert.equal(routeDeterministically('STOP').type, 'STOP');
  assert.equal(routeDeterministically('Aaj kya date hai?').type, 'CHAT');
  assert.equal(routeDeterministically('Hi Victor').type, 'CHAT');
  assert.equal(routeDeterministically('To ek kaam karo bhag jao yaha se').type, 'CHAT');
});
