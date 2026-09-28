export const NATIVE_TOOL_RUNTIME_VERSION = 'VICTOR_NATIVE_TOOL_RUNTIME_V1';
const GH='https://api.github.com';
function ghHeaders(env){ if(!env?.GITHUB_ORCHESTRATION_TOKEN) return null; return {Authorization:`Bearer ${env.GITHUB_ORCHESTRATION_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Dr-Victor-Native-GitHub/1.0','Content-Type':'application/json'}; }
async function gh(env,path,{method='GET',body}={}){ const headers=ghHeaders(env); if(!headers) throw new Error('GITHUB_ORCHESTRATION_TOKEN_NOT_CONFIGURED'); const r=await fetch(`${GH}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}); const text=await r.text(); let data; try{data=JSON.parse(text);}catch{data={raw:text.slice(0,1000)}} if(!r.ok) throw new Error(`GITHUB_HTTP_${r.status}:${data?.message||'request_failed'}`); return data; }
function safeName(v){ const s=String(v||'').trim(); return /^[A-Za-z0-9._-]{1,100}$/.test(s)?s:null; }
function safeRepo(v){ const s=String(v||'').trim(); return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(s)?s:null; }
function safePath(v){ const s=String(v||'').replace(/^\/+/, '').trim(); return s && !s.includes('..') && s.length<300?s:null; }
export async function githubRuntimeHealth(env){ if(!ghHeaders(env)) return {ok:false,configured:false,verified:false}; try{ const u=await gh(env,'/user'); return {ok:true,configured:true,verified:Boolean(u?.login),login:u?.login||null}; }catch(error){return {ok:false,configured:true,verified:false,error:error?.message||'Error'};} }
export async function executeNativeCapability(env, capabilityId, operation, args={}){
  if(capabilityId!=='github') return {ok:false,verified:false,state:'NATIVE_CAPABILITY_NOT_IMPLEMENTED'};
  const health=await githubRuntimeHealth(env); if(!health.verified) return {ok:false,verified:false,state:'GITHUB_HEALTH_FAILED',health};
  if(operation==='get_repo'){
    const repo=safeRepo(args.repo); if(!repo) return {ok:false,verified:false,state:'INVALID_REPO'};
    const r=await gh(env,`/repos/${repo}`); return {ok:true,verified:true,state:'RESULT_RECEIVED',result:{full_name:r.full_name,private:r.private,default_branch:r.default_branch,html_url:r.html_url,updated_at:r.updated_at}};
  }
  if(operation==='create_repo'){
    const name=safeName(args.name); if(!name) return {ok:false,verified:false,state:'INVALID_REPO_NAME'};
    const created=await gh(env,'/user/repos',{method:'POST',body:{name,description:String(args.description||'').slice(0,300),private:args.private!==false,auto_init:args.auto_init!==false}});
    const verify=await gh(env,`/repos/${created.full_name}`);
    return {ok:true,verified:Boolean(verify?.full_name===created.full_name),state:'RESULT_RECEIVED',result:{full_name:verify.full_name,private:verify.private,default_branch:verify.default_branch,html_url:verify.html_url}};
  }
  if(operation==='create_file'){
    const repo=safeRepo(args.repo), path=safePath(args.path); if(!repo||!path||typeof args.content!=='string') return {ok:false,verified:false,state:'INVALID_FILE_ARGUMENTS'};
    const branch=safeName(args.branch)||'main'; const message=String(args.message||`Victor: create ${path}`).slice(0,200);
    const content=typeof btoa==='function'?btoa(unescape(encodeURIComponent(args.content))):null; if(!content) return {ok:false,verified:false,state:'BASE64_UNAVAILABLE'};
    const out=await gh(env,`/repos/${repo}/contents/${path}`,{method:'PUT',body:{message,content,branch}});
    return {ok:true,verified:Boolean(out?.content?.sha),state:'RESULT_RECEIVED',result:{repo,path,sha:out?.content?.sha||null,commit_sha:out?.commit?.sha||null}};
  }
  if(operation==='dispatch_workflow'){
    const repo=safeRepo(args.repo), workflow=String(args.workflow||'').trim(); if(!repo||!workflow||workflow.length>150) return {ok:false,verified:false,state:'INVALID_WORKFLOW_ARGUMENTS'};
    await gh(env,`/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,{method:'POST',body:{ref:safeName(args.ref)||'main',inputs:args.inputs&&typeof args.inputs==='object'?args.inputs:{}}});
    return {ok:true,verified:true,state:'DISPATCHED',result:{repo,workflow,ref:safeName(args.ref)||'main',completion_claimed:false}};
  }
  return {ok:false,verified:false,state:'UNSUPPORTED_GITHUB_OPERATION',supported:['get_repo','create_repo','create_file','dispatch_workflow']};
}
