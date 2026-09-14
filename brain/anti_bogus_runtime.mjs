function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const UNRESOLVED = /\b(not verified|verify nahi|verified nahi|clear nahi|unclear|unconfirmed|fresh evidence.*nahi|evidence.*available nahi|cannot confirm|unable to verify|pata nahi|maalum nahi|unknown|pending configuration|bridge configured nahi|dispatch nahi hua|read fail|generic status)\b/i;
const ACTIONISH = /\b(check|verify|pata|find|investigate|diagnos|fix|repair|recover|retry|thik|theek|karo|kar do|execute|run|status|kyu|why|blocker|issue|problem)\b/i;
const FOUNDER_ONLY = /\b(credential|secret|token|permission|access|payment|billing|purchase|irreversible|high[- ]risk|approval required|founder approval)\b/i;

export function isUnresolvedVictorReply(text = '') {
  return UNRESOLVED.test(String(text || ''));
}

export function isFounderOnlyDependency(text = '') {
  return FOUNDER_ONLY.test(String(text || ''));
}

function victorTurns(session = {}) {
  return (Array.isArray(session.recent_turns) ? session.recent_turns : [])
    .filter(turn => turn?.role === 'victor' && turn?.text)
    .slice(-4);
}

export function detectDeadEndLoop(founderText = '', session = {}) {
  const turns = victorTurns(session);
  const last = String(session.last_victor_reply || turns.at(-1)?.text || '');
  if (!last || !isUnresolvedVictorReply(last)) return { matched: false, reason: 'LAST_REPLY_NOT_UNRESOLVED' };
  if (!ACTIONISH.test(String(founderText || ''))) return { matched: false, reason: 'FOUNDER_NOT_REQUESTING_RECOVERY' };
  if (isFounderOnlyDependency(last)) {
    return { matched: false, founder_only: true, reason: 'FOUNDER_ONLY_DEPENDENCY', dependency: last };
  }

  const lastNorm = normalize(last);
  const unresolvedVictor = turns.filter(turn => isUnresolvedVictorReply(turn.text));
  const nearDuplicateCount = unresolvedVictor.filter(turn => {
    const current = normalize(turn.text);
    if (!current || !lastNorm) return false;
    if (current === lastNorm) return true;
    const a = new Set(current.split(' '));
    const b = new Set(lastNorm.split(' '));
    const shared = [...a].filter(token => b.has(token)).length;
    return shared / Math.max(1, Math.min(a.size, b.size)) >= 0.7;
  }).length;

  return {
    matched: nearDuplicateCount >= 1,
    reason: nearDuplicateCount >= 2 ? 'REPEATED_UNRESOLVED_REPLY' : 'UNRESOLVED_REPLY_REQUIRES_RECOVERY',
    repeated_count: nearDuplicateCount,
    target: session.active_target || session.last_target || null,
    prior_reply: last,
  };
}

export function buildDeadEndRecoveryPrompt(detection = {}, founderText = '') {
  const target = detection.target || 'relevant department';
  return [
    'VICTOR DEAD-END RECOVERY',
    `Target: ${target}`,
    `Founder request: ${String(founderText || '').trim()}`,
    `Prior unresolved reply: ${String(detection.prior_reply || '').slice(0, 1000)}`,
    'Do not repeat the prior unresolved answer.',
    'Own the problem: inspect fresh evidence, identify the root cause, take the next safe corrective/retry action that existing authority permits, and return fresh evidence.',
    'If blocked only by a credential, permission, payment, or irreversible/high-risk Founder decision, stop and state exactly that dependency and the one action required from Founder.',
    'Never claim completed/deployed/live/healthy unless fresh evidence verifies that exact stage.',
  ].join('\n');
}

export function buildNonRepetitionDirective(session = {}) {
  const recent = victorTurns(session).map(turn => String(turn.text || '').slice(0, 800));
  return [
    'ANTI-BOGUS / NO-DEAD-END CONTRACT:',
    '- A repeated unresolved statement is a runtime failure, not a valid answer.',
    '- If the previous answer said unverified/unclear/unknown/pending, do not paraphrase it again.',
    '- Either produce new evidence/action/root cause, or name the exact Founder-only dependency.',
    '- Model output and memory are not proof of external state.',
    recent.length ? `Recent Victor replies to avoid repeating:\n${recent.join('\n---\n')}` : 'Recent Victor replies: none',
  ].join('\n');
}
