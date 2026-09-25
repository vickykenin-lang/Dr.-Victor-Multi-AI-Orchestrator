import { evaluateEndgameRuntime } from '../brain/endgame_runtime_gate.mjs';
import {
  experienceLedgerCapability,
  buildExperienceEpisode,
  appendExperienceEpisode,
  readExperienceEpisode,
  buildExperienceAdvisoryContext,
} from '../brain/experience_ledger.mjs';
import { cogneeMemoryStatus, cogneeRecall } from './cognee_memory_bridge.mjs';

const PROCEDURE_ID = 'founder-status-check-v1';
const TRIGGER = 'founder-command';

function bool(value) { return value === true; }

export function endgameRuntimeHealth(env = {}, now = new Date().toISOString()) {
  const runtime = evaluateEndgameRuntime({
    llmAvailable: false,
    procedureId: PROCEDURE_ID,
    trigger: TRIGGER,
    objectiveId: 'ENDGAME-PACKAGE2-HEALTH',
    actionId: 'ENDGAME-PACKAGE2-HEALTH',
    now,
  });
  const ledger = experienceLedgerCapability(env);
  const cognee = cogneeMemoryStatus(env);
  const ready = runtime.execution_allowed === true
    && runtime.mode === 'DEGRADED_VERIFIED_PROCEDURE'
    && runtime.manual_trigger_only === true
    && runtime.event?.surface === 'LIVE';
  return {
    schema_version: 1,
    service: 'victor-endgame-runtime',
    status: ready ? 'READY' : 'SAFE_HOLD',
    verified_procedure: runtime.procedure?.procedure?.id || PROCEDURE_ID,
    degraded_mode: runtime.mode,
    execution_allowed: bool(runtime.execution_allowed),
    manual_trigger_only: bool(runtime.manual_trigger_only),
    truthful_telemetry_surface: runtime.event?.surface || 'UNKNOWN',
    experience_ledger_available: bool(ledger.available),
    experience_ledger_durable: bool(ledger.durable),
    cognee_memory_status: cognee.status,
    cognee_dataset: cognee.dataset || null,
    production_autonomy_enabled: false,
    secrets_exposed: false,
  };
}

export async function runEndgameRuntimeAcceptance(env = {}, options = {}) {
  const traceId = String(options.traceId || Date.now());
  const now = options.now || new Date().toISOString();
  const objectiveId = 'ENDGAME-PACKAGE2-LIVE';
  const actionId = `pkg2:${traceId}`;
  const runtime = evaluateEndgameRuntime({
    llmAvailable: false,
    procedureId: PROCEDURE_ID,
    trigger: TRIGGER,
    objectiveId,
    actionId,
    now,
  });

  const actionContract = {
    action_id: actionId,
    objective_id: objectiveId,
    target: 'internal',
    phase: 'SYSTEM_TEST',
    trigger: TRIGGER,
    expected_progress_delta: ['verify live package-2 runtime path'],
  };
  const episode = buildExperienceEpisode({
    goal: { goal_id: objectiveId },
    actionContract,
    outcome: {
      verified: true,
      assessment: {
        status: 'VERIFIED',
        evidence: [`runtime:${traceId}`],
        goalAchieved: false,
        hasBlocker: false,
      },
      progressDelta: {
        material: true,
        reason: 'PACKAGE2_LIVE_ACCEPTANCE',
        evidence: [`runtime:${traceId}`],
      },
    },
    runtimeGoal: { recovery_generation: 0 },
    episodeId: `ENDGAME-PACKAGE2-LIVE:${traceId}`,
    observedAt: now,
  });

  const ledgerWrite = await appendExperienceEpisode(env, episode);
  const readback = await readExperienceEpisode(env, episode.episode_id);
  const advisory = buildExperienceAdvisoryContext(readback ? [readback] : []);
  const ledgerRoundTrip = Boolean(readback?.episode_id === episode.episode_id && advisory?.[0]?.episode_id === episode.episode_id);

  const cogneeStatus = cogneeMemoryStatus(env);
  let cognee = { ...cogneeStatus, results: [] };
  if (cogneeStatus.status === 'CONFIGURED') {
    cognee = await cogneeRecall(env, options.query || 'Falcon validation code', { topK: 5, timeoutMs: 10000 });
  }
  const semanticRoundTrip = cognee.status === 'RECALLED' && Array.isArray(cognee.results) && cognee.results.length > 0;
  const procedureOk = runtime.execution_allowed === true
    && runtime.mode === 'DEGRADED_VERIFIED_PROCEDURE'
    && runtime.manual_trigger_only === true;
  const telemetryOk = runtime.event?.surface === 'LIVE';
  const pass = procedureOk && telemetryOk && ledgerRoundTrip && semanticRoundTrip;

  return {
    schema_version: 1,
    status: pass ? 'PASS' : 'BLOCKED',
    procedure_registry_live: procedureOk,
    degraded_mode_live: procedureOk,
    truthful_telemetry_live: telemetryOk,
    experience_ledger_write_status: ledgerWrite.status,
    experience_ledger_readback_verified: ledgerRoundTrip,
    experience_advisory_reuse_verified: ledgerRoundTrip,
    cognee_status: cognee.status || 'UNKNOWN',
    cognee_result_count: Array.isArray(cognee.results) ? cognee.results.length : 0,
    cognee_semantic_roundtrip_verified: semanticRoundTrip,
    manual_trigger_only: runtime.manual_trigger_only === true,
    production_autonomy_enabled: false,
    blockers: [
      !procedureOk ? 'VERIFIED_PROCEDURE_OR_DEGRADED_MODE_NOT_LIVE' : null,
      !telemetryOk ? 'TRUTHFUL_TELEMETRY_NOT_FRESH' : null,
      !ledgerRoundTrip ? 'EXPERIENCE_LEDGER_ROUNDTRIP_NOT_VERIFIED' : null,
      !semanticRoundTrip ? 'COGNEE_SEMANTIC_ROUNDTRIP_NOT_VERIFIED' : null,
    ].filter(Boolean),
    evidence: {
      procedure_id: runtime.procedure?.procedure?.id || PROCEDURE_ID,
      telemetry_event_id: runtime.event?.event_id || null,
      episode_id: episode.episode_id,
      cognee_dataset: cognee.dataset || cogneeStatus.dataset || null,
    },
    secrets_exposed: false,
  };
}
