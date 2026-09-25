const PROCEDURES=Object.freeze({
"founder-status-check-v1":Object.freeze({id:"founder-status-check-v1",version:1,risk:"READ_ONLY",allowed_trigger:"founder-command",steps:Object.freeze(["LOAD_CANONICAL_STATE","RESOLVE_TRUTH_RECEIPTS","RETURN_EVIDENCE_BOUND_STATUS"])}),
"safe-stop-v1":Object.freeze({id:"safe-stop-v1",version:1,risk:"CONTROL",allowed_trigger:"founder-command",steps:Object.freeze(["PERSIST_CURRENT_STATE","EMIT_SAFE_STOP_RECEIPT","HALT_EXECUTION"])})
});
export function listVerifiedProcedures(){return Object.values(PROCEDURES).map(p=>({...p,steps:[...p.steps]}));}
export function buildProcedureExecutionPlan({procedureId,trigger}={}){
 const p=PROCEDURES[String(procedureId||"").trim()];
 if(!p)return {ok:false,execution_allowed:false,reason:"PROCEDURE_NOT_VERIFIED",steps:[]};
 if(String(trigger||"").trim()!==p.allowed_trigger)return {ok:false,execution_allowed:false,reason:"TRIGGER_NOT_ALLOWED",steps:[]};
 return {ok:true,execution_allowed:true,reason:"VERIFIED_PROCEDURE",procedure:{...p,steps:[...p.steps]},steps:[...p.steps],llm_required:false};
}
