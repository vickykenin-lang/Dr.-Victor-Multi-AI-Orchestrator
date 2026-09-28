const DEPARTMENT_ALIASES = Object.freeze([
  ['aura3', /\b(aura\s*3|aura3|aura)\b/i],
  ['aura2', /\b(aura\s*2|aura2)\b/i],
  ['tony_stark', /\b(tony(?:\s+stark)?)\b/i],
  ['rio', /\brio\b/i],
  ['hulk', /\bhulk\b/i],
]);

function normalize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

export function resolveDepartment(text) {
  const value = normalize(text);
  if (/\b(aura\s*2|aura2)\b/i.test(value)) return 'aura2';
  for (const [id, pattern] of DEPARTMENT_ALIASES) if (pattern.test(value)) return id;
  return null;
}

export function extractApprovalId(text) {
  const match = normalize(text).match(/^(?:ok|approve|approved)\s+([a-z0-9][a-z0-9-]{5,80})$/i);
  return match ? match[1] : null;
}

function hasReadOnlyQuestionCue(raw) {
  return /\?|\b(kya|kab|kitna|kitne|kitni|kaun|kahan|kyu|kaise|batao|bataiye|dikhao|when|what|why|how|which|who|where|last|latest|recent|current|abhi|pending|blocker|revenue|earning|income|result|report|update|progress|published|post|posts|status|health|ready|count)\b/i.test(raw);
}

function hasMutatingActionCue(raw) {
  return /\b(start|shuru|run|execute|fix|repair|build|create|change|modify|assign|task do|bhejo|send|publish|post karo|resume|activate|merge|deploy|delete|remove|destroy|rotate|payment|pay|spend|purchase)\b/i.test(raw)
    || /\b(karo|kar do|karna)\b/i.test(raw) && /\b(fix|repair|build|create|change|modify|assign|task|send|bhej|publish|post|start|shuru|run|execute|resume|activate|merge|deploy|delete|remove|destroy|rotate|pay|spend|purchase)\b/i.test(raw);
}

export function routeDeterministically(text, context = {}) {
  const raw = normalize(text);
  const explicitDepartment = resolveDepartment(raw);
  const inheritedDepartment = context?.department || null;
  const questionLike = hasReadOnlyQuestionCue(raw);
  const department = explicitDepartment || (questionLike ? inheritedDepartment : null);

  const approvalId = extractApprovalId(raw);
  if (approvalId) return { type: 'APPROVAL', department: null, action: 'approve', risk: 'RED', confidence: 1, approval_id: approvalId, source: 'rule' };

  if (/\b(stop|pause|hold|band karo|rok do|ruk jao|kaam band)\b/i.test(raw)) {
    return { type: 'STOP', department, action: 'stop', risk: 'AMBER', confidence: 1, source: 'rule' };
  }

  if (/\b(remind|reminder|yaad dila|yaad dilana|yaad kara|remind kar|message bhej.*(?:baje|am|pm)|msg bhej.*(?:baje|am|pm))\b/i.test(raw)) {
    return { type: 'REMINDER', department: null, action: 'create_reminder', risk: 'GREEN', confidence: 1, source: 'rule' };
  }

  const statusCue = /\b(status|health)\b/i;
  if (department && statusCue.test(raw) && !hasMutatingActionCue(raw)) {
    return { type: 'STATUS', department, action: 'status', risk: 'GREEN', confidence: 1, source: explicitDepartment ? 'rule' : 'context-rule' };
  }

  // Any read-only question about a named/current department uses one generic query path.
  // It must win before generic action words such as "post" when the sentence is interrogative.
  if (department && questionLike && !hasMutatingActionCue(raw)) {
    return { type: 'DEPARTMENT_QUERY', department, action: 'answer_question', risk: 'GREEN', confidence: 1, source: explicitDepartment ? 'rule' : 'context-rule' };
  }

  const sensitiveCue = /\b(merge|deploy|delete|remove|destroy|rotate|credential|secret|permission|access|production|payment|pay|spend|purchase|billing|security setting|branch protection)\b/i;
  const actionCue = /\b(karo|kar do|karna|start|shuru|run|execute|fix|repair|build|create|change|update|modify|assign|task do|bhejo|send|publish|post|resume|activate)\b/i;
  if (sensitiveCue.test(raw) && actionCue.test(raw)) {
    return { type: 'ACTION', department, action: 'sensitive_action', risk: 'RED', confidence: 1, source: 'rule' };
  }

  if (department && actionCue.test(raw)) {
    return { type: 'ACTION', department, action: 'department_action', risk: 'AMBER', confidence: 0.98, source: 'rule' };
  }

  if (/\b(check|status|task|assign|execute|run|deploy|merge|remind|schedule|report|fix|repair|audit|investigate|diagnose|analyse|analyze)\b/i.test(raw)) {
    return { type: 'AMBIGUOUS', department, action: null, risk: 'GREEN', confidence: 0, source: 'rule' };
  }

  return { type: 'CHAT', department: null, action: null, risk: 'GREEN', confidence: 1, source: 'default-chat' };
}

export function normalizeSemanticRoute(candidate = {}) {
  const type = String(candidate.type || '').toUpperCase();
  const allowedTypes = new Set(['CHAT', 'STATUS', 'DEPARTMENT_QUERY', 'FACT_QUERY', 'ACTION', 'REMINDER', 'STOP']);
  const risk = String(candidate.risk || 'GREEN').toUpperCase();
  const allowedRisks = new Set(['GREEN', 'AMBER', 'RED']);
  const confidence = Number(candidate.confidence || 0);
  const department = ['rio', 'aura3', 'aura2', 'tony_stark', 'hulk'].includes(candidate.department) ? candidate.department : null;
  if (!allowedTypes.has(type) || !allowedRisks.has(risk) || !Number.isFinite(confidence)) {
    return { type: 'CHAT', department: null, action: null, risk: 'GREEN', confidence: 0, source: 'semantic-invalid' };
  }
  if (type !== 'CHAT' && confidence < 0.85) {
    return { type: 'CHAT', department: null, action: null, risk: 'GREEN', confidence, source: 'semantic-low-confidence' };
  }
  return {
    type,
    department,
    action: String(candidate.action || '').slice(0, 80) || null,
    risk,
    confidence: Math.min(1, Math.max(0, confidence)),
    source: 'semantic',
  };
}
