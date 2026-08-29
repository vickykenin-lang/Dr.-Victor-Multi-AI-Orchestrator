const VICTOR_REPO='vickykenin-lang/Dr.-Victor-Multi-AI-Orchestrator';
const RIO_REPO='vickykenin-lang/rio-affiliate-engine';
const VICTOR_PATH='data/emergency_pause_state.json';
const RIO_PATH='data/emergency_pause_state.json';

function headers(token){return {Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json','User-Agent':'Victor-Emergency-Pause/1.0'};}
function enc(text){const bytes=new TextEncoder().encode(text);let b='';for(const x of bytes)b+=String.fromCharCode(x);return btoa(b);}
function dec(text){const b=atob(String(text||'').replace(/\n/g,''));return new TextDecoder().decode(Uint8Array.from(b,c=>c.charCodeAt(0)));}
async function readJson(env,repo,path,fallback={}){
  const token=env.GITHUB_ORCHESTRATION_TOKEN||env.GITHUB_MEMORY_TOKEN;if(!token)return fallback;
  const r=await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=main&t=${Date.now()}`,{headers:headers(token),cache:'no-store'});
  if(!r.ok)return fallback;const p=await r.json();try{return JSON.parse(dec(p.content||''));}catch{return fallback;}
}
async function writeJson(env,repo,path,next,message){
  const token=env.GITHUB_ORCHESTRATION_TOKEN;if(!token)throw new Error('ORCHESTRATION_TOKEN_REQUIRED');
  const api=`https://api.github.com/repos/${repo}/contents/${path}`;const h=headers(token);
  let last='UNKNOWN';
  for(let i=1;i<=4;i+=1){
    const r=await fetch(`${api}?ref=main&t=${Date.now()}`,{headers:h,cache:'no-store'});if(!r.ok){last=`READ_${r.status}`;if([401,403].includes(r.status))break;continue;}
    const p=await r.json();const u=await fetch(api,{method:'PUT',headers:h,body:JSON.stringify({message,content:enc(JSON.stringify(next,null,2)+'\n'),sha:p.sha,branch:'main'})});
    if(u.ok)return true;last=`WRITE_${u.status}`;if([409,422].includes(u.status))continue;break;
  }
  throw new Error(`PAUSE_STATE_WRITE_FAILED_${repo}_${last}`);
}

export function parseEmergencyCommand(text){
  const t=String(text||'').trim().replace(/\s+/g,' ').toUpperCase();
  if(t==='SYSTEM PAUSE')return {scope:'system',action:'pause',department:null};
  if(t==='SYSTEM RESUME')return {scope:'system',action:'resume',department:null};
  const m=t.match(/^(PAUSE|RESUME)\s+(RIO|TONY|TONY STARK|AURA3|AURA 3)$/);if(!m)return null;
  const map={'RIO':'rio','TONY':'tony_stark','TONY STARK':'tony_stark','AURA3':'aura3','AURA 3':'aura3'};
  return {scope:'department',action:m[1]==='PAUSE'?'pause':'resume',department:map[m[2]]};
}

export async function getPauseState(env){return readJson(env,VICTOR_REPO,VICTOR_PATH,{global_pause_active:false,departments:{}});}
export async function isExecutionPaused(env,department=null){
  const s=await getPauseState(env);const ds=department?s.departments?.[department]:null;
  return {paused:s.global_pause_active===true||String(s.system_state||'').toUpperCase()==='PAUSED'||ds?.pause_active===true,global_pause_active:s.global_pause_active===true,department_pause_active:ds?.pause_active===true,department};
}

export async function applyEmergencyCommand(env,command,metadata={}){
  if(!command)throw new Error('INVALID_PAUSE_COMMAND');const now=new Date().toISOString();let s=await getPauseState(env);s={...s,schema_version:1,canonical:true,authority:'FOUNDER_VIA_VICTOR',departments:{...(s.departments||{})},last_command:command.scope==='system'?`SYSTEM ${command.action.toUpperCase()}`:`${command.action.toUpperCase()} ${command.department}`,last_command_at_utc:now,last_command_source:'FOUNDER_TELEGRAM'};
  if(command.scope==='system'){
    const paused=command.action==='pause';s.global_pause_active=paused;s.system_state=paused?'PAUSED':'RUNNING';s.pause_reason=paused?(metadata.reason||'FOUNDER_SYSTEM_PAUSE'):null;
  }else{s.departments[command.department]={...(s.departments[command.department]||{}),pause_active:command.action==='pause',state:command.action==='pause'?'PAUSED':'RUNNING',updated_at_utc:now,authority:'FOUNDER_VIA_VICTOR'};}
  await writeJson(env,VICTOR_REPO,VICTOR_PATH,s,`safety: ${s.last_command}`);
  let rioMirror='NOT_APPLICABLE';
  if(command.scope==='system'||command.department==='rio'){
    const rs=await readJson(env,RIO_REPO,RIO_PATH,{schema_version:1});const global=command.scope==='system'?command.action==='pause':Boolean(rs.global_pause_active);const dept=command.scope==='department'?command.action==='pause':Boolean(rs.department_pause_active);
    const next={...rs,schema_version:1,system_state:global?'PAUSED':'RUNNING',global_pause_active:global,department_pause_active:dept,authority:'FOUNDER_VIA_VICTOR',last_command:s.last_command,last_command_at_utc:now};
    try{await writeJson(env,RIO_REPO,RIO_PATH,next,`safety: mirror ${s.last_command}`);rioMirror='ACKNOWLEDGED';}catch(e){rioMirror='PAUSE_UNCONFIRMED';if(command.action==='pause')return {status:'PAUSE_UNCONFIRMED',state:s,rio_mirror:rioMirror,error:String(e.message||e)};}
  }
  return {status:command.action==='pause'?'PAUSED':'RESUMED',state:s,rio_mirror:rioMirror};
}
