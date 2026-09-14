function text(value) {
  return String(value || '').trim();
}

function founderAskedForNextStep(userMessage = '') {
  return /\b(next|next step|next action|aage|aage kya|ab kya|kya karna|what next|recommend|recommendation|suggest|suggestion|choose action|priority action)\b/i.test(text(userMessage));
}

function founderAskedForStructuredDetail(userMessage = '') {
  return /\b(detail|details|detailed|full|complete|comprehensive|breakdown|report|summary|status report|point wise|pointer wise|bullet)\b/i.test(text(userMessage));
}

export function assessReplyNaturalness(reply, userMessage = '') {
  const value = text(reply);
  const violations = [];
  if (!value) return { ok: false, violations: ['EMPTY_REPLY'] };

  const asksNext = founderAskedForNextStep(userMessage);
  const asksDetail = founderAskedForStructuredDetail(userMessage);
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  if (!asksNext && /^\s*(?:next step|next action|recommended action|aage ka step)\s*:/im.test(value)) {
    violations.push('UNSOLICITED_NEXT_STEP_SECTION');
  }

  if (!asksNext && /\b(?:koi aur|another)\s+(?:high[- ]impact\s+)?(?:revenue\s+)?action\s+(?:choose|select)|\bchoose karein\b|\bchoose karen\b|\bwant me to\b|\bshall i\b/i.test(value)) {
    violations.push('UNSOLICITED_ACTION_CTA');
  }

  if (!asksDetail && /^\s*(?:note|current state|status snapshot|summary|evidence summary|recommended action)\s*:/im.test(value)) {
    violations.push('SCRIPTED_TEMPLATE_SECTION');
  }

  if (!asksDetail && lines.length >= 4 && lines.some(line => /^(?:✅|⚠️|➡️|[-•*])/.test(line))) {
    violations.push('SCRIPTED_STATUS_DUMP');
  }

  if (!asksNext && /\b(?:agar aapko|if you want|if you need).{0,90}\b(?:main|i can|i will).{0,50}\b(?:verify|check|karunga|kar sakta|bataunga)\b/i.test(value)) {
    violations.push('UNSOLICITED_FOLLOWUP_OFFER');
  }

  return { ok: violations.length === 0, violations: [...new Set(violations)] };
}

export function buildNaturalReplyDirective() {
  return `NATURAL DIRECT REPLY GUARD — MANDATORY:\n- Answer the Founder\'s exact message directly and naturally.\n- Do not use stock report wrappers such as Note:, Current state:, Status snapshot:, Summary:, or Next step: unless explicitly requested.\n- Do not append a generic recommendation, CTA, follow-up offer, or \"choose another action\" line unless the Founder asked what to do next.\n- Do not pad a simple answer with status dumps, emojis, checklist formatting, or repeated governance language.\n- Preserve evidence exactly. Style cleanup must never add, remove, strengthen, soften, or reinterpret factual claims.\n- If evidence is insufficient, say so directly in the answer and stop.`;
}
