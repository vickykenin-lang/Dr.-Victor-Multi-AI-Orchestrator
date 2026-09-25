import test from 'node:test';
import assert from 'node:assert/strict';

import {
  experienceLedgerCapability,
  sanitizeExperienceValue,
  buildExperienceEpisode,
  validateExperienceEpisode,
  appendExperienceEpisode,
  readExperienceEpisode,
  retrieveRecentExperience,
  buildExperienceAdvisoryContext,
} from './experience_ledger.mjs';

function fakeEnv() {
  const data = new Map();
  return {
    __data: data,
    VICTOR_CONVERSATION_STATE: {
      async get(key, options = {}) {
        const value = data.get(key);
        if (value == null) return null;
        if (options?.type === 'json') return JSON.parse(value);
        return value;
      },
      async put(key, value) { data.set(key, value); },
    },
  };
}

const goal = {
  goal_id: 'ORG-REVENUE-001',
  objective: 'Generate verified real affiliate revenue.',
};

const contract = {
  contract_version: 1,
  objective_id: 'ORG-REVENUE-001',
  action_id: 'act-1',
  phase: 'CORRECTIVE_EXECUTE',
  target: 'tony_stark',
  expected_progress_delta: ['CORRECTIVE_CHANGE_APPLIED'],
  requested_actions: ['READ_REPOSITORY', 'ANALYZE', 'PROPOSE_OR_APPLY_CODE_CHANGE_SUBJECT_TO_AUTHORITY', 'RUN_TESTS', 'RETURN_EVIDENCE'],
  mutation_allowed: true,
  production_allowed: false,
  spend_allowed: false,
};

test('experience ledger requires durable store', () => {
  assert.equal(experienceLedgerCapability({}).available, false);
  assert.equal(experienceLedgerCapability(fakeEnv()).available, true);
});

test('secret-like fields and values are redacted before persistence', () => {
  const value = sanitizeExperienceValue({
    api_key: 'BedrockAPIKey-THIS_SHOULD_NOT_PERSIST',
    note: 'Authorization Bearer abcdefghijklmnopqrstuvwxyz',
    github: ['ghp_', 'abcdefghijklmnopqrstuvwxyz123456'].join(''),
  });
  assert.equal(value.api_key, '[REDACTED]');
  assert.doesNotMatch(value.note, /Bearer\s+abcdefghijklmnopqrstuvwxyz/);
  assert.equal(value.github, '[REDACTED]');
});

test('builds evidence-backed episode with expected vs actual progress', () => {
  const episode = buildExperienceEpisode({
    goal,
    actionContract: contract,
    outcome: {
      verified: true,
      progressDelta: { material: true, types: ['CORRECTIVE_CHANGE_APPLIED'], evidence: ['tests.json'] },
      assessment: {
        status: 'REPAIR_APPLIED',
        evidence: ['repair.json', 'tests.json'],
        goalAchieved: false,
        founderGate: false,
        hasBlocker: false,
      },
    },
    runtimeGoal: { recovery_generation: 2 },
    episodeId: 'episode-1',
    observedAt: '2026-09-22T19:30:00Z',
  });
  assert.equal(episode.provenance, 'VERIFIED');
  assert.deepEqual(episode.expected_progress_delta, ['CORRECTIVE_CHANGE_APPLIED']);
  assert.equal(episode.actual_progress_delta.material, true);
  assert.equal(episode.outcome.material_progress, true);
  assert.equal(validateExperienceEpisode(episode).ok, true);
});

test('Founder-confirmed correction is retained with scoped provenance', () => {
  const episode = buildExperienceEpisode({
    goal,
    actionContract: contract,
    outcome: {
      verified: true,
      progressDelta: { material: true, types: ['CORRECTIVE_CHANGE_APPLIED'], evidence: ['e.json'] },
      assessment: { status: 'REPAIR_APPLIED', evidence: ['e.json'] },
    },
    runtimeGoal: {},
    founderGuidance: {
      guidance_id: 'g-1',
      scope: 'GOAL',
      answer: 'Prioritize verified conversion evidence.',
      provenance: 'FOUNDER_CONFIRMED',
      answered_at_utc: '2026-09-22T19:00:00Z',
    },
    episodeId: 'episode-guided',
  });
  assert.equal(episode.founder_correction.provenance, 'FOUNDER_CONFIRMED');
  assert.equal(episode.founder_correction.scope, 'GOAL');
});

test('append is immutable and duplicate episode id is not overwritten', async () => {
  const env = fakeEnv();
  const episode = buildExperienceEpisode({
    goal,
    actionContract: contract,
    outcome: { verified: true, progressDelta: { material: false, types: [], evidence: [] }, assessment: { status: 'NO_PROGRESS', evidence: ['a.json'] } },
    runtimeGoal: {},
    episodeId: 'episode-immutable',
  });
  const first = await appendExperienceEpisode(env, episode);
  assert.equal(first.status, 'APPENDED');

  const changed = { ...episode, observations: { department_status: 'MUTATED' } };
  const second = await appendExperienceEpisode(env, changed);
  assert.equal(second.status, 'ALREADY_EXISTS');
  const stored = await readExperienceEpisode(env, 'episode-immutable');
  assert.notEqual(stored.observations.department_status, 'MUTATED');
});

test('recent episodes are retrievable and transformed to advisory-only context', async () => {
  const env = fakeEnv();
  for (let i = 1; i <= 3; i += 1) {
    const episode = buildExperienceEpisode({
      goal,
      actionContract: { ...contract, action_id: `act-${i}` },
      outcome: {
        verified: true,
        progressDelta: { material: i === 3, types: i === 3 ? ['CORRECTIVE_CHANGE_APPLIED'] : [], evidence: [`e-${i}.json`] },
        assessment: { status: i === 3 ? 'REPAIR_APPLIED' : 'NO_PROGRESS', evidence: [`e-${i}.json`] },
      },
      runtimeGoal: { recovery_generation: i },
      episodeId: `episode-${i}`,
    });
    await appendExperienceEpisode(env, episode);
  }

  const episodes = await retrieveRecentExperience(env, goal.goal_id, { limit: 2 });
  assert.deepEqual(episodes.map(x => x.episode_id), ['episode-3', 'episode-2']);
  const advisory = buildExperienceAdvisoryContext(episodes);
  assert.equal(advisory.length, 2);
  assert.equal(advisory[0].advisory_only, true);
  assert.equal(advisory[0].actual_progress_delta.material, true);
});
