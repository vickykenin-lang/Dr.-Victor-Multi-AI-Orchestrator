const GITHUB_API = 'https://api.github.com';
const AURA3_REPO = 'vickykenin-lang/aura-3.0';
const AURA3_WORKFLOW = 'victor-aura3-transport.yml';
const AURA3_RAW = 'https://raw.githubusercontent.com/vickykenin-lang/aura-3.0/main';

export function aura3BridgeConfigured(env) {
  return Boolean(env.GITHUB_ORCHESTRATION_TOKEN);
}

export function selectAura3TaskType(text) {
  const value = String(text || '').toLowerCase();
  if (/recover|recovery|thik|fix|repair|production.?ready|system.*(thik|fix)/.test(value)) return 'RECOVERY_EXECUTE';
  if (/certif|bridge|connect|communication|strict|supervision/.test(value)) return 'STRICT_SUPERVISION_PROBE';
  if (/govern|authority|soul|rule/.test(value)) return 'GOVERNANCE_CHECK';
  if (/capabilit|kya kar sak|features|scope/.test(value)) return 'CAPABILITY_CATALOG';
  return 'STATUS_CHECK';
}

export function shouldContactAura3(text, entity) {
  if (entity?.entity_id !== 'aura3') return false;
  const value = String(text || '').toLowerCase();
  return /status|report|error|problem|issue|check|pucho|pooch|baat|connect|bridge|communication|certif|supervision|progress|objective|recover|recovery|thik|fix|repair|production.?ready|system/.test(value);
}

export async function dispatchAura3Task(env, text, metadata = {}) {
  if (!aura3BridgeConfigured(env)) {
    return { status: 'PENDING_CONFIGURATION', reason: 'GITHUB_ORCHESTRATION_TOKEN_NOT_CONFIGURED' };
  }

  const taskType = selectAura3TaskType(text);
  const taskId = `victor-aura3-${Date.now()}-${metadata.messageId || 'msg'}`;
  const response = await fetch(`${GITHUB_API}/repos/${AURA3_REPO}/actions/workflows/${AURA3_WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: githubHeaders(env),
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        task_id: taskId,
        task_type: taskType,
        payload: JSON.stringify({
          founder_message: String(text || '').slice(0, 1000),
          requested_by: 'victor',
          supervision_mode: 'STRICT',
        }),
      },
    }),
  });

  if (response.status !== 204) {
    const detail = await safeText(response);
    throw new Error(`AURA3 dispatch HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }

  return { status: 'DISPATCHED', taskId, taskType };
}

export async function waitForAura3Result(taskId, options = {}) {
  const attempts = options.attempts || 18;
  const delayMs = options.delayMs || 4000;
  const safeTaskId = String(taskId).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  const url = `${AURA3_RAW}/integration/results/tasks/${encodeURIComponent(safeTaskId)}.json`;

  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) await sleep(delayMs);
    const response = await fetch(`${url}?t=${Date.now()}`, {
      headers: { 'User-Agent': 'Dr-Victor-AURA3-Bridge/1.0', 'Cache-Control': 'no-cache' },
    });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`AURA3 result HTTP ${response.status}`);
    const result = await response.json();
    if (result?.task_id !== taskId) continue;
    return { status: 'RESULT_RECEIVED', result };
  }
  return { status: 'TIMEOUT', taskId };
}

export function verifyAura3Result(result, expectedTaskId) {
  const strict = result?.strict_supervision || {};
  const checks = {
    task_id: result?.task_id === expectedTaskId,
    sender: result?.sender === 'aura3',
    recipient: result?.recipient === 'victor',
    message_type: result?.message_type === 'TASK_RESULT',
    no_public_action: result?.public_action_performed === false,
    revert_to_victor: strict?.revert_to_victor === true,
    objective_alignment: Boolean(strict?.objective_alignment),
    status: Boolean(strict?.status),
    solution: Boolean(strict?.solution),
    next_action: Boolean(strict?.next_action),
    evidence: Array.isArray(strict?.evidence) && strict.evidence.length > 0,
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

export function formatAura3ResultForFounder(result) {
  const strict = result?.strict_supervision || {};
  const blockers = strict.error_or_blocker ?? result?.blockers ?? null;
  const parts = [
    `AURA3 se fresh revert aa gaya.`,
    `Status: ${strict.status || result?.execution_status || 'UNKNOWN'}`,
    `Objective alignment: ${strict.objective_alignment || 'UNKNOWN'}`,
  ];
  if (blockers && (!(Array.isArray(blockers)) || blockers.length)) {
    parts.push(`Error/Blocker: ${Array.isArray(blockers) ? blockers.join(', ') : String(blockers)}`);
  } else {
    parts.push('Error/Blocker: none reported');
  }
  if (strict.root_cause) parts.push(`Root cause: ${strict.root_cause}`);
  parts.push(`Solution: ${strict.solution || 'NOT_PROVIDED'}`);
  parts.push(`Next action: ${strict.next_action || result?.next_valid_action || 'NOT_PROVIDED'}`);
  parts.push(`Evidence: ${Array.isArray(strict.evidence) ? strict.evidence.join(', ') : 'NOT_PROVIDED'}`);
  return parts.join('\n');
}

function githubHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_ORCHESTRATION_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'Dr-Victor-Orchestrator/1.0',
  };
}

async function safeText(response) {
  try { return await response.text(); } catch { return ''; }
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

const RIO_REPO = 'vickykenin-lang/rio-affiliate-engine';
const RIO_WORKFLOW = 'victor-rio-transport.yml';
const RIO_RAW = 'https://raw.githubusercontent.com/vickykenin-lang/rio-affiliate-engine/main';

export function rioBridgeConfigured(env) { return Boolean(env.GITHUB_ORCHESTRATION_TOKEN); }

export function selectRioTaskType(text) {
  const value = String(text || '').toLowerCase();
  if (/victor goal contract|goal id:|org-revenue-001|replan_execute/.test(value)) return 'GOAL_EXECUTE';
  if (/activat|start|resume|kaam par|self.?mode/.test(value)) return 'PRIORITY_CHECK';
  if (/certif|bridge|connect|communication|strict|supervision|round.?trip/.test(value)) return 'STRICT_SUPERVISION_PROBE';
  if (/govern|authority|objective|soul|rule/.test(value)) return 'GOVERNANCE_CHECK';
  if (/priority|next|plan|agenda|progress/.test(value)) return 'PRIORITY_CHECK';
  return 'STATUS_CHECK';
}

export function shouldContactRio(text, entity) {
  const value = String(text || '').toLowerCase();
  const explicitTonyAssignment = /\btony(?:\s+stark)?\b/.test(value)
    && /\b(task|implement|build|create|modify|upgrade|audit|inspect|solve|kaam|assign|bhejo)\b/.test(value);
  if (explicitTonyAssignment) return false;
  if (entity?.entity_id !== 'rio') return false;
  return /status|report|check|pucho|pooch|batao|baat|connect|bridge|communication|certif|supervision|round.?trip|progress|objective|govern|priority|next|plan|agenda|activat|start|shuru|resume|kaam par|self.?mode|approval|post|ready|publish|published|design|creative|kitne|banaya|banana/.test(value);
}

export async function dispatchRioTask(env, text, metadata = {}) {
  if (!rioBridgeConfigured(env)) return { status: 'PENDING_CONFIGURATION', reason: 'GITHUB_ORCHESTRATION_TOKEN_NOT_CONFIGURED' };
  const taskType = selectRioTaskType(text);
  const taskId = `victor-rio-${Date.now()}-${metadata.messageId || 'msg'}`;
  const response = await fetch(`${GITHUB_API}/repos/${RIO_REPO}/actions/workflows/${RIO_WORKFLOW}/dispatches`, {
    method: 'POST', headers: githubHeaders(env),
    body: JSON.stringify({ ref: 'main', inputs: { task_id: taskId, task_type: taskType, payload: JSON.stringify({ founder_message: String(text || '').slice(0, 1000), requested_by: 'victor', supervision_mode: 'STRICT', external_action_authorized: taskType === 'GOAL_EXECUTE' }) } }),
  });
  if (response.status !== 204) {
    const detail = await safeText(response);
    throw new Error(`RIO dispatch HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  return { status: 'DISPATCHED', taskId, taskType };
}

export async function waitForRioResult(taskId, options = {}) {
  const attempts = options.attempts || 18;
  const delayMs = options.delayMs || 4000;
  const safeTaskId = String(taskId).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  const url = `${RIO_RAW}/integration/results/victor_tasks/${encodeURIComponent(safeTaskId)}.json`;
  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) await sleep(delayMs);
    const response = await fetch(`${url}?t=${Date.now()}`, { headers: { 'User-Agent': 'Dr-Victor-RIO-Bridge/1.0', 'Cache-Control': 'no-cache' } });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`RIO result HTTP ${response.status}`);
    const result = await response.json();
    if (result?.task_id === taskId) return { status: 'RESULT_RECEIVED', result };
  }
  return { status: 'TIMEOUT', taskId };
}

export function verifyRioResult(result, expectedTaskId) {
  const strict = result?.strict_supervision || {};
  const checks = {
    task_id: result?.task_id === expectedTaskId, sender: result?.sender === 'rio', recipient: result?.recipient === 'victor',
    message_type: result?.message_type === 'TASK_RESULT', public_action_authorized: result?.public_action_performed === false || (result?.task_type === 'GOAL_EXECUTE' && result?.governed_business_cycle_performed === true && result?.external_action_authorized === true),
    no_objective_change: result?.objective_changed === false, no_credential_transfer: result?.credential_transfer_performed === false,
    revert_to_victor: strict?.revert_to_victor === true, objective_alignment: Boolean(strict?.objective_alignment),
    status: Boolean(strict?.status), solution: Boolean(strict?.solution), next_action: Boolean(strict?.next_action),
    evidence: Array.isArray(strict?.evidence) && strict.evidence.length > 0, follow_up_explicit: typeof strict?.requires_follow_up === 'boolean',
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

export function formatRioResultForFounder(result) {
  const strict = result?.strict_supervision || {};
  const content = strict?.outcome_progress?.content || result?.snapshot?.content || null;
  const lines = [
    'RIO se fresh verified revert aa gaya.',
    `Status: ${strict.status || result?.execution_status || 'UNKNOWN'}`,
    `Objective alignment: ${strict.objective_alignment || 'UNKNOWN'}`,
  ];
  if (content) {
    lines.push(`Ready-to-post promos: ${Number(content.ready_to_post_count) || 0}${Array.isArray(content.ready_to_post_ids) && content.ready_to_post_ids.length ? ` (${content.ready_to_post_ids.join(', ')})` : ''}`);
    lines.push(`Actually published posts: ${Number(content.actually_published_count) || 0}`);
    if (content.new_design_started_verified === true) lines.push('New-design creative: verified started');
    else if (content.new_design_started_verified === false) lines.push('New-design creative: verified not started');
    else lines.push('New-design creative: fresh verified evidence unavailable; no absolute claim.');
  }
  lines.push(`Error/Blocker: ${strict.error_or_blocker || 'none reported'}`);
  lines.push(`Solution: ${strict.solution || 'NOT_PROVIDED'}`);
  lines.push(`Next action: ${strict.next_action || 'NOT_PROVIDED'}`);
  lines.push(`Evidence: ${Array.isArray(strict.evidence) ? strict.evidence.join(', ') : 'NOT_PROVIDED'}`);
  return lines.join('\n');
}


const TONY_REPO = 'vickykenin-lang/tony-stark-engineering';
const TONY_WORKFLOW = 'victor_tony_transport.yml';

export function tonyBridgeConfigured(env) {
  return Boolean(env.GITHUB_ORCHESTRATION_TOKEN);
}

export function selectTonyTaskType(text) {
  const value = String(text || '').toLowerCase();
  if (/\b(task|implement|build|create|modify|upgrade|audit|inspect|solve|kaam)\b/.test(value)) return 'TASK_REQUEST';
  if (/repair plan|solution|fix plan/.test(value)) return 'REPAIR_PLAN';
  if (/post.?repair|verify repair|recovery verify/.test(value)) return 'POST_REPAIR_VERIFY';
  if (/diagnos|error|problem|issue|root cause|blocker/.test(value)) return 'DIAGNOSTIC';
  if (/health|heartbeat|runtime/.test(value)) return 'HEALTH_CHECK';
  return 'STATUS_CHECK';
}

export function buildTonyTaskPayload(text) {
  const founderMessage = String(text || '').trim().slice(0, 3000);
  const explicitRepo = (founderMessage.match(/vickykenin-lang\/[A-Za-z0-9._-]+/i)?.[0] || '').replace(/[.,;:!?]+$/, '') || null;
  const lower = founderMessage.toLowerCase();
  const targetRepository = explicitRepo
    || (/\brio\b/.test(lower) ? 'vickykenin-lang/rio-affiliate-engine' : null)
    || (/\b(memory|victor)\b/.test(lower) ? 'vickykenin-lang/Dr.-Victor-Multi-AI-Orchestrator' : null);
  const requestedActions = ['READ_REPOSITORY', 'ANALYZE', 'RETURN_EVIDENCE'];
  const requestedLevel = founderMessage.match(/\bL([012])\b/i)?.[1];
  const maximumLevel = requestedLevel ? `L${requestedLevel}` : 'L2';
  if (/\b(implement|build|create|modify|upgrade|fix|repair|solve)\b/.test(lower)) {
    requestedActions.push('PROPOSE_OR_APPLY_CODE_CHANGE_SUBJECT_TO_AUTHORITY');
  }
  return {
    schema_version: 1,
    objective: founderMessage,
    target_repository: targetRepository,
    requested_actions: requestedActions,
    authority: {
      requested_by: 'founder_via_victor',
      supervision_mode: 'STRICT',
      maximum_level: maximumLevel,
      production_activation_authorized: false,
    },
    prohibited_actions: [
      'EXPOSE_OR_ROTATE_SECRETS',
      'PAID_ACTION',
      'DESTRUCTIVE_ACTION',
      'PRODUCTION_DEPLOYMENT',
      'LOCKED_OBJECTIVE_OR_AUTHORITY_CHANGE',
    ],
    evidence_requirements: ['TASK_RESULT_ENVELOPE', 'CHANGED_FILES_OR_PLAN', 'TEST_RESULTS', 'BLOCKERS'],
    founder_message: founderMessage,
  };
}

export function shouldContactTony(text, entity) {
  const value = String(text || '').toLowerCase();
  const explicitlyNamed = /\btony(?:\s+stark)?\b/.test(value);
  if (entity?.entity_id !== 'tony_stark' && !explicitlyNamed) return false;
  return /status|report|error|problem|issue|check|health|diagnos|repair|solution|root cause|baat|connect|bridge|communication|certif|supervision|progress|objective|onboard|task|implement|build|create|modify|upgrade|audit|inspect|solve|kaam/.test(value);
}

export async function dispatchTonyTask(env, text, metadata = {}) {
  if (!tonyBridgeConfigured(env)) {
    return { status: 'PENDING_CONFIGURATION', reason: 'GITHUB_ORCHESTRATION_TOKEN_NOT_CONFIGURED' };
  }

  const taskType = selectTonyTaskType(text);
  const payload = taskType === 'TASK_REQUEST'
    ? buildTonyTaskPayload(text)
    : {
        founder_message: String(text || '').slice(0, 1000),
        requested_by: 'victor',
        supervision_mode: 'STRICT',
      };
  const taskId = `victor-tony-${Date.now()}-${metadata.messageId || 'msg'}`;
  const response = await fetch(`${GITHUB_API}/repos/${TONY_REPO}/actions/workflows/${TONY_WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: githubHeaders(env),
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        task_id: taskId,
        task_type: taskType,
        payload: JSON.stringify(payload),
      },
    }),
  });

  if (response.status !== 204) {
    const detail = await safeText(response);
    throw new Error(`TONY dispatch HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }

  return { status: 'DISPATCHED', taskId, taskType };
}

export async function waitForTonyResult(taskId, env, options = {}) {
  const attempts = options.attempts || 18;
  const delayMs = options.delayMs || 4000;
  const safeTaskId = String(taskId).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  const path = `integration/results/tasks/${safeTaskId}.json`;
  const url = `${GITHUB_API}/repos/${TONY_REPO}/contents/${path}?ref=main`;

  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) await sleep(delayMs);
    const response = await fetch(`${url}&t=${Date.now()}`, {
      headers: { ...githubHeaders(env), 'Cache-Control': 'no-cache' },
    });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`TONY result HTTP ${response.status}`);
    const payload = await response.json();
    const binary = atob(String(payload.content || '').replace(/\\n/g, ''));
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    const result = JSON.parse(new TextDecoder().decode(bytes));
    if (result?.task_id !== taskId) continue;
    return { status: 'RESULT_RECEIVED', result };
  }
  return { status: 'TIMEOUT', taskId };
}

export function verifyTonyResult(result, expectedTaskId) {
  const strict = result?.strict_supervision || {};
  const checks = {
    task_id: result?.task_id === expectedTaskId,
    sender: result?.sender === 'tony_stark',
    recipient: result?.recipient === 'victor',
    message_type: result?.message_type === 'TASK_RESULT',
    no_destructive_action: result?.destructive_action_performed === false,
    no_paid_action: result?.paid_action_performed === false,
    no_production_action: result?.production_action_performed === false,
    revert_to_victor: strict?.revert_to_victor === true,
    objective_alignment: Boolean(strict?.objective_alignment),
    status: Boolean(strict?.status),
    solution: Boolean(strict?.solution),
    next_action: Boolean(strict?.next_action),
    evidence: Array.isArray(strict?.evidence) && strict.evidence.length > 0,
    follow_up_explicit: typeof strict?.requires_follow_up === 'boolean',
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

export function formatTonyResultForFounder(result) {
  const strict = result?.strict_supervision || {};
  const parts = [
    'Tony Stark se fresh revert aa gaya.',
    `Status: ${strict.status || result?.execution_status || 'UNKNOWN'}`,
    `Objective alignment: ${strict.objective_alignment || 'UNKNOWN'}`,
    `Error/Blocker: ${strict.error_or_blocker || 'none reported'}`,
  ];
  if (strict.root_cause) parts.push(`Root cause: ${strict.root_cause}`);
  parts.push(`Solution: ${strict.solution || 'NOT_PROVIDED'}`);
  parts.push(`Next action: ${strict.next_action || 'NOT_PROVIDED'}`);
  parts.push(`Evidence: ${Array.isArray(strict.evidence) ? strict.evidence.join(', ') : 'NOT_PROVIDED'}`);
  return parts.join('\n');
}
