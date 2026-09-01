export function normalizeFounderText(value) {
  return String(value || '').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim();
}

export function resolveFounderIntent(text, replyContext = '') {
  const value = normalizeFounderText(text);
  const hasReplyContext = Boolean(String(replyContext || '').trim());

  if (/^(\?\?|\?|matlab\??|kya matlab\??|what do you mean\??|meaning\??)$/i.test(value)) {
    return {
      mode: 'CLARIFICATION',
      reason: hasReplyContext ? 'SHORT_CLARIFICATION_WITH_REPLY_CONTEXT' : 'SHORT_CLARIFICATION_WITHOUT_CONTEXT',
      objective_change_explicit: false,
    };
  }

  const operationFocus = /(focus (?:only |just )?on (?:the )?operation|focus on operations|operation par focus|operations par focus|sirf operation|sirf operations|just focus on operation)/i.test(value);
  const paymentDeprioritized = /(i don'?t want any payment|i do not want any payment|payment (?:par )?focus mat|payment nahi chahiye|revenue (?:par )?focus mat)/i.test(value);
  const explicitObjectiveChange = /(change|replace|update|amend).{0,24}(goal|objective)|(goal|objective).{0,24}(change|replace|update|amend)/i.test(value);

  if ((operationFocus || paymentDeprioritized) && !explicitObjectiveChange) {
    return {
      mode: 'FOUNDER_DIRECTION',
      reason: operationFocus && paymentDeprioritized ? 'OPERATIONS_PRIORITY_PAYMENT_DEPRIORITIZED' : 'OPERATING_PRIORITY_DIRECTION',
      objective_change_explicit: false,
    };
  }

  if (explicitObjectiveChange) {
    return {
      mode: 'OBJECTIVE_CHANGE_REQUEST',
      reason: 'EXPLICIT_GOAL_OR_OBJECTIVE_CHANGE_LANGUAGE',
      objective_change_explicit: true,
    };
  }

  return { mode: null, reason: 'NO_DETERMINISTIC_OVERRIDE', objective_change_explicit: false };
}

export function founderDirectionReply() {
  return 'Samajh gaya. Payment/revenue metric ko is instruction ka immediate focus nahi banaunga; operational execution par focus rahega. Existing locked goal ko silently replace nahi kiya gaya. Agar aap objective itself change karna chahte hain, usse explicit Founder objective-change ke roop me bind karunga.';
}

export function clarificationFallback(replyContext = '') {
  const previous = String(replyContext || '').trim();
  if (!previous) return 'Aap kis previous reply ko clarify karwana chahte hain? Us message par reply karke ?? bhej dein; main wahi context explain karunga.';
  return `Aap mere previous reply ko clarify kar rahe hain. Previous reply: ${previous.slice(0, 700)}`;
}
