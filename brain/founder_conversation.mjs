export const REASONING_INJECTION_VERSION = 'VICTOR_REASONING_INJECTION_V1';

export function naturalDispatchAcknowledgement(target, request = '', dispatch = null) {
  const name = displayTarget(target);
  const text = String(request || '').trim();
  const lower = text.toLowerCase();
  const taskType = dispatch?.taskType || null;
  const taskId = dispatch?.taskId || null;
  const accepted = dispatch?.status === 'DISPATCHED';

  if (accepted) {
    const detail = [
      `${name} request dispatch accepted hai`,
      taskType ? `task type: ${taskType}` : null,
      taskId ? `task ID: ${taskId}` : null,
    ].filter(Boolean).join(' | ');
    return `${detail}. Iska matlab sirf dispatch successful hai—result abhi verified/completed nahi maana gaya. Main isi request ke current verification window me fresh result check karunga.`;
  }

  if (/(instagram|insta).*(latest|new|post)|(?:latest|new).*(instagram|insta)/i.test(lower)) {
    return `${name} ka latest actually published Instagram post fresh evidence se verify karne ke liye request prepare hui hai. Draft ya ready-to-post item ko published nahi maanunga, aur verified result ke bina completion claim nahi hoga.`;
  }
  if (/(status|progress|kaha|kahaan|atka|pareshani|problem|issue|blocker)/i.test(lower)) {
    return `${name} ka fresh status check request prepare hui hai. Dispatch/result evidence confirm hone ke baad hi actual status bataunga.`;
  }
  return `${name} ke liye request prepare hui hai. Dispatch evidence ke bina main “kaam start ho gaya” ya future update ka claim nahi karunga.`;
}

export function naturalInvestigationAcknowledgement(target, query = '') {
  const name = displayTarget(target);
  const subject = String(query || '').trim();
  return subject
    ? `Isi point ka fresh evidence check kar raha hoon: “${clip(subject, 180)}”. Purani report repeat nahi karunga; jo verify hoga wahi bataunga.`
    : `${name} ke unresolved point ka fresh evidence check kar raha hoon. Purani report repeat nahi karunga; jo verify hoga wahi bataunga.`;
}

export function naturalPendingReply(target) {
  const name = displayTarget(target);
  return `${name} ka dispatched task mila hai, lekin verified result file abhi available nahi hai. Current state: RESULT_PENDING. Is reply ke baad continuous/background tracking ka claim nahi hai; completion tabhi bolunga jab fresh result evidence mile.`;
}

export function buildNaturalResultPrompt(target, founderQuestion, rawReport) {
  return [
    `Reasoning layer: ${REASONING_INJECTION_VERSION}.`,
    'Before writing the answer, silently reason through four checks: (1) what the Founder is actually asking now, including conversational context; (2) which statements in the raw report are verified facts versus unknown/inferred; (3) the exact task state—DISPATCHED, RESULT_PENDING, RESULT_RECEIVED, VERIFIED, or COMPLETED; and (4) whether the available evidence is sufficient to answer directly or whether an evidence gap must be stated.',
    'Do not reveal chain-of-thought, hidden reasoning, or scratch work. Return only the concise Founder-facing conclusion and supporting verified facts.',
    'Prefer using an existing verified result over implying that a new task is needed. Never upgrade a transport acknowledgement into work completion.',
    'You are Victor speaking directly to the Founder in a natural conversational style.',
    'Answer like a capable executive assistant, not like a workflow engine, ticketing bot, audit log, or API response.',
    'Use concise natural Hinglish unless the Founder used English.',
    'Lead with the actual answer. Then mention only the useful evidence, implication, blocker, or next step.',
    'Do not expose internal task IDs, schema names, transport states, file paths, certification boilerplate, or machine labels unless the Founder explicitly asked for technical details.',
    'Do not invent facts. Preserve uncertainty exactly. READY_TO_POST is not PUBLISHED. DISPATCHED is not RUNNING. RUNNING is not RESULT_RECEIVED. RESULT_RECEIVED is not COMPLETED unless verified. Internal progress is not business outcome.',
    'Never promise a later/background update unless a real persistent watcher/notification mechanism is attached and evidenced.',
    'If the raw report does not answer the question, state exactly what is verified, what is still unknown, and what evidence is missing.',
    `Department: ${displayTarget(target)}`,
    `Founder question/context: ${String(founderQuestion || '').trim() || 'Not supplied'}`,
    `Verified raw report:\n${String(rawReport || '').trim()}`,
  ].join('\n\n');
}

export function naturalResultFallback(target, rawReport) {
  const name = displayTarget(target);
  const cleaned = String(rawReport || '')
    .replace(/Victor verification:[\s\S]*$/i, '')
    .replace(/\bTask(?: ID)?:\s*[^\s]+/gi, '')
    .replace(/\b(?:REPORTING_CONNECTED_PENDING_VICTOR_CERTIFICATION|CHECKED_AGAINST_[A-Z0-9_]+)\b/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned ? `${name} ka fresh verified update:\n\n${cleaned}` : `${name} ka verified result evidence mila, lekin useful Founder-facing summary generate nahi ho paayi. Completion ka extra claim nahi kar raha.`;
}

export function displayTarget(target) {
  const value = String(target || '').toLowerCase();
  if (value === 'rio') return 'RIO';
  if (value === 'tony_stark') return 'Tony';
  if (value === 'aura3') return 'AURA3';
  if (value === 'hulk') return 'HULK';
  return value ? value.toUpperCase() : 'Department';
}

function clip(value, max) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
