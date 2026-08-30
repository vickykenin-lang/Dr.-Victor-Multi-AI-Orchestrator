from pathlib import Path

PATH = Path('victor-telegram-worker/autonomy_runtime.mjs')
text = PATH.read_text(encoding='utf-8')
original = text

old = '''async function updateRepoJson(env, path, next, message) {
  const tokens = [...new Set([env.GITHUB_ORCHESTRATION_TOKEN, env.GITHUB_MEMORY_TOKEN].filter(Boolean))];
  if (!tokens.length) throw new Error('GOAL_STATE_TOKEN_NOT_CONFIGURED');
  const api = `https://api.github.com/repos/${VICTOR_REPO}/contents/${path}`;
  let lastError = 'UNKNOWN';
  for (const token of tokens) {
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'Dr-Victor-Goal-Runtime/2.0' };
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const currentResponse = await fetch(`${api}?ref=main&t=${Date.now()}`, { headers, cache: 'no-store' });
      if (!currentResponse.ok) { lastError = `READ_HTTP_${currentResponse.status}`; if ([401, 403].includes(currentResponse.status)) break; continue; }
      const currentFile = await currentResponse.json();
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(next, null, 2) + '\\n')));
      const updateResponse = await fetch(api, { method: 'PUT', headers, body: JSON.stringify({ message, content: encoded, sha: currentFile.sha, branch: 'main' }) });
      if (updateResponse.ok) return next;
      lastError = `WRITE_HTTP_${updateResponse.status}`;
      if ([401, 403].includes(updateResponse.status)) break;
      if ([409, 422].includes(updateResponse.status)) { await new Promise(resolve => setTimeout(resolve, attempt * 750)); continue; }
      break;
    }
  }
  throw new Error(`GOAL_STATE_PERSIST_FAILED_${lastError}`);
}

export async function persistAutonomyEvidence(env, controller, result) {
  const previous = await readRepoJson(env, AUTONOMY_STATE_PATH, {});
  const next = buildAutonomyEvidence(previous, result, controller);
  return updateRepoJson(env, AUTONOMY_STATE_PATH, next, `Record Victor goal-driven cycle: ${result.status}`);
}
'''

new = '''async function updateRepoJson(env, path, nextOrBuilder, message) {
  const tokens = [...new Set([env.GITHUB_ORCHESTRATION_TOKEN, env.GITHUB_MEMORY_TOKEN].filter(Boolean))];
  if (!tokens.length) throw new Error('GOAL_STATE_TOKEN_NOT_CONFIGURED');
  const api = `https://api.github.com/repos/${VICTOR_REPO}/contents/${path}`;
  let lastError = 'UNKNOWN';
  for (const token of tokens) {
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'Dr-Victor-Goal-Runtime/2.2' };
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const currentResponse = await fetch(`${api}?ref=main&t=${Date.now()}`, { headers, cache: 'no-store' });
      if (!currentResponse.ok) { lastError = `READ_HTTP_${currentResponse.status}`; if ([401, 403].includes(currentResponse.status)) break; continue; }
      const currentFile = await currentResponse.json();
      let current = {};
      try { current = JSON.parse(decodeURIComponent(escape(atob(currentFile.content || '')))); } catch (_) { current = {}; }
      // Rebuild from the freshest repository document on every retry. This is
      // critical: a new SHA with an old precomputed body would silently erase a
      // concurrent cycle's state even though the retry itself succeeds.
      const next = typeof nextOrBuilder === 'function' ? nextOrBuilder(current) : nextOrBuilder;
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(next, null, 2) + '\\n')));
      const updateResponse = await fetch(api, { method: 'PUT', headers, body: JSON.stringify({ message, content: encoded, sha: currentFile.sha, branch: 'main' }) });
      if (updateResponse.ok) return next;
      lastError = `WRITE_HTTP_${updateResponse.status}`;
      if ([401, 403].includes(updateResponse.status)) break;
      if ([409, 422].includes(updateResponse.status)) { await new Promise(resolve => setTimeout(resolve, attempt * 750)); continue; }
      break;
    }
  }
  throw new Error(`GOAL_STATE_PERSIST_FAILED_${lastError}`);
}

export async function persistAutonomyEvidence(env, controller, result) {
  return updateRepoJson(
    env,
    AUTONOMY_STATE_PATH,
    current => buildAutonomyEvidence(current || {}, result, controller),
    `Record Victor goal-driven cycle: ${result.status}`,
  );
}
'''

if new not in text:
    if old not in text:
        raise SystemExit('PATCH_ANCHOR_NOT_FOUND:updateRepoJson')
    text = text.replace(old, new, 1)

old_goal = '''async function persistGoalRuntimeState(env, nextState, goalId) {
  return updateRepoJson(env, GOAL_RUNTIME_STATE_PATH, nextState, `Record Victor goal progress: ${goalId}`);
}
'''
new_goal = '''async function persistGoalRuntimeState(env, nextState, goalId) {
  return updateRepoJson(
    env,
    GOAL_RUNTIME_STATE_PATH,
    current => ({
      ...(current || {}),
      ...nextState,
      goals: {
        ...((current || {}).goals || {}),
        ...((nextState || {}).goals || {}),
        [goalId]: nextState?.goals?.[goalId] || current?.goals?.[goalId] || {},
      },
    }),
    `Record Victor goal progress: ${goalId}`,
  );
}
'''
if new_goal not in text:
    if old_goal not in text:
        raise SystemExit('PATCH_ANCHOR_NOT_FOUND:persistGoalRuntimeState')
    text = text.replace(old_goal, new_goal, 1)

if text == original:
    print('NO_CHANGES_ALREADY_APPLIED')
else:
    PATH.write_text(text, encoding='utf-8')
    print('CONFLICT_SAFE_STATE_PERSISTENCE_APPLIED')
