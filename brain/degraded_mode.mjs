import {buildProcedureExecutionPlan} from "./procedure_registry.mjs";

export function resolveDegradedMode({llmAvailable,procedureId,trigger="founder-command"}={}){
 if(llmAvailable===true)return {mode:"NORMAL",execution_allowed:true,reason:"LLM_AVAILABLE"};
 const plan=buildProcedureExecutionPlan({procedureId,trigger});
 if(plan.execution_allowed===true)return {mode:"DEGRADED_VERIFIED_PROCEDURE",execution_allowed:true,reason:"VERIFIED_LLM_FREE_PROCEDURE",plan};
 return {mode:"SAFE_HOLD",execution_allowed:false,reason:plan.reason||"NOVEL_ACTION_REQUIRES_REASONING",plan};
}
