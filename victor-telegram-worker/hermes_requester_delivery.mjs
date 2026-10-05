const clean=(value,max=400)=>typeof value==='string'?value.trim().slice(0,max):'';
const STORE='HERMES_COMMAND_STORE';

function requireStore(env={}){
  const store=env[STORE];
  if(!store||typeof store.get!=='function'||typeof store.put!=='function')throw new Error('HERMES_COMMAND_STORE_UNAVAILABLE');
  return store;
}
function requesterKey(requester,requesterRef){
  const r=clean(requester,64).toUpperCase(),ref=clean(requesterRef,160);
  if(!r||!ref)throw new Error('REQUESTER_DELIVERY_KEY_INVALID');
  return `gulabo-delivery:${r}:${ref}`;
}
export async function putRequesterDelivery(env,delivery={}){
  const requester=clean(delivery.requester,64).toUpperCase(),requester_ref=clean(delivery.requester_ref,160);
  const record={
    requester,requester_ref,
    image_id:clean(delivery.image_id,160),
    revision:Number(delivery.revision||0),
    asset_url:clean(delivery.asset_url,1200),
    status:clean(delivery.status,64)||'GOOD_TO_GO',
    founder_approved:delivery.founder_approved===true,
    live_request_verified:delivery.live_request_verified===true,
    real_output_verified:delivery.real_output_verified===true,
    delivered_at:new Date().toISOString(),
    delivery_channel:'HERMES_REQUESTER_MAILBOX',
  };
  if(!record.image_id||!Number.isInteger(record.revision)||record.revision<1||!record.asset_url)throw new Error('REQUESTER_DELIVERY_PAYLOAD_INVALID');
  await requireStore(env).put(requesterKey(requester,requester_ref),JSON.stringify(record),{expirationTtl:60*60*24*90});
  return record;
}
export async function getRequesterDelivery(env,{requester,requester_ref}={}){
  const store=requireStore(env);
  const key=requesterKey(requester,requester_ref);
  const value=await store.get(key,{type:'json'});
  return value&&typeof value==='object'?{found:true,delivery:value}:{found:false,delivery:null};
}
