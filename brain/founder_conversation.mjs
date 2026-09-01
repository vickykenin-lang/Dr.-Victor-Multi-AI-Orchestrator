export function naturalDispatchAcknowledgement(target, request = '') {
  const name = displayTarget(target);
  const text = String(request || '').trim();
  const lower = text.toLowerCase();

  if (/(instagram|insta).*(latest|new|post)|(?:latest|new).*(instagram|insta)/i.test(lower)) {
    return `${name} ka latest actually published Instagram post fresh evidence se verify kar raha hoon. Draft ya ready-to-post item ko published nahi maanunga. Result milte hi seedha yahin bataunga.`;
  }
  if (/(status|progress|kaha|kahaan|atka|pareshani|problem|issue|blocker)/i.test(lower)) {
    return `${name} ka fresh status check kar raha hoon. Jo actual blocker ya next step evidence se confirm hoga, wahi bataunga.`;
  }
  return `${name} par ye kaam start karwa diya hai. Internal tracking main handle kar raha hoon; useful result milte hi seedha update dunga.`;
}

export function naturalInvestigationAcknowledgement(target, query = '') {
  const name = displayTarget(target);
  const subject = String(query || '').trim();
  return subject
    ? `Haan, isi point ko specifically verify kar raha hoon: “${clip(subject, 180)}”. Purani report repeat nahi karunga; fresh evidence ya exact evidence-gap ka reason bataunga.`
    : `${name} ke isi unresolved point ko specifically verify kar raha hoon. Purani report repeat nahi karunga; fresh evidence ya exact evidence-gap ka reason bataunga.`;
}

export function naturalPendingReply(target) {
  const name = displayTarget(target);
  return `${name} ka fresh result abhi pending hai. Main isi check ko track kar raha hoon—duplicate task create nahi kar raha. Result aate hi yahin bataunga.`;
}

export function buildNaturalResultPrompt(target, founderQuestion, rawReport) {
  return [
    'You are Victor speaking directly to the Founder in a natural conversational style.',
    'Answer like a capable executive assistant, not like a workflow engine, ticketing bot, audit log, or API response.',
    'Use concise natural Hinglish unless the Founder used English.',
    'Lead with the actual answer. Then mention only the useful evidence, implication, blocker, or next step.',
    'Do not expose internal task IDs, schema names, transport states, file paths, certification boilerplate, or machine labels unless the Founder explicitly asked for technical details.',
    'Do not invent facts. Preserve uncertainty exactly. READY_TO_POST is not PUBLISHED. Internal progress is not business outcome.',
    'If the raw report does not answer the question, say what is still unknown and what Victor is doing to verify it.',
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
  return cleaned ? `${name} ka fresh verified update:\n\n${cleaned}` : `${name} ka fresh result mila hai, lekin useful Founder-facing summary abhi generate nahi ho paayi.`;
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
