import test from 'node:test';
import assert from 'node:assert/strict';
import { approveGulabo } from './hermes_gulabo_bridge.mjs';
import { parseHermesTelegramCommand } from './hermes_command_plane.mjs';
import { routeHermesCommandV2 } from './hermes_command_router_v2.mjs';

function memoryStore(){
  const data=new Map();
  return{
    async put(key,value){data.set(key,value);},
    async get(key,options={}){
      const raw=data.get(key);
      if(raw==null)return null;
      return options?.type==='json'?JSON.parse(raw):raw;
    },
  };
}
function env(store){return{
  GULABO_API_BASE_URL:'https://gulabo.example',
  GULABO_HERMES_CALLBACK_TOKEN:'callback-token',
  GULABO_HERMES_CALLBACK_SECRET:'callback-secret',
  HERMES_COMMAND_STORE:store,
};}

test('GOOD_TO_GO writes approved final asset into requester mailbox and RIO reads it back',async()=>{
  const store=memoryStore();
  const original=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({
    image_id:'GULABO-IMG-9',revision:2,status:'GOOD_TO_GO',founder_approved:true,
    requester:'RIO',requester_ref:'rio-task-44',real_output_verified:true,
  }),{status:200,headers:{'content-type':'application/json'}});
  try{
    const approved=await approveGulabo(env(store),{image_id:'GULABO-IMG-9',revision:2,note:'ship it'});
    assert.equal(approved.status,'COMPLETED');
    assert.equal(approved.business_outcome_verified,true);
    assert.equal(approved.result.requester_delivery.delivery_channel,'HERMES_REQUESTER_MAILBOX');
    assert.equal(approved.result.requester_delivery.asset_url,'https://gulabo.example/v1/assets/GULABO-IMG-9/2');

    const read=await routeHermesCommandV2(env(store),{
      command_id:'cmd-read-1',source:'internal',actor:'system',target:'rio',action:'rio.gulabo_result',execution_mode:'manual',idempotency_key:'read-rio-task-44',payload:{requester_ref:'rio-task-44'},
    },{persist:false});
    assert.equal(read.status,'COMPLETED');
    assert.equal(read.business_outcome_verified,true);
    assert.equal(read.result.image_id,'GULABO-IMG-9');
    assert.equal(read.result.requester,'RIO');
  }finally{globalThis.fetch=original;}
});

test('AURA3 requester result command parses to dedicated readback action',()=>{
  assert.deepEqual(parseHermesTelegramCommand('/aura3 gulabo aura-job-7'),{
    target:'aura3',action:'aura3.gulabo_result',payload:{requester_ref:'aura-job-7'},
  });
  assert.deepEqual(parseHermesTelegramCommand('/rio gulabo rio-job-7'),{
    target:'rio',action:'rio.gulabo_result',payload:{requester_ref:'rio-job-7'},
  });
});
