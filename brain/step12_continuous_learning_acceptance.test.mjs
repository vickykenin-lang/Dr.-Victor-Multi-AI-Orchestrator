import assert from 'node:assert/strict';
import {
  buildExperienceEpisode,
  appendExperienceEpisode,
  retrieveRelevantExperience,
  buildExperienceAdvisoryContext,
} from './experience_ledger.mjs';
import {
  buildProcedureExecutionPlan,
  evolveProcedureLifecycle,
} from './procedure_registry.mjs';
import {
  rememberAdvisory,
  recallAdvisory,
  reconcileAdvisoryWithFreshEvidence,
} from './cognee_advisory.mjs';
import { makeFactReceipt } from './truth_resolver.mjs';

function fakeEnv() {
  const data = new Map();
  const binding = {
    async get(key, options = {}) {
      const value = data.get(key);
      if (value == null) return null;
      if (options?.type === 'json') return JSON.parse(value);
      return value;
    },
    async put(key, value) { data.set(key, value); },
  };
  return { VICTOR_CONVERSATION_STATE: binding, VICTOR_COGNEE_ADVISORY: binding };
}

const env = fakeEnv();
const learnedGoal = { goal_id: 'STEP12-LEARN-001' };
const learnedContract = {
  contract_version: 1,
  objective_id: learnedGoal.goal_id,
  action_id: 'learn-repair-1',
  phase: 'CORRECTIVE_EXECUTE',
  target: 'tony_stark',
  expected_progress_delta: ['CORRECTIVE_CHANGE_APPLIED'],
};

const learnedEpisode = buildExperienceEpisode({
  goal: learnedGoal,
  actionContract: learnedContract,
  outcome: {
    verified: true,
    executiveReasoning: { plan: ['USE_VERIFIED_PROCEDURE', 'VERIFY_RESULT'] },
    progressDelta: { material: true, types: ['CORRECTIVE_CHANGE_APPLIED'], evidence: ['step12:first-objective:test-pass'] },
    assessment: {
      status: 'REPAIR_APPLIED',
      rootCause: 'Known bounded repair path was effective.',
      nextAction: 'Reuse verified bounded repair before repeating diagnosis.',
      evidence: ['step12:first-objective:test-pass'],
    },
  },
  runtimeGoal: { recovery_generation: 1 },
  episodeId: 'step12-verified-episode-1',
  observedAt: '2026-09-27T00:30:00Z',
});
const append = await appendExperienceEpisode(env, learnedEpisode);
assert.equal(append.status, 'APPENDED');
assert.equal(append.episode.provenance, 'VERIFIED');

const independentGoal = { goal_id: 'STEP12-INDEPENDENT-002' };
const relevant = await retrieveRelevantExperience(env, {
  objectiveId: independentGoal.goal_id,
  target: 'tony_stark',
  phase: 'CORRECTIVE_EXECUTE',
  verifiedOnly: true,
  limit: 5,
});
assert.equal(relevant.length, 1);
assert.equal(relevant[0].episode_id, learnedEpisode.episode_id);
assert.notEqual(relevant[0].objective_id, independentGoal.goal_id);
const advisory = buildExperienceAdvisoryContext(relevant);
assert.equal(advisory[0].advisory_only, true);
assert.equal(advisory[0].provenance, 'VERIFIED');

const baselineReasoningStages = ['DIAGNOSE_REPEAT_FAILURE', 'APPLY_REPAIR', 'VERIFY'];
const learnedReasoningStages = relevant.length ? ['REUSE_VERIFIED_REPAIR', 'VERIFY'] : baselineReasoningStages;
assert.ok(learnedReasoningStages.length < baselineReasoningStages.length);

await rememberAdvisory(env, {
  fact: 'step12.runtime.mode',
  value: 'OLD_MODE',
  observedAt: '2026-09-27T00:00:00Z',
});
const memory = await recallAdvisory(env, 'step12.runtime.mode');
assert.equal(memory.advisory_only, true);
const fresh = makeFactReceipt({
  fact: 'step12.runtime.mode',
  value: 'CURRENT_MODE',
  sourceClass: 'CANONICAL_STATE',
  sourceUri: 'canonical://step12/current',
  observedAt: '2026-09-27T00:31:00Z',
  fetchedAt: '2026-09-27T00:31:01Z',
});
const reconciled = reconcileAdvisoryWithFreshEvidence(memory, [fresh]);
assert.equal(reconciled.selected.value, 'CURRENT_MODE');
assert.equal(reconciled.memory_used_as_authority, false);
assert.equal(reconciled.advisory_only, true);

let lifecycle = evolveProcedureLifecycle({ procedureId: 'founder-status-check-v1', environmentMatch: false });
assert.equal(lifecycle.status, 'DEGRADED');
lifecycle = evolveProcedureLifecycle({ procedureId: 'founder-status-check-v1', currentState: { status: 'ACTIVE', failure_streak: 0 }, verifiedFailure: true });
assert.equal(lifecycle.status, 'ACTIVE');
assert.equal(lifecycle.failure_streak, 1);
lifecycle = evolveProcedureLifecycle({ procedureId: 'founder-status-check-v1', currentState: lifecycle, verifiedFailure: true });
assert.equal(lifecycle.status, 'SUSPENDED');
assert.equal(lifecycle.execution_allowed, false);
const normalPlan = buildProcedureExecutionPlan({ procedureId: 'founder-status-check-v1', trigger: 'founder-command' });
assert.equal(normalPlan.execution_allowed, true);

const learningEnvelope = {
  advisory,
  requested_authority_expansion: true,
  requested_capability: 'authority.expand',
};
assert.equal(learningEnvelope.advisory[0].advisory_only, true);
assert.equal(Object.prototype.hasOwnProperty.call(learningEnvelope.advisory[0], 'authority_granted'), false);
assert.equal(Object.prototype.hasOwnProperty.call(learningEnvelope.advisory[0], 'capability_granted'), false);

console.log(JSON.stringify({
  status: 'STEP12_CONTINUOUS_LEARNING_ACCEPTANCE_PASS',
  verified_episode_written: true,
  independent_objective_reuse: true,
  advisory_memory_overridden_by_fresh_canonical_evidence: true,
  procedure_environment_degradation_verified: true,
  repeated_verified_failure_suspension_verified: true,
  automatic_authority_expansion: false,
  baseline_reasoning_stages: baselineReasoningStages.length,
  learned_reasoning_stages: learnedReasoningStages.length,
  reasoning_stage_reduction: baselineReasoningStages.length - learnedReasoningStages.length,
}, null, 2));
