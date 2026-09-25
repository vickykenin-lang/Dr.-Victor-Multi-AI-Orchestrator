import assert from 'node:assert/strict';
import test from 'node:test';
import { rememberAdvisory, recallAdvisory, reconcileAdvisoryWithFreshEvidence } from './cognee_advisory.mjs';
import { makeFactReceipt } from './truth_resolver.mjs';

function kv(){ const m=new Map(); return {async put(k,v){m.set(k,v)},async get(k,o){const v=m.get(k);if(!v)return null;return o?.type==='json'?JSON.parse(v):v}} }

test('remember -> recall keeps memory advisory-only', async()=>{
 const env={VICTOR_COGNEE_ADVISORY:kv()};
 const w=await rememberAdvisory(env,{fact:'deployment.sha',value:'old-sha',observedAt:'2026-09-24T00:00:00Z'});
 assert.equal(w.status,'REMEMBERED');
 const r=await recallAdvisory(env,'deployment.sha');
 assert.equal(r.value,'old-sha'); assert.equal(r.advisory_only,true); assert.equal(r.source_class,'DURABLE_MEMORY');
});

test('fresh verified evidence overrides stale durable memory', async()=>{
 const memory=makeFactReceipt({fact:'deployment.sha',value:'old-sha',sourceClass:'DURABLE_MEMORY',sourceUri:'cognee://victor/advisory',observedAt:'2026-09-24T00:00:00Z',fetchedAt:'2026-09-25T06:00:00Z',staleAfterMs:1000});
 const fresh=makeFactReceipt({fact:'deployment.sha',value:'new-sha',sourceClass:'EXTERNAL_RESULT',sourceUri:'https://runtime.example/health',observedAt:'2026-09-25T05:59:00Z',fetchedAt:'2026-09-25T06:00:00Z'});
 const out=reconcileAdvisoryWithFreshEvidence(memory,[fresh]);
 assert.equal(out.selected.value,'new-sha'); assert.equal(out.memory_used_as_authority,false); assert.equal(out.conflict,true);
});
