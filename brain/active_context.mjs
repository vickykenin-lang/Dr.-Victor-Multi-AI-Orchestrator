const TARGETS = [
  ['rio', /\brio\b/i],
  ['tony_stark', /\btony(?:\s+stark)?\b/i],
  ['aura3', /\baura\s*3(?:\.0)?\b|\baura3\b|\baura\b/i],
  ['hulk', /\bhulk\b/i],
];

export function normalizeActiveContextText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectExplicitTarget(text) {
  const value = normalizeActiveContextText(text);
  for (const [target, pattern] of TARGETS) {
    if (pattern.test(value)) return target;
  }
  return null;
}

export function inferThreadTopic(text, previous = {}) {
  const value = normalizeActiveContextText(text);
  const explicitTarget = detectExplicitTarget(value);
  const target = explicitTarget || previous.active_target || previous.last_target || null;

  const asksStatus = /\b(status|progress|kaha(?:an)?\s+atka|pareshani|problem|issue|blocker|kya\s+hua|result|revert|check|pata)\b/i.test(value);
  const asksAction = /\b(fix|repair|thik|theek|karo|kar do|execute|run|deploy|publish|start|resume|stop|pause|build|update)\b/i.test(value);
  const operatingDirection = /\b(operation|operations|kaam|work)\b/i.test(value) && /\b(focus|dhyan|priority)\b/i.test(value);
  const paymentContrast = /\b(payment|revenue)\b/i.test(value) && /\b(nahi|nhi|not|don't|do not|mat)\b/i.test(value);

  if (operatingDirection || paymentContrast) return 'FOUNDER_OPERATING_DIRECTION';
  if (target && asksStatus) return `${target.toUpperCase()}_STATUS_OR_BLOCKER`;
  if (target && asksAction) return `${target.toUpperCase()}_ACTION`;
  if (explicitTarget) return `${explicitTarget.toUpperCase()}_DISCUSSION`;

  // Short/implicit follow-ups stay on the existing thread instead of resetting topic.
  if (value.length <= 80 && previous.active_topic) return previous.active_topic;
  return previous.active_topic || 'GENERAL_CONVERSATION';
}

export function buildActiveContext(previous = {}, input = {}) {
  const founderText = String(input.founderText || '').trim();
  const replyContext = String(input.replyContext || '').trim();
  const explicitTarget = detectExplicitTarget(founderText);
  const activeTarget = explicitTarget || previous.active_target || previous.last_target || null;
  const activeTopic = inferThreadTopic(founderText, { ...previous, active_target: activeTarget });
  const looksUnresolved = /\?|\b(batao|pata|check|status|result|revert|kyu|why|how|kaha|kahaan|pareshani|problem|issue|blocker)\b/i.test(founderText);

  return {
    active_topic: activeTopic,
    active_target: activeTarget,
    active_task_id: previous.last_task_id || previous.active_task_id || null,
    active_issue: looksUnresolved ? founderText.slice(0, 500) : (previous.active_issue || null),
    unresolved_question: looksUnresolved ? founderText.slice(0, 500) : (previous.unresolved_question || null),
    last_founder_text: founderText || previous.last_founder_text || '',
    reply_context: replyContext || previous.reply_context || '',
    context_version: 1,
  };
}

export function appendRecentTurn(session = {}, role, text, at = new Date().toISOString()) {
  const current = Array.isArray(session.recent_turns) ? session.recent_turns : [];
  const next = [...current, { role, text: String(text || '').slice(0, 1000), at }]
    .filter(item => item.text)
    .slice(-10);
  return { ...session, recent_turns: next };
}

export function formatActiveContextForPrompt(session = {}) {
  const turns = Array.isArray(session.recent_turns)
    ? session.recent_turns.slice(-8).map(item => `${item.role}: ${item.text}`).join('\n')
    : '';
  return [
    `Active topic: ${session.active_topic || 'UNKNOWN'}`,
    `Active department: ${session.active_target || session.last_target || 'NONE'}`,
    `Active task: ${session.active_task_id || session.last_task_id || 'NONE'}`,
    `Current issue/question: ${session.unresolved_question || session.active_issue || 'NONE'}`,
    `Last Founder message: ${session.last_founder_text || 'NONE'}`,
    `Last Victor reply: ${session.last_victor_reply || 'NONE'}`,
    turns ? `Recent turns:\n${turns}` : 'Recent turns: NONE',
  ].join('\n');
}
