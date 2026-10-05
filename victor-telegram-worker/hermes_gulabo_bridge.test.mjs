import test from 'node:test';
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { approveGulabo, gulaboBridgeCapability, readGulaboStatus, requestGulaboRevision } from './hermes_gulabo_bridge.mjs';

const signedEnv=()=>({
  GULABO_API_BASE_URL:'https://gulabo.example',
  GULABO_HERMES_CALLBACK_TOKEN:'callback-token',
  GULABO_HERMES_CALLBACK_SECRET:'callback-secret',
});

test('gulabo bridge exposes signed callback readiness only when callback credentials are present',()=>{
  assert.equal(gulaboBridgeCapability({}).ready_for_calls,false);
  const cap=gulaboBridgeCapability({GULABO_API_BASE_URL:'https://gulabo.example'});
  assert.equal(cap.ready_for_calls,true);
  assert.equal(cap.signed_callback_ready,false);
  const signed=gulaboBridgeCapability(signedEnv());
  assert.equal(signed.signed_callback_ready,true);
  assert.equal(signed.callback_auth_mode,'BEARER_HMAC_SHA256');
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

test('revision call uses signed Hermes callback endpoint and preserves approved elements',async()=>{
  const original=globalThis.fetch;
  let seen;
  globalThis.fetch=async(url,init)=>{
    seen={url,init,body:JSON.parse(init.body)};
    return new Response(JSON.stringify({image_id:'GULABO-IMG-1',revision:2,status:'READY_FOR_REVIEW',real_output_verified:true}),{status:200,headers:{'content-type':'application/json'}});
  };
  try{
    const out=await requestGulaboRevision(signedEnv(), {image_id:'GULABO-IMG-1',from_revision:1,founder_feedback:'make background warmer'});
    assert.equal(seen.url,'https://gulabo.example/v1/hermes/correction');
    assert.equal(seen.init.headers.authorization,'Bearer callback-token');
    assert.match(seen.init.headers['x-gulabo-timestamp'],/^\d+$/);
    assert.match(seen.init.headers['x-gulabo-timestamp'],/^\d+$/);
    const expected=createHmac('sha256','callback-secret').update(seen.init.headers['x-gulabo-timestamp']+'.'+seen.init.body).digest('hex');
    assert.equal(seen.init.headers['x-gulabo-signature'],'sha256='+expected);
    assert.deepEqual(seen.body.change,['make background warmer']);
    assert.deepEqual(seen.body.preserve,['all approved elements not explicitly changed']);
    assert.equal(seen.body.regenerate_from_scratch,false);
    assert.equal(out.status,'COMPLETED');
    assert.equal(out.real_output_verified,true);
    assert.equal(out.business_outcome_verified,false);
  }finally{globalThis.fetch=original;}
});

test('revision call fails closed when signed callback auth is missing',async()=>{
  const out=await requestGulaboRevision({GULABO_API_BASE_URL:'https://gulabo.example'}, {image_id:'GULABO-IMG-1',from_revision:1,founder_feedback:'make background warmer'});
  assert.equal(out.status,'SAFE_STOP');
  assert.equal(out.error_code,'GULABO_CALLBACK_AUTH_NOT_CONFIGURED');
  assert.equal(out.live_request_verified,false);
});

test('founder approval uses signed GOOD_TO_GO endpoint without inventing requester return outcome',async()=>{
  const original=globalThis.fetch;
  let seen;
  globalThis.fetch=async(url,init)=>{
    seen={url,init,body:JSON.parse(init.body)};
    return new Response(JSON.stringify({image_id:'GULABO-IMG-1',revision:2,status:'GOOD_TO_GO',founder_approved:true,real_output_verified:true}),{status:200,headers:{'content-type':'application/json'}});
  };
  try{
    const out=await approveGulabo(signedEnv(), {image_id:'GULABO-IMG-1',revision:2,note:'good'});
    assert.equal(seen.url,'https://gulabo.example/v1/hermes/founder-decision');
    assert.equal(seen.init.headers.authorization,'Bearer callback-token');
    assert.match(seen.init.headers['x-gulabo-timestamp'],/^\d+$/);
    const expected=createHmac('sha256','callback-secret').update(seen.init.headers['x-gulabo-timestamp']+'.'+seen.init.body).digest('hex');
    assert.equal(seen.init.headers['x-gulabo-signature'],'sha256='+expected);
    assert.equal(seen.body.decision,'GOOD_TO_GO');
    assert.equal(out.status,'COMPLETED');
    assert.equal(out.business_outcome_verified,false);
  }finally{globalThis.fetch=original;}
});

test('revision and approval never fetch when either callback credential is missing',async()=>{
  const original=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async()=>{calls++;throw new Error('unexpected fetch');};
  try{
    for(const missing of ['GULABO_HERMES_CALLBACK_TOKEN','GULABO_HERMES_CALLBACK_SECRET']){
      const env=signedEnv();
      delete env[missing];
      const revision=await requestGulaboRevision(env,{image_id:'GULABO-IMG-1',from_revision:1,founder_feedback:'warmer background'});
      const approval=await approveGulabo(env,{image_id:'GULABO-IMG-1',revision:2});
      for(const out of [revision,approval]){
        assert.equal(out.status,'SAFE_STOP');
        assert.equal(out.error_code,'GULABO_CALLBACK_AUTH_NOT_CONFIGURED');
        assert.equal(out.live_request_verified,false);
        assert.equal(out.real_output_verified,false);
      }
    }
    assert.equal(calls,0);
  }finally{globalThis.fetch=original;}
});
