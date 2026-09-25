const TYPES=new Set(["objective.selected","reasoning.started","reasoning.completed","action_contract.created","action_contract.blocked","task.dispatched","result.received","verification.passed","verification.failed","progress.material","progress.none","replan.started","founder.guidance.requested","procedure.selected","memory.recalled","objective.completed","emergency_pause.changed"]);
function ms(v){const n=Date.parse(String(v||""));return Number.isFinite(n)?n:null;}
export function makeTelemetryEvent({eventId,type,objectiveId=null,actionId=null,timestampUtc=new Date().toISOString(),source,status, evidenceRefs=[],metadata={}}={}){
 if(!eventId||!TYPES.has(type)||!source)throw new Error("TELEMETRY_EVENT_INVALID");
 return {schema_version:1,event_id:String(eventId),type,objective_id:objectiveId,action_id:actionId,timestamp_utc:timestampUtc,source:String(source),status:status||"UNKNOWN",evidence_refs:Array.isArray(evidenceRefs)?evidenceRefs:[],metadata:metadata||{}};
}
export function classifyTelemetryFreshness(event,{nowUtc=new Date().toISOString(),liveWindowSeconds=120}={}){
 const e=ms(event?.timestamp_utc),n=ms(nowUtc); const age=e==null||n==null?null:Math.max(0,Math.floor((n-e)/1000));
 const fresh=age!==null&&age<=liveWindowSeconds;
 return {...event,freshness_seconds:age,surface:fresh?"LIVE":"HISTORY"};
}
export function telemetrySnapshot(events=[],opts={}){
 const classified=events.map(e=>classifyTelemetryFreshness(e,opts));
 return {schema_version:1,live:classified.filter(e=>e.surface==="LIVE"),history:classified.filter(e=>e.surface==="HISTORY"),live_claim_requires_fresh_event:true};
}
