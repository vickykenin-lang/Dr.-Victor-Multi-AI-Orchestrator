import test from 'node:test';
import assert from 'node:assert/strict';
import { approveGulabo, gulaboBridgeCapability, readGulaboStatus, requestGulaboRevision } from './hermes_gulabo_bridge.mjs';

test('gulabo bridge capability requires API base URL but bearer token is optional at source-contract stage',()=>{
  assert.equal(gulaboBridgeCapability({}).ready_for_calls,false);
  const cap=gulaboBridgeCapability({GULABO_API_BASE_URL:'https://gulabo.example'});
  assert.equal(cap.ready_for_calls,true);
  assert.equal(cap.auth_mode,'NONE');
  assert.equal(gulaboBridgeCapability({GULABO_API_BASE_URL:'https://gulabo.example',GULABO_API_TOKEN:'x'}).auth_mode,'BEARER');
});

test('status call reports live request only after actual HTTP response',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async(url,init)=>{
    assert.equal(url,'https://gulabo.example/health');
    assert.equal(init.method,'GET');
    return new Response(JSON.stringify({status:'READY',service:'gulabo-image-agent'}),{status:200,headers:{'content-type':'application/json'}});
  };
  try{
    const out=await readGulaboStatus({GULABO_API_BASE_URL:'https://gulabo.example'});
    assert.equal(out.status,'COMPLETED');
    assert.equal(out.live_request_verified,true);
    assert.equal(out.result.status,'READY');
  }finally{globalThis.fetch=original;}
});

test('revision call sends founder feedback as targeted rectification and preserves approved elements',async()=>{
  const original=globalThis.fetch;
  let seen;
  globalThis.fetch=async(url,init)=>{
    seen={url,init,body:JSON.parse(init.body)};
    return new Response(JSON.stringify({image_id:'GULABO-IMG-1',revision:2,status:'READY_FOR_REVIEW',real_output_verified:true}),{status:200,headers:{'content-type':'application/json'}});
  };
  try{
    const out=await requestGulaboRevision({GULABO_API_BASE_URL:'https://gulabo.example',GULABO_API_TOKEN:'secret'}, {image_id:'GULABO-IMG-1',from_revision:1,founder_feedback:'make background warmer'});
    assert.equal(seen.url,'https://gulabo.example/v1/revisions/generate');
    assert.equal(seen.init.headers.authorization,'Bearer secret');
    assert.deepEqual(seen.body.change,['make background warmer']);
    assert.deepEqual(seen.body.preserve,['all approved elements not explicitly changed']);
    assert.equal(seen.body.regenerate_from_scratch,false);
    assert.equal(out.status,'COMPLETED');
    assert.equal(out.real_output_verified,true);
    assert.equal(out.business_outcome_verified,false);
  }finally{globalThis.fetch=original;}
});

test('founder approval posts GOOD_TO_GO but does not invent requester return outcome',async()=>{
  const original=globalThis.fetch;
  let body;
  globalThis.fetch=async(url,init)=>{
    body=JSON.parse(init.body);
    return new Response(JSON.stringify({image_id:'GULABO-IMG-1',revision:2,status:'GOOD_TO_GO',founder_approved:true,real_output_verified:true}),{status:200,headers:{'content-type':'application/json'}});
  };
  try{
    const out=await approveGulabo({GULABO_API_BASE_URL:'https://gulabo.example'}, {image_id:'GULABO-IMG-1',revision:2,note:'good'});
    assert.equal(body.decision,'GOOD_TO_GO');
    assert.equal(out.status,'COMPLETED');
    assert.equal(out.business_outcome_verified,false);
  }finally{globalThis.fetch=original;}
});
