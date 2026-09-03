export function normalizeProblemText(value) {
  return String(value || '').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim();
}

export function classifyOwnedProblem(text, session = {}) {
  const value = normalizeProblemText(text);
  const explicitTarget = /\brio\b/i.test(value) ? 'rio'
    : /\btony(?:\s+stark)?\b/i.test(value) ? 'tony_stark'
      : /\baura\s*3(?:\.0)?\b|\baura3\b|\baura\b/i.test(value) ? 'aura3'
        : null;
  const target = explicitTarget || session?.active_target || session?.last_target || null;
  if (!['rio', 'tony_stark', 'aura3'].includes(target)) return { matched: false, target: null, reason: 'NO_SUPPORTED_TARGET' };

  const blockerQuestion = /(kaha(?:an)?\s+atka|kyu\s+(?:nahi|nhi)\s+(?:hua|bana|develop|publish)|kyon\s+(?:nahi|nhi)|pareshani|problem|issue|blocker|what.*blocking|why.*not|stuck)/i.test(value);
  const ownershipAction = /(khud|apne\s+aap|automatically|auto|fix|thik|theek|repair|resolve|recover|continue|aage\s+badh|publish|post\s+kar|live\s+kar|develop|final\s+result|outcome)/i.test(value);
  const operationalOutcome = /(instagram|post|creative|publish|website|campaign|content|revenue|conversion|operation|kaam|result|outcome)/i.test(value);

  const threadText = normalizeProblemText([
    session?.active_issue,
    session?.unresolved_question,
    session?.last_founder_text,
    session?.last_victor_reply,
  ].filter(Boolean).join(' '));
  const threadOperational = /(instagram|post|creative|publish|website|campaign|content|revenue|conversion|operation|kaam|blocker|issue|problem|stuck|result|outcome)/i.test(threadText);
  const explicitOwnershipFollowUp = /^(isko|ise|usko|usse|ye|this|that)?\s*(khud|apne\s+aap)?\s*(fix|thik|theek|repair|resolve|recover|continue|aage\s+badh|publish|post\s+kar|live\s+kar|develop).*(final\s+result|result|outcome|batao|do)?/i.test(value)
    || /(khud|apne\s+aap).*(fix|resolve|recover|continue|publish|develop)/i.test(value);

  if (blockerQuestion && (ownershipAction || operationalOutcome)) {
    return { matched: true, target, mode: 'OWNED_PROBLEM_RECOVERY', reason: 'BLOCKER_OR_DELAY_REQUIRES_DIAGNOSE_FIX_CONTINUE' };
  }
  if (ownershipAction && operationalOutcome) {
    return { matched: true, target, mode: 'OWNED_PROBLEM_RECOVERY', reason: 'FOUNDER_REQUESTS_OUTCOME_OWNERSHIP' };
  }
  if (!explicitTarget && explicitOwnershipFollowUp && threadOperational) {
    return { matched: true, target, mode: 'OWNED_PROBLEM_RECOVERY', reason: 'OWNERSHIP_FOLLOWUP_BOUND_TO_ACTIVE_OPERATIONAL_THREAD' };
  }
  return { matched: false, target, reason: 'STATUS_OR_ACTION_NOT_OWNERSHIP_CLASS' };
}

export function buildOwnedProblemPrompt(target, founderRequest, previous = null) {
  const name = String(target || '').toUpperCase();
  const lines = [
    'VICTOR OWNED PROBLEM RECOVERY',
    `Department: ${name}`,
    `Founder request: ${String(founderRequest || '').trim()}`,
    'Operating contract: You own the problem to the verified outcome. Do not stop at diagnosis or a recommendation when the next corrective action is within existing authority.',
    'Required loop: inspect fresh evidence -> identify symptom/root cause -> execute the highest-impact corrective action -> verify the result -> continue to the next corrective action until the requested outcome is verified or a genuine Founder-only boundary is reached.',
    'Routine approval is not a blocker. Do not return VICTOR_REVIEW_REQUIRED, AUTHORIZE_REPAIR_PLAN, or similar internal approval language unless the next step truly requires credential/account identity administration, spend above the configured ceiling, irreversible high-impact commitment, unresolved legal/security judgment, explicit objective change, or Founder pause.',
    'If another department is better suited for a subproblem, state the concrete handoff needed in next_action with the capability required. Victor may reroute it automatically.',
    'Return strict_supervision with status, outcome_progress, error_or_blocker, root_cause, solution, next_action, evidence, requires_follow_up. Set requires_follow_up=true whenever the Founder-requested outcome is not yet verified and no Founder-only boundary exists.',
    'Do not claim published/live/completed without traceable external or canonical evidence.',
  ];
  if (previous) lines.push(`Previous verified result: ${JSON.stringify(previous).slice(0, 5000)}`);
  return lines.join('\n');
}

export function naturalOwnedProblemAck(target) {
  const name = target === 'rio' ? 'RIO' : target === 'tony_stark' ? 'Tony' : target === 'aura3' ? 'AURA3' : 'Department';
  return `${name} ka issue own kar liya hai. Fresh evidence se root cause verify karke jo corrective action meri authority ke andar hai wo execute karunga, phir final outcome verify karke update dunga. Sirf genuine Founder-only boundary par aapko involve karunga.`;
}
