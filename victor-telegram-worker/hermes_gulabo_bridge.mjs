const clean=(value,max=4000)=>typeof value==='string'?value.trim().slice(0,max):'';
const configured=(value)=>Boolean(clean(value,4096));

function baseUrl(env={}){return clean(env.GULABO_API_BASE_URL,1000).replace(/\/+$/,'');}
function token(env={}){return clean(env.GULABO_API_TOKEN,2000);}

export function gulaboBridgeCapability(env={}){
  const base=baseUrl(env),apiToken=token(env);
  return{
    service:'gulabo',
    api_base_url_configured:Boolean(base),
    api_token_configured:Boolean(apiToken),
    ready_for_calls:Boolean(base),
    auth_mode:apiToken?'BEARER':'NONE',
    review_action:'hermes.gulabo_review_ready',
    revision_action:'gulabo.request_revision',
    approval_action:'gulabo.good_to_go',
  };
}

async function callGulabo(env,path,{method='GET',body=null}={}){
  const capability=gulaboBridgeCapability(env);
  if(!capability.ready_for_calls)return{ok:false,status:0,error_code:'GULABO_API_BASE_URL_NOT_CONFIGURED',data:null,live_request_verified:false,capability};
  const headers={'accept':'application/json','user-agent':'Hermes-Gulabo-Bridge/1.0'};
  const apiToken=token(env);
  if(apiToken)headers.authorization=`Bearer ${apiToken}`;
  if(body!=null)headers['content-type']='application/json';
  try{
    const response=await fetch(`${baseUrl(env)}${path}`,{method,headers,...(body!=null?{body:JSON.stringify(body)}:{})});
    let data=null;
    try{data=await response.json();}catch{data={raw:(await response.text().catch(()=>'' )).slice(0,1200)};}
    return{ok:response.ok,status:response.status,error_code:response.ok?null:`GULABO_HTTP_${response.status}`,data,live_request_verified:true,capability};
  }catch(error){
    return{ok:false,status:0,error_code:'GULABO_REQUEST_EXCEPTION',error_type:error?.name||'Error',data:null,live_request_verified:false,capability};
  }
}

export async function readGulaboStatus(env={}){
  const result=await callGulabo(env,'/health');
  if(!result.ok)return{status:'SAFE_STOP',execution:'BLOCKED',error_code:result.error_code,result:result.data,live_request_verified:result.live_request_verified,real_output_verified:false,business_outcome_verified:false,capability:result.capability};
  return{status:'COMPLETED',execution:'COMPLETED',error_code:null,result:result.data,live_request_verified:true,real_output_verified:false,business_outcome_verified:false,capability:result.capability};
}

function normalizedRevisionPayload(payload={}){
  const feedback=clean(payload.founder_feedback||payload.feedback,4000);
  const change=Array.isArray(payload.change)?payload.change.map(v=>clean(v,1000)).filter(Boolean):feedback?[feedback]:[];
  const preserve=Array.isArray(payload.preserve)?payload.preserve.map(v=>clean(v,1000)).filter(Boolean):['all approved elements not explicitly changed'];
  return{
    image_id:clean(payload.image_id,160),
    from_revision:Number(payload.from_revision||payload.revision||0),
    preserve,
    change,
    regenerate_from_scratch:payload.regenerate_from_scratch===true,
    founder_feedback:feedback||change.join('; '),
  };
}

export async function requestGulaboRevision(env={},payload={}){
  const body=normalizedRevisionPayload(payload);
  if(!body.image_id||!Number.isInteger(body.from_revision)||body.from_revision<1||!body.change.length||!body.founder_feedback){
    return{status:'SAFE_STOP',execution:'BLOCKED',error_code:'GULABO_REVISION_PAYLOAD_INVALID',result:{image_id:body.image_id||null,from_revision:body.from_revision||null},live_request_verified:false,real_output_verified:false,business_outcome_verified:false};
  }
  const result=await callGulabo(env,'/v1/revisions/generate',{method:'POST',body});
  if(!result.ok)return{status:'SAFE_STOP',execution:'BLOCKED',error_code:result.error_code,result:result.data,live_request_verified:result.live_request_verified,real_output_verified:false,business_outcome_verified:false};
  const output=result.data||{};
  return{status:'COMPLETED',execution:'COMPLETED',error_code:null,result:output,live_request_verified:true,real_output_verified:output.real_output_verified===true,business_outcome_verified:false};
}

export async function approveGulabo(env={},payload={}){
  const imageId=clean(payload.image_id,160),revision=Number(payload.revision||0),note=clean(payload.note,2000);
  if(!imageId||!Number.isInteger(revision)||revision<1){
    return{status:'SAFE_STOP',execution:'BLOCKED',error_code:'GULABO_APPROVAL_PAYLOAD_INVALID',result:null,live_request_verified:false,real_output_verified:false,business_outcome_verified:false};
  }
  const result=await callGulabo(env,'/v1/founder-decision',{method:'POST',body:{image_id:imageId,revision,decision:'GOOD_TO_GO',note:note||null}});
  if(!result.ok)return{status:'SAFE_STOP',execution:'BLOCKED',error_code:result.error_code,result:result.data,live_request_verified:result.live_request_verified,real_output_verified:false,business_outcome_verified:false};
  const output=result.data||{};
  return{status:'COMPLETED',execution:'COMPLETED',error_code:null,result:output,live_request_verified:true,real_output_verified:output.real_output_verified===true,business_outcome_verified:false};
}
