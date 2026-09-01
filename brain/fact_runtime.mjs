const REPOS = {
  rio: 'vickykenin-lang/rio-affiliate-engine',
  aura3: 'vickykenin-lang/aura-3.0',
  tony_stark: 'vickykenin-lang/tony-stark-engineering',
};

export function classifyFactRequest(text = '') {
  const value = String(text || '').toLowerCase();
  const asksExact = /\b(exact|timestamp|time stamp|kitne|count|number|commit|activity date|last commit|heartbeat|cached|default response|template|real[- ]?time|sach batao|pause|paused|auto[- ]?publish|alerts?|log|ground truth|data\/|\.json)\b/i.test(value);
  const asksEvidence = /\b(evidence|proof|verify|verified|source|github|repo|repository|fresh|actual|concrete|specific)\b/i.test(value);
  const targets = [];
  if (/\brio\b|instagram|heartbeat|rio alerts?/i.test(value)) targets.push('rio');
  if (/\baura\s*3\b|\baura3\b|vickykenin-lang\/aura-3\.0/i.test(value)) targets.push('aura3');
  if (/\btony(?:\s+stark)?\b/i.test(value)) targets.push('tony_stark');
  return {
    matched: asksExact || asksEvidence,
    targets: [...new Set(targets)],
    asksHeartbeat: /heartbeat/i.test(value),
    asksPause: /(pause|paused|auto[- ]?publish|instagram.*(on|off|enabled|disabled))/i.test(value),
    asksCommit: /(last commit|commit date|activity date|github.*activity|repo.*activity)/i.test(value),
    asksCounts: /(kitne|count|number|how many|total).*(heartbeat|run|cycle|fail|complete)|(heartbeat|run|cycle).*(kitne|count|number|how many|total)/i.test(value),
    asksCachedTruth: /(cached|default response|template|real[- ]?time|sach batao)/i.test(value),
  };
}

function ghHeaders(env) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Dr-Victor-Fact-Runtime/1.0',
  };
  if (env?.GITHUB_ORCHESTRATION_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_ORCHESTRATION_TOKEN}`;
  return headers;
}

async function ghJson(env, url) {
  const res = await fetch(url, { headers: ghHeaders(env), cache: 'no-store' });
  if (!res.ok) throw new Error(`GITHUB_FACT_HTTP_${res.status}`);
  return res.json();
}

async function repoJson(env, repo, path) {
  const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=main&t=${Date.now()}`;
  const res = await fetch(url, { headers: { ...ghHeaders(env), Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' });
  if (!res.ok) return { ok: false, status: res.status, path };
  try { return { ok: true, path, value: await res.json() }; }
  catch { return { ok: false, status: 0, path }; }
}

async function latestCommit(env, repo) {
  const rows = await ghJson(env, `https://api.github.com/repos/${repo}/commits?per_page=1&t=${Date.now()}`);
  const c = Array.isArray(rows) ? rows[0] : null;
  return c ? {
    sha: c.sha,
    date: c.commit?.committer?.date || c.commit?.author?.date || null,
    message: c.commit?.message || null,
    html_url: c.html_url || null,
  } : null;
}

function dateWindowFromText(text = '') {
  const iso = [...String(text).matchAll(/20\d{2}-\d{2}-\d{2}/g)].map(m => m[0]);
  if (iso.length >= 2) return `${iso[0]}..${iso[1]}`;
  return null;
}

async function rioWorkflowCounts(env, text) {
  const created = dateWindowFromText(text);
  const suffix = created ? `&created=${encodeURIComponent(created)}` : '';
  const payload = await ghJson(env, `https://api.github.com/repos/${REPOS.rio}/actions/runs?per_page=100${suffix}`);
  const runs = (payload.workflow_runs || []).filter(run => run.name === 'RIO');
  const counts = runs.reduce((acc, run) => {
    const key = run.conclusion || run.status || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    scope: created ? `created=${created}` : 'latest 100 repository workflow runs (filtered to workflow name RIO)',
    rio_runs_fetched: runs.length,
    counts,
    latest: runs[0] ? {
      id: runs[0].id,
      created_at: runs[0].created_at,
      updated_at: runs[0].updated_at,
      conclusion: runs[0].conclusion,
      event: runs[0].event,
    } : null,
    note: 'These are RIO workflow-run conclusions. A workflow can fail because a non-heartbeat job failed, so this is not automatically identical to heartbeat-job failure count.',
  };
}

export async function collectFactEvidence(env, text, classification = classifyFactRequest(text)) {
  const evidence = { fetched_at_utc: new Date().toISOString(), targets: classification.targets, rio: null, aura3: null, tony_stark: null };

  if (classification.targets.includes('rio') || classification.asksHeartbeat || classification.asksPause) {
    const [runner, control, production, work, igRun] = await Promise.all([
      repoJson(env, REPOS.rio, 'data/heartbeat_runner_status.json'),
      repoJson(env, REPOS.rio, 'data/control.json'),
      repoJson(env, REPOS.rio, 'data/production_control.json'),
      repoJson(env, REPOS.rio, 'data/rio_work_status.json'),
      repoJson(env, REPOS.rio, 'data/instagram_run_status.json'),
    ]);
    evidence.rio = {
      heartbeat_runner_status: runner.ok ? runner.value : null,
      control: control.ok ? control.value : null,
      production_control: production.ok ? production.value : null,
      work_status: work.ok ? work.value : null,
      instagram_run_status: igRun.ok ? igRun.value : null,
      sources: [runner, control, production, work, igRun].map(x => ({ path: x.path, ok: x.ok, status: x.status || 200 })),
    };
    if (classification.asksCounts) {
      try { evidence.rio.workflow_counts = await rioWorkflowCounts(env, text); }
      catch (error) { evidence.rio.workflow_counts_error = String(error?.message || 'unknown'); }
    }
    if (classification.asksCommit) {
      try { evidence.rio.latest_commit = await latestCommit(env, REPOS.rio); } catch (_) {}
    }
  }

  if (classification.targets.includes('aura3') || (classification.asksCommit && /aura/i.test(text))) {
    try { evidence.aura3 = { latest_commit: await latestCommit(env, REPOS.aura3) }; }
    catch (error) { evidence.aura3 = { error: String(error?.message || 'unknown') }; }
  }

  if (classification.targets.includes('tony_stark') || (classification.asksCommit && /tony/i.test(text))) {
    try { evidence.tony_stark = { latest_commit: await latestCommit(env, REPOS.tony_stark) }; }
    catch (error) { evidence.tony_stark = { error: String(error?.message || 'unknown') }; }
  }

  return evidence;
}

export function buildFactAnswerPrompt(founderText, evidence) {
  return [
    'You are Victor answering the Founder from freshly retrieved GitHub evidence.',
    'Answer every part of the Founder question. Do not ignore a second department or second sub-question.',
    'Give exact numbers/timestamps/commit dates when present. If a requested number is not supported by the fetched scope, say exactly what was counted and what remains unknown.',
    'Do not replace facts with reassurance, status templates, or phrases like “trace kar raha hoon”.',
    'If current canonical data conflicts with an older alert/message, explicitly distinguish OLD ALERT from CURRENT STATE and cite the current field/value in plain language.',
    'For heartbeat counts, preserve the runtime note: workflow-run conclusion is not necessarily identical to heartbeat-job conclusion.',
    'If asked whether the reply is cached/default/template, say this answer used fresh GitHub reads at fetched_at_utc. Do not claim real-time beyond those reads.',
    'Use natural concise Hinglish. No markdown table. Internal source paths may be named because the Founder explicitly asked for evidence.',
    `Founder question: ${String(founderText || '').trim()}`,
    `Fresh evidence JSON: ${JSON.stringify(evidence)}`,
  ].join('\n\n');
}
