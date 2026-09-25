import {buildProcedureExecutionPlan} from "./procedure_registry.mjs";
import {resolveDegradedMode} from "./degraded_mode.mjs";
import {makeTelemetryEvent,classifyTelemetryFreshness} from "./truthful_telemetry.mjs";

export function evaluateEndgameRuntime({llmAvailable=true,procedureId,trigger="founder-command",objectiveId=null,actionId=null,now=new Date().toISOString()}={}){
 const degraded=resolveDegradedMode({llmAvailable,procedureId,trigger});
 const procedure=procedureId?buildProcedureExecutionPlan({procedureId,trigger}):null;
 const type=procedure?.execution_allowed?"procedure.selected":degraded.execution_allowed?"reasoning.completed":"action_contract.blocked";
 const event=makeTelemetryEvent({eventId:`endgame:${actionId||"runtime"}:${Date.parse(now)}`,type,objectiveId,actionId,timestampUtc:now,source:"ENDGAME_RUNTIME_GATE",status:degraded.mode,evidenceRefs:[],metadata:{llm_available:Boolean(llmAvailable),procedure_id:procedureId||null,execution_allowed:Boolean(degraded.execution_allowed)}});
 return {schema_version:1,execution_allowed:Boolean(degraded.execution_allowed),mode:degraded.mode,reason:degraded.reason,procedure,event:classifyTelemetryFreshness(event,{nowUtc:now}),manual_trigger_only:trigger==="founder-command"};
}
