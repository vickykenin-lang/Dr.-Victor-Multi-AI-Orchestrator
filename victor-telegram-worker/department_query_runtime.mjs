import { callVictorModel } from './model_router.mjs';

const REGISTRY_URL = 'https://raw.githubusercontent.com/vickykenin-lang/Dr.-Victor-Multi-AI-Orchestrator/main/data/department_registry.json';

const DEPARTMENT_EVIDENCE = Object.freeze({
  rio: Object.freeze([
    ['status', 'https://raw.githubusercontent.com/vickykenin-lang/rio-affiliate-engine/main/data/status.json'],
    ['work_status', 'https://raw.githubusercontent.com/vickykenin-lang/rio-affiliate-engine/main/data/rio_work_status.json'],
    ['dashboard', 'https://raw.githubusercontent.com/vickykenin-lang/rio-affiliate-engine/main/data/dashboard_snapshot.json'],
    ['publish_state', 'https://raw.githubusercontent.com/vickykenin-lang/rio-affiliate-engine/main/data/content_publish_state.json'],
    ['instagram_published', 'https://raw.githubusercontent.com/vickykenin-lang/rio-affiliate-engine/main/data/ig_published.json'],
    ['production_control', 'https://raw.githubusercontent.com/vickykenin-lang/rio-affiliate-engine/main/data/production_control.json'],
  ]),
  aura3: Object.freeze([
    ['published', 'https://raw.githubusercontent.com/vickykenin-lang/aura-3.0/main/content/published.json'],
    ['approvals', 'https://raw.githubusercontent.com/vickykenin-lang/aura-3.0/main/data/approvals.json'],
    ['gate_results', 'https://raw.githubusercontent.com/vickykenin-lang/aura-3.0/main/data/gate_results.json'],
    ['approval_queue_status', 'https://raw.githubusercontent.com/vickykenin-lang/aura-3.0/main/data/approval_queue_status.json'],
    ['calendar', 'https://raw.githubusercontent.com/vickykenin-lang/aura-3.0/main/content/calendar.json'],
  ]),
});

function compact(value, max = 5000) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return String(text || '').slice(0, max);
}

async function fetchEvidence(url) {
  const response = await fetch(`${url}?t=${Date.now()}`, {
    headers: { 'User-Agent': 'Victor-Department-Query/1.0', 'Cache-Control': 'no-cache' },
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
  const registry = await fetchEvidence(REGISTRY_URL);
  const item = Array.isArray(registry?.departments) ? registry.departments.find(d => d.id === department) : null;
  return item ? { label: 'victor/data/department_registry.json', value: item } : null;
}

export async function buildDepartmentEvidencePack(department) {
  const evidence = [];
  const canonical = await departmentRegistryEvidence(department);
  if (canonical) evidence.push(canonical);

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
    .slice(0, 18000);

  const system = `You answer a Founder's read-only question about one Victor department. Use ONLY the supplied evidence. Do not invent facts, do not claim an action happened, and do not dispatch or recommend execution. If the evidence does not answer the question, say clearly that verified evidence is insufficient. Answer in the Founder's language, concise and natural. Include the key date/time/count/status when present. Do not dump raw JSON. End with a short source line naming the relevant evidence labels.`;
  const user = `DEPARTMENT: ${department}\nQUESTION: ${question}\nFETCHED_AT: ${fetchedAt}\n\nVERIFIED EVIDENCE:\n${evidenceText}`;

  const result = await callVictorModel(env, system, user, { task: 'fast', maxTokens: 450, temperature: 0 });
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
  return Boolean(DEPARTMENT_EVIDENCE[department]);
}
