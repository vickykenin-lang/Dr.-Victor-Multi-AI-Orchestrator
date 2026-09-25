const BASE={status:"ACTIVE",llm_required:false,preconditions:["FOUNDER_COMMAND"],tools:["CANONICAL_STATE","TRUTH_RESOLVER"],evidence_predicates:["FRESH_EVIDENCE_REQUIRED"],environment_fingerprint:"victor-endgame-p0-v1",verified_successes:2,failure_streak:0,last_verified_at_utc:null,source_episodes:[]};
const PROCEDURES=Object.freeze({
"founder-status-check-v1":Object.freeze({...BASE,id:"founder-status-check-v1",version:1,risk_class:"LOW",allowed_trigger:"founder-command",steps:Object.freeze(["LOAD_CANONICAL_STATE","RESOLVE_TRUTH_RECEIPTS","RETURN_EVIDENCE_BOUND_STATUS"])}),
"safe-stop-v1":Object.freeze({...BASE,id:"safe-stop-v1",version:1,risk_class:"GOVERNED_REVERSIBLE",allowed_trigger:"founder-command",steps:Object.freeze(["PERSIST_CURRENT_STATE","EMIT_SAFE_STOP_RECEIPT","HALT_EXECUTION"])})
});
function clone(p){return {...p,preconditions:[...p.preconditions],tools:[...p.tools],evidence_predicates:[...p.evidence_predicates],source_episodes:[...p.source_episodes],steps:[...p.steps]};}
export function listVerifiedProcedures(){return Object.values(PROCEDURES).map(clone);}
export function procedureLifecycle({procedureId,verifiedFailure=false,environmentMatch=true}={}){
 const p=PROCEDURES[String(procedureId||"").trim()]; if(!p)return {ok:false,status:"UNKNOWN"};
 if(!environmentMatch)return {ok:true,status:"DEGRADED",reason:"ENVIRONMENT_MISMATCH"};
 const streak=verifiedFailure?p.failure_streak+1:0;
 return {ok:true,status:streak>=2?"SUSPENDED":p.status,failure_streak:streak};
}
export function buildProcedureExecutionPlan({procedureId,trigger,environmentFingerprint="victor-endgame-p0-v1"}={}){
 const p=PROCEDURES[String(procedureId||"").trim()];
 if(!p)return {ok:false,execution_allowed:false,reason:"PROCEDURE_NOT_VERIFIED",steps:[]};
 if(p.status!=="ACTIVE")return {ok:false,execution_allowed:false,reason:"PROCEDURE_NOT_ACTIVE",steps:[]};
 if(environmentFingerprint!==p.environment_fingerprint)return {ok:false,execution_allowed:false,reason:"ENVIRONMENT_MISMATCH",steps:[]};
 if(String(trigger||"").trim()!==p.allowed_trigger)return {ok:false,execution_allowed:false,reason:"TRIGGER_NOT_ALLOWED",steps:[]};
 return {ok:true,execution_allowed:true,reason:"VERIFIED_PROCEDURE",procedure:clone(p),steps:[...p.steps],llm_required:false};
}
