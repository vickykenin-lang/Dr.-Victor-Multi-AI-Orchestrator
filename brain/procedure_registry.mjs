const BASE={status:"ACTIVE",llm_required:false,preconditions:["FOUNDER_COMMAND"],tools:["CANONICAL_STATE","TRUTH_RESOLVER"],evidence_predicates:["FRESH_EVIDENCE_REQUIRED"],environment_fingerprint:"victor-endgame-p0-v1",verified_successes:2,failure_streak:0,last_verified_at_utc:null,source_episodes:[]};
const PROCEDURES=Object.freeze({
"founder-status-check-v1":Object.freeze({...BASE,id:"founder-status-check-v1",version:1,risk_class:"LOW",allowed_trigger:"founder-command",steps:Object.freeze(["LOAD_CANONICAL_STATE","RESOLVE_TRUTH_RECEIPTS","RETURN_EVIDENCE_BOUND_STATUS"])}),
"safe-stop-v1":Object.freeze({...BASE,id:"safe-stop-v1",version:1,risk_class:"GOVERNED_REVERSIBLE",allowed_trigger:"founder-command",steps:Object.freeze(["PERSIST_CURRENT_STATE","EMIT_SAFE_STOP_RECEIPT","HALT_EXECUTION"])}),
"department-action-v1":Object.freeze({...BASE,id:"department-action-v1",version:1,risk_class:"GOVERNED_REVERSIBLE",allowed_trigger:"founder-command",tools:Object.freeze(["DEPARTMENT_BRIDGE","RESULT_VERIFIER"]),steps:Object.freeze(["DISPATCH_DEPARTMENT_TASK","WAIT_FOR_RESULT","VERIFY_RESULT_EVIDENCE","RETURN_FINAL_RESULT"])}),
"sensitive-action-v1":Object.freeze({...BASE,id:"sensitive-action-v1",version:1,risk_class:"RED",allowed_trigger:"founder-approved-command",tools:Object.freeze(["CAPABILITY_BROKER","RESULT_VERIFIER"]),steps:Object.freeze(["VERIFY_EXPLICIT_APPROVAL","EXECUTE_BOUNDED_ACTION","VERIFY_RESULT_EVIDENCE","RETURN_FINAL_RESULT"])}),
});

const ROUTING_CATALOG=Object.freeze({
 STATUS:Object.freeze({procedure_id:"founder-status-check-v1",risk:"GREEN",approval_required:false}),
 STOP:Object.freeze({procedure_id:"safe-stop-v1",risk:"AMBER",approval_required:false}),
 ACTION:Object.freeze({procedure_id:"department-action-v1",risk:"AMBER",approval_required:false}),
 SENSITIVE_ACTION:Object.freeze({procedure_id:"sensitive-action-v1",risk:"RED",approval_required:true}),
 REMINDER:Object.freeze({procedure_id:null,risk:"GREEN",approval_required:false,execution_supported:false}),
});

function clone(p){return {...p,preconditions:[...p.preconditions],tools:[...p.tools],evidence_predicates:[...p.evidence_predicates],source_episodes:[...p.source_episodes],steps:[...p.steps]};}
export function listVerifiedProcedures(){return Object.values(PROCEDURES).map(clone);}
export function resolveProcedureRoute({type,department=null,action=null,risk=null}={}){
 const normalizedType=String(type||"").toUpperCase();
 const key=normalizedType==="ACTION"&&String(risk||"").toUpperCase()==="RED"?"SENSITIVE_ACTION":normalizedType;
 const base=ROUTING_CATALOG[key];
 if(!base)return {ok:false,reason:"ROUTE_NOT_REGISTERED",type:normalizedType,department,action,risk:String(risk||"GREEN").toUpperCase()};
 return {ok:true,type:normalizedType,department,action,risk:String(risk||base.risk).toUpperCase(),...base};
}
export function procedureLifecycle({procedureId,verifiedFailure=false,environmentMatch=true}={}){
 const p=PROCEDURES[String(procedureId||"").trim()]; if(!p)return {ok:false,status:"UNKNOWN"};
 if(!environmentMatch)return {ok:true,status:"DEGRADED",reason:"ENVIRONMENT_MISMATCH"};
 const streak=verifiedFailure?p.failure_streak+1:0;
 return {ok:true,status:streak>=2?"SUSPENDED":p.status,failure_streak:streak};
}
export function evolveProcedureLifecycle({procedureId,currentState=null,verifiedFailure=false,verifiedSuccess=false,environmentMatch=true}={}){
 const p=PROCEDURES[String(procedureId||"").trim()]; if(!p)return {ok:false,status:"UNKNOWN",execution_allowed:false};
 if(!environmentMatch)return {ok:true,status:"DEGRADED",failure_streak:Number(currentState?.failure_streak||0),reason:"ENVIRONMENT_MISMATCH",execution_allowed:false};
 const priorStatus=String(currentState?.status||p.status).toUpperCase();
 const priorStreak=Math.max(0,Number(currentState?.failure_streak ?? p.failure_streak ?? 0));
 if(verifiedSuccess===true)return {ok:true,status:"ACTIVE",failure_streak:0,reason:"VERIFIED_SUCCESS",execution_allowed:true};
 const streak=verifiedFailure===true?priorStreak+1:priorStreak;
 const status=(priorStatus==="SUSPENDED"||streak>=2)?"SUSPENDED":"ACTIVE";
 return {ok:true,status,failure_streak:streak,reason:status==="SUSPENDED"?"VERIFIED_FAILURE_THRESHOLD_REACHED":"LIFECYCLE_ACTIVE",execution_allowed:status==="ACTIVE"};
}
export function buildProcedureExecutionPlan({procedureId,trigger,environmentFingerprint="victor-endgame-p0-v1"}={}){
 const p=PROCEDURES[String(procedureId||"").trim()];
 if(!p)return {ok:false,execution_allowed:false,reason:"PROCEDURE_NOT_VERIFIED",steps:[]};
 if(p.status!=="ACTIVE")return {ok:false,execution_allowed:false,reason:"PROCEDURE_NOT_ACTIVE",steps:[]};
 if(environmentFingerprint!==p.environment_fingerprint)return {ok:false,execution_allowed:false,reason:"ENVIRONMENT_MISMATCH",steps:[]};
 if(String(trigger||"").trim()!==p.allowed_trigger)return {ok:false,execution_allowed:false,reason:"TRIGGER_NOT_ALLOWED",steps:[]};
 return {ok:true,execution_allowed:true,reason:"VERIFIED_PROCEDURE",procedure:clone(p),steps:[...p.steps],llm_required:false};
}
