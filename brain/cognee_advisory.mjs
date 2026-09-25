import { makeFactReceipt, reconcileReceiptSet } from './truth_resolver.mjs';

const PREFIX = 'victor:cognee:advisory:v1:';
function norm(v){ return String(v ?? '').trim(); }
function store(env={}) {
  const b=env.VICTOR_COGNEE_ADVISORY || env.VICTOR_CONVERSATION_STATE;
  return b && typeof b.get==='function' && typeof b.put==='function' ? b : null;
}
function key(id){ return PREFIX + encodeURIComponent(norm(id)); }

export function cogneeAdvisoryCapability(env={}) {
  const binding=store(env);
  return binding
    ? { available:true, mode:'ADVISORY_ONLY', durable:true, provider:'COGNEE_COMPATIBLE_STORE' }
    : { available:false, mode:'ADVISORY_ONLY', durable:false, reason:'COGNEE_ADVISORY_STORE_UNAVAILABLE' };
}

export async function rememberAdvisory(env={}, {fact,value,observedAt=null,sourceUri='cognee://victor/advisory',confidence='MEDIUM'}={}) {
  const binding=store(env);
  if(!binding) return {status:'PENDING_CONFIGURATION',reason:'COGNEE_ADVISORY_STORE_UNAVAILABLE'};
  if(!norm(fact)) throw new Error('COGNEE_FACT_REQUIRED');
  const receipt=makeFactReceipt({fact:norm(fact),value,sourceClass:'DURABLE_MEMORY',sourceUri,observedAt,fetchedAt:new Date().toISOString(),confidence});
  await binding.put(key(receipt.fact),JSON.stringify(receipt));
  return {status:'REMEMBERED',receipt};
}

export async function recallAdvisory(env={}, fact) {
  const binding=store(env);
  if(!binding || !norm(fact)) return null;
  let value=null;
  try { value=await binding.get(key(fact),{type:'json'}); } catch(_){}
  if(!value){ try { const raw=await binding.get(key(fact)); value=typeof raw==='string'?JSON.parse(raw):raw; } catch(_){} }
  return value ? {...value, advisory_only:true} : null;
}

export function reconcileAdvisoryWithFreshEvidence(memoryReceipt, freshReceipts=[]) {
  const receipts=[...(Array.isArray(freshReceipts)?freshReceipts:[])];
  if(memoryReceipt) receipts.push({...memoryReceipt,source_class:'DURABLE_MEMORY',source_precedence:undefined});
  const result=reconcileReceiptSet(receipts);
  return {...result,memory_used_as_authority:false,advisory_only:true};
}
