import { callVictorModel } from './model_router.mjs';

const REGISTRY_URL = 'https://raw.githubusercontent.com/vickykenin-lang/Dr.-Victor-Multi-AI-Orchestrator/main/data/department_registry.json';

const DEPARTMENT_EVIDENCE = Object.freeze({
  victor: Object.freeze([
    ['current_status', 'https://raw.githubusercontent.com/vickykenin-lang/Dr.-Victor-Multi-AI-Orchestrator/main/data/post_endgame_current_status.json'],
    ['production_acceptance', 'https://raw.githubusercontent.com/vickykenin-lang/Dr.-Victor-Multi-AI-Orchestrator/main/data/production_acceptance_status.json'],
    ['heartbeat', 'https://raw.githubusercontent.com/vickykenin-lang/Dr.-Victor-Multi-AI-Orchestrator/main/data/victor_heartbeat_status.json'],
    ['v2_status', 'https://raw.githubusercontent.com/vickykenin-lang/Dr.-Victor-Multi-AI-Orchestrator/main/data/victor_v2_execution_status.json'],
  ]),
  rio: Object.freeze([
    ['status', 'https://raw.githubusercontent.com/vickykenin-lang/rio-affiliate-engine/main/data/status.json'],
    ['work_status', 'https://raw.githubusercontent.com/vickykenin-lang/rio-affiliate-engine/main/data/rio_work_status.json'],
    ['dashboard', 'https://raw.githubusercontent.com/vickykenin-lang/rio-affiliate-engine/main/data/dashboard_snapshot.json'],
    ['publish_state', 'https://raw.githubusercontent.com/vickykenin-lang/rio-affiliate-engine/main/data/content_publish_state.json'],
    ['instagram_published', 'https://raw.githubusercontent.com/vickykenin-lang/rio-affiliate-engine/main/data/ig_published.json'],
    ['production_control', 'https://raw.githubusercontent.com/vickykenin-lang/rio-affiliate-engine/main/data/production_control.json'],
  ]),
  aura3: Object.freeze([
    ['status', 'https://raw.githubusercontent.com/vickykenin-lang/aura-3.0/main/data/status.json'],
    ['published', 'https://raw.githubusercontent.com/vickykenin-lang/aura-3.0/main/content/published.json'],
    ['approvals', 'https://raw.githubusercontent.com/vickykenin-lang/aura-3.0/main/data/approvals.json'],
    ['gate_results', 'https://raw.githubusercontent.com/vickykenin-lang/aura-3.0/main/data/gate_results.json'],
    ['approval_queue_status', 'https://raw.githubusercontent.com/vickykenin-lang/aura-3.0/main/data/approval_queue_status.json'],
    ['calendar', 'https://raw.githubusercontent.com/vickykenin-lang/aura-3.0/main/content/calendar.json'],
    ['dashboard_source', 'https://raw.githubusercontent.com/vickykenin-lang/aura-3.0/main/index.html'],
  ]),
  tony_stark: Object.freeze([
    ['current_state', 'https://raw.githubusercontent.com/vickykenin-lang/tony-stark-engineering/main/state/current_state.json'],
    ['ai_runtime_status', 'https://raw.githubusercontent.com/vickykenin-lang/tony-stark-engineering/main/state/ai_runtime_status.json'],
    ['autonomy_status', 'https://raw.githubusercontent.com/vickykenin-lang/tony-stark-engineering/main/state/autonomy_status.json'],
    ['github_access_status', 'https://raw.githubusercontent.com/vickykenin-lang/tony-stark-engineering/main/state/github_access_status.json'],
    ['readme', 'https://raw.githubusercontent.com/vickykenin-lang/tony-stark-engineering/main/README.md'],
  ]),
});

const STATIC_EVIDENCE = Object.freeze({
  aura3: Object.freeze([
    { label: 'dashboard_repo_file', value: { repo:'vickykenin-lang/aura-3.0', path:'index.html', github_url:'https://github.com/vickykenin-lang/aura-3.0/blob/main/index.html', note:'Founder approval dashboard source file' } },
  ]),
  tony_stark: Object.freeze([
    { label: 'repository', value: { repo:'vickykenin-lang/tony-stark-engineering', github_url:'https://github.com/vickykenin-lang/tony-stark-engineering' } },
  ]),
});

function compact(value, max = 5000) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return String(text || '').slice(0, max);
}

async function fetchEvidence(url) {
  const response = await fetch(`${url}?t=${Date.now()}`, {
    headers: { 'User-Agent': 'Victor-Department-Query/1.1', 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) return null;
  const contentType = response.headers.get('content-type') || '';
  try {
    return contentType.includes('json') ? await response.json() : await response.text();
  } catch {
    return null;
  }
}

async function departmentRegistryEvidence(department) {
  if (department === 'victor') return null;
  const registry = await fetchEvidence(REGISTRY_URL);
  const item = Array.isArray(registry?.departments) ? registry.departments.find(d => d.id === department) : null;
  return item ? { label: 'victor/data/department_registry.json', value: item } : null;
}

export async function buildDepartmentEvidencePack(department) {
  const evidence = [];
  const canonical = await departmentRegistryEvidence(department);
  if (canonical) evidence.push(canonical);

  for (const item of STATIC_EVIDENCE[department] || []) evidence.push(item);
  const sources = DEPARTMENT_EVIDENCE[department] || [];
  for (const [label, url] of sources) {
    const value = await fetchEvidence(url);
    if (value !== null) evidence.push({ label, value });
  }
  return evidence;
}

export async function answerDepartmentQuestion(env, department, question) {
  const evidence = await buildDepartmentEvidencePack(department);
  const fetchedAt = new Date().toISOString();
  if (!evidence.length) {
    return {
      reply: `Verified read-only evidence ${department} ke liye available nahi hai. Main guess nahi karunga.\nFetched at: ${fetchedAt}`,
      verified: false,
      capability_gap: 'DEPARTMENT_QUERY_EVIDENCE_NOT_AVAILABLE',
    };
  }

  const evidenceText = evidence
    .map(item => `SOURCE: ${item.label}\n${compact(item.value)}`)
    .join('\n\n---\n\n')
    .slice(0, 22000);

  const system = `You answer a Founder's read-only question about one Victor department or Victor itself. Use ONLY the supplied evidence. Do not invent facts, do not claim an action happened, and do not dispatch execution. If the evidence does not answer the question, say clearly that verified evidence is insufficient. Answer in the Founder's language, concise and natural. Include key date/time/count/status/link when present. If the Founder asks for a repo/dashboard link and a verified github_url/path is supplied, return it directly. Do not dump raw JSON. End with a short source line naming the relevant evidence labels.`;
  const user = `DEPARTMENT: ${department}\nQUESTION: ${question}\nFETCHED_AT: ${fetchedAt}\n\nVERIFIED EVIDENCE:\n${evidenceText}`;

  const result = await callVictorModel(env, system, user, { task: 'fast', maxTokens: 500, temperature: 0 });
  const reply = String(result?.content || '').trim();
  if (!reply) {
    return {
      reply: `Verified evidence fetch ho gaya, lekin answer synthesize nahi hua. Main guess nahi karunga.\nFetched at: ${fetchedAt}`,
      verified: false,
      capability_gap: 'DEPARTMENT_QUERY_SYNTHESIS_EMPTY',
    };
  }
  return { reply, verified: true, evidence_count: evidence.length, fetched_at: fetchedAt };
}

export function hasExtendedEvidencePack(department) {
  return Boolean(DEPARTMENT_EVIDENCE[department] || STATIC_EVIDENCE[department]);
}
