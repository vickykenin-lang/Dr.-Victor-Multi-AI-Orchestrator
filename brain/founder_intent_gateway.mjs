export const FOUNDER_INTENT = Object.freeze({
  CHAT: 'CHAT',
  QUESTION: 'QUESTION',
  STATUS_QUERY: 'STATUS_QUERY',
  EXECUTION_COMMAND: 'EXECUTION_COMMAND',
  STOP_PAUSE: 'STOP_PAUSE',
  FOUNDER_DECISION: 'FOUNDER_DECISION',
  SYSTEM_TEST: 'SYSTEM_TEST',
});

export function normalizeFounderText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9\u0900-\u097f\s?'_-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function targetFromText(text = '') {
  if (/\brio\b/i.test(text)) return 'rio';
  if (/\btony(?:_stark)?\b/i.test(text)) return 'tony_stark';
  if (/\baura3\b/i.test(text)) return 'aura3';
  if (/\bvictor\b/i.test(text)) return 'victor';
  return null;
}

export function classifyFounderIntent(text, context = {}) {
  const value = normalizeFounderText(text);
  const target = targetFromText(value) || context?.active_target || null;

  // STOP/PAUSE is deterministic and must be evaluated before any model,
  // conversational follow-up, department-routing or execution classifier.
  const stop = /(?:^|\s)(?:stop|pause|hold|band\s+karo|band\s+kar|close\s+karo|close\s+kar|rok\s+do|roko|kaam\s+band)(?:\s|$)/i.test(value)
    || /(?:rio|tony(?:_stark)?|aura3|victor).{0,30}(?:stop|pause|hold|band\s+karo|band\s+kar|close\s+karo|rok\s+do|roko)/i.test(value)
    || /(?:stop|pause|hold|band\s+karo|close\s+karo|rok\s+do).{0,30}(?:rio|tony(?:_stark)?|aura3|victor)/i.test(value);
  if (stop) {
    return {
      intent: FOUNDER_INTENT.STOP_PAUSE,
      target,
      execution_allowed: false,
      requires_deterministic_stop: true,
      reason: 'FOUNDER_STOP_PAUSE_PRECEDENCE',
    };
  }

  const systemTest = /\b(i want to test you|test you|test victor|system test|llm.*test|test.*llm|kaise test karoge|kese test karoge|test kaise|test kese)\b/i.test(value);
  if (systemTest) {
    return {
      intent: FOUNDER_INTENT.SYSTEM_TEST,
      target: target === 'rio' ? null : target,
      execution_allowed: false,
      requires_deterministic_stop: false,
      reason: 'SYSTEM_TEST_IS_NOT_DEPARTMENT_EXECUTION',
    };
  }

  const statusQuery = /\b(status|kya hua|kaha atka|kahaan atka|pending|progress|latest state|current state)\b/i.test(value);
  if (statusQuery && /[?]|\b(kya|what|where|kab|when|status)\b/i.test(value)) {
    return {
      intent: FOUNDER_INTENT.STATUS_QUERY,
      target,
      execution_allowed: false,
      requires_deterministic_stop: false,
      reason: 'STATUS_QUERY_NO_IMPLICIT_DISPATCH',
    };
  }

  const explicitExecution = /\b(execute|start|run|deploy|implement|apply|create|build|fix|update|merge|release|continue work|resume work|kaam chalu|kaam shuru|shuru karo|start karo|execute karo|deploy karo|implement karo|fix karo|update karo|merge karo)\b/i.test(value);
  if (explicitExecution) {
    return {
      intent: FOUNDER_INTENT.EXECUTION_COMMAND,
      target,
      execution_allowed: true,
      requires_deterministic_stop: false,
      reason: 'EXPLICIT_EXECUTION_VERB',
    };
  }

  const founderDecision = /\b(approve|approved|lock this|yes lock|plan lock|authorize|authorise|reject|denied|do not approve)\b/i.test(value);
  if (founderDecision) {
    return {
      intent: FOUNDER_INTENT.FOUNDER_DECISION,
      target,
      execution_allowed: false,
      requires_deterministic_stop: false,
      reason: 'FOUNDER_GOVERNANCE_DECISION',
    };
  }

  const question = /[?]$|^(?:what|why|how|when|where|who|which|can|could|should|is|are|do|does|did|kya|kyu|kyun|kaise|kese|kab|kaha|kahaan)\b/i.test(value)
    || /\b(llm|model|connection|connected|joke).*(?:kya|kaise|kese|how|where|kaha|kahaan)/i.test(value);
  if (question) {
    return {
      intent: FOUNDER_INTENT.QUESTION,
      target,
      execution_allowed: false,
      requires_deterministic_stop: false,
      reason: 'QUESTION_NO_IMPLICIT_DISPATCH',
    };
  }

  return {
    intent: FOUNDER_INTENT.CHAT,
    target,
    execution_allowed: false,
    requires_deterministic_stop: false,
    reason: 'DEFAULT_CONVERSATIONAL_FAIL_CLOSED',
  };
}

export function mayCreateExecutionContract(classification = {}) {
  return classification?.intent === FOUNDER_INTENT.EXECUTION_COMMAND
    && classification?.execution_allowed === true
    && classification?.requires_deterministic_stop !== true;
}
