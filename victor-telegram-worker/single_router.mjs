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
  // Explicit AURA2 must win over the bare AURA->AURA3 alias.
  if (/\b(aura\s*2|aura2)\b/i.test(value)) return 'aura2';
  for (const [id, pattern] of DEPARTMENT_ALIASES) if (pattern.test(value)) return id;
  return null;
}

export function extractApprovalId(text) {
  const match = normalize(text).match(/^(?:ok|approve|approved)\s+([a-z0-9][a-z0-9-]{5,80})$/i);
  return match ? match[1] : null;
}

export function routeDeterministically(text) {
  const raw = normalize(text);
  const value = raw.toLowerCase();
  const department = resolveDepartment(raw);

  const approvalId = extractApprovalId(raw);
  if (approvalId) return { type: 'APPROVAL', department: null, action: 'approve', risk: 'RED', confidence: 1, approval_id: approvalId, source: 'rule' };

  if (/\b(stop|pause|hold|band karo|rok do|ruk jao|kaam band)\b/i.test(raw)) {
    return { type: 'STOP', department, action: 'stop', risk: 'AMBER', confidence: 1, source: 'rule' };
  }

  if (/\b(remind|reminder|yaad dila|yaad dilana|yaad kara|remind kar|message bhej.*(?:baje|am|pm)|msg bhej.*(?:baje|am|pm))\b/i.test(raw)) {
    return { type: 'REMINDER', department: null, action: 'create_reminder', risk: 'GREEN', confidence: 1, source: 'rule' };
  }

  const statusCue = /\b(status|check|update|progress|result|report|health|kya chal|kya hua|kaisa|kitne|published|ready|blocker)\b/i;
  if (department && statusCue.test(raw)) {
    return { type: 'STATUS', department, action: 'status', risk: 'GREEN', confidence: 1, source: 'rule' };
  }

  const sensitiveCue = /\b(merge|deploy|delete|remove|destroy|rotate|credential|secret|permission|access|production|payment|pay|spend|purchase|billing|security setting|branch protection)\b/i;
  const actionCue = /\b(karo|kar do|karna|start|shuru|run|execute|fix|repair|build|create|change|update|modify|assign|task do|bhejo|send|publish|post|resume|activate)\b/i;
  if (sensitiveCue.test(raw) && actionCue.test(raw)) {
    return { type: 'ACTION', department, action: 'sensitive_action', risk: 'RED', confidence: 1, source: 'rule' };
  }

  if (department && actionCue.test(raw)) {
    return { type: 'ACTION', department, action: 'department_action', risk: 'AMBER', confidence: 0.98, source: 'rule' };
  }

  // Operational-looking text that did not match a precise rule gets one semantic fallback.
  // Casual/joke/frustration remains CHAT by default and never dispatches by accident.
  if (/\b(check|status|task|assign|execute|run|deploy|merge|remind|schedule|report|fix|repair|audit|investigate|diagnose|analyse|analyze)\b/i.test(raw)) {
    return { type: 'AMBIGUOUS', department, action: null, risk: 'GREEN', confidence: 0, source: 'rule' };
  }

  return { type: 'CHAT', department: null, action: null, risk: 'GREEN', confidence: 1, source: 'default-chat' };
}

export function normalizeSemanticRoute(candidate = {}) {
  const type = String(candidate.type || '').toUpperCase();
  const allowedTypes = new Set(['CHAT', 'STATUS', 'ACTION', 'REMINDER', 'STOP']);
  const risk = String(candidate.risk || 'GREEN').toUpperCase();
  const allowedRisks = new Set(['GREEN', 'AMBER', 'RED']);
  const confidence = Number(candidate.confidence || 0);
  const department = ['rio', 'aura3', 'aura2', 'tony_stark', 'hulk'].includes(candidate.department) ? candidate.department : null;
  if (!allowedTypes.has(type) || !allowedRisks.has(risk) || !Number.isFinite(confidence)) {
    return { type: 'CHAT', department: null, action: null, risk: 'GREEN', confidence: 0, source: 'semantic-invalid' };
  }
  // Dispatch requires high confidence; uncertainty degrades to CHAT.
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
