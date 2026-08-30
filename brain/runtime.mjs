export const RULE_HIERARCHY = [
  'FOUNDER_COMMAND',
  'CONSTITUTION_AND_HARD_BOUNDARIES',
  'EMERGENCY_PAUSE_STATE',
  'ACTIVE_GOAL_AND_SUCCESS_CRITERIA',
  'BRAIN_POLICY',
  'OPERATIONAL_RULES',
  'DEPARTMENT_RECOMMENDATIONS',
];

const FOUNDER_BOUNDARY_PATTERNS = [
  /CREDENTIAL|SECRET|ACCOUNT IDENTITY/i,
  /SPEND|BUDGET CEILING/i,
  /IRREVERSIBLE HIGH IMPACT/i,
  /LEGAL|SECURITY JUDGMENT/i,
  /PAUSE|OBJECTIVE CHANGE|SUCCESS CRITERIA CHANGE/i,
  /OBJECTIVE IMPOSSIBLE|GOAL IMPOSSIBLE/i,
];

export function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

export function ruleRank(ruleType) {
  const index = RULE_HIERARCHY.indexOf(normalize(ruleType));
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function resolveRuleConflict(rules = []) {
  const valid = (Array.isArray(rules) ? rules : []).filter(Boolean);
  if (!valid.length) return null;
  return [...valid].sort((a, b) => ruleRank(a.type) - ruleRank(b.type))[0];
}

export function isFounderBoundary(input) {
  const text = Array.isArray(input) ? input.filter(Boolean).join(' ') : String(input || '');
  return FOUNDER_BOUNDARY_PATTERNS.some(pattern => pattern.test(text));
}

export function shouldRunFiveWhys({
  rootCauseKnown = false,
  repeatedFailureCount = 0,
  sameRecommendationCount = 0,
  hasNewEvidence = true,
  departmentExplainsFailure = true,
  confidence = 'MEDIUM',
} = {}) {
  if (!rootCauseKnown && normalize(confidence) === 'LOW') return true;
  if (Number(repeatedFailureCount) >= 2) return true;
  if (Number(sameRecommendationCount) >= 2 && hasNewEvidence === false) return true;
  if (departmentExplainsFailure === false) return true;
  return false;
}

export function buildFiveWhysCase(problem, observations = []) {
  return {
    method: 'FIVE_WHYS_EVIDENCE_DRIVEN',
    problem_statement: problem || 'UNKNOWN_PROBLEM',
    why_chain: [],
    observations: Array.isArray(observations) ? observations : [],
    root_cause_status: 'UNKNOWN',
    root_cause: null,
    next_action: 'COLLECT_EVIDENCE_AND_TEST_HYPOTHESES',
    founder_escalation_allowed: false,
  };
}

export function evaluateFiveWhys(caseState = {}) {
  const chain = Array.isArray(caseState.why_chain) ? caseState.why_chain : [];
  const verified = [...chain].reverse().find(item => item?.status === 'VERIFIED' && item?.cause);
  const rootCause = caseState.root_cause || verified?.cause || null;
  const status = rootCause ? (caseState.root_cause_status || 'VERIFIED') : 'UNKNOWN';
  return {
    ...caseState,
    root_cause: rootCause,
    root_cause_status: status,
    founder_escalation_allowed: Boolean(rootCause && isFounderBoundary(rootCause)),
    next_action: rootCause
      ? (isFounderBoundary(rootCause) ? 'ESCALATE_EXACT_FOUNDER_BOUNDARY' : 'PLAN_ROOT_CAUSE_CORRECTIVE_ACTION')
      : 'CONTINUE_EVIDENCE_COLLECTION_OR_DELEGATED_DIAGNOSIS',
  };
}

export function translateFounderIntent(message, context = {}) {
  const text = String(message || '');
  const upper = text.toUpperCase();

  if (/TONY/.test(upper) && /RIO/.test(upper) && /(WEBSITE|WEB SITE|SITE)/.test(upper)) {
    return {
      intent: 'CROSS_DEPARTMENT_SUPPORT',
      department: 'tony_stark',
      beneficiary: 'rio',
      deliverable: 'RIO website technical architecture, implementation plan, workflow/deployment readiness, and engineering blockers with evidence',
      commercial_owner: 'rio',
      authority_level: context.authority_level || 'EXISTING_GOVERNED_ENGINEERING_AUTHORITY',
      next_handoff: 'RIO_REVIEW_AND_COMMERCIAL_EXECUTION',
    };
  }

  if (/TONY/.test(upper) && /RIO/.test(upper) && /(HELP|SUPPORT|MADAD)/.test(upper)) {
    return {
      intent: 'CROSS_DEPARTMENT_SUPPORT',
      department: 'tony_stark',
      beneficiary: 'rio',
      deliverable: 'Provide engineering diagnostics, architecture, workflow repair, and technical implementation support to RIO without taking over RIO commercial ownership',
      commercial_owner: 'rio',
      authority_level: context.authority_level || 'EXISTING_GOVERNED_ENGINEERING_AUTHORITY',
      next_handoff: 'RIO_REVIEW_AND_EXECUTION',
    };
  }

  return {
    intent: 'UNCLASSIFIED',
    raw_message: text,
    context,
  };
}

export function bindFounderDecision({ decision, priorTask = null, priorBlocker = null, timestamp = new Date().toISOString() } = {}) {
  return {
    decision: decision || 'UNSPECIFIED',
    binds_to_task: priorTask,
    resolves_blocker: priorBlocker,
    bound_at_utc: timestamp,
    status: priorTask || priorBlocker ? 'BOUND' : 'UNBOUND_REQUIRES_CONTEXT',
  };
}

export function buildTaskContract({ objective, department, deliverable, authorityLevel, evidenceRequired, exitCriteria, nextHandoff } = {}) {
  const contract = {
    objective: objective || null,
    department: department || null,
    deliverable: deliverable || null,
    authority_level: authorityLevel || null,
    evidence_required: evidenceRequired || [],
    exit_criteria: exitCriteria || null,
    next_handoff: nextHandoff || null,
  };
  const missing = Object.entries(contract)
    .filter(([key, value]) => key !== 'evidence_required' && (value === null || value === ''))
    .map(([key]) => key);
  if (!Array.isArray(contract.evidence_required) || !contract.evidence_required.length) missing.push('evidence_required');
  return { ...contract, valid: missing.length === 0, missing };
}

export function reviewOutcome({ expected, actual, previousAction = null, sameActionCount = 0, hasNewEvidence = true } = {}) {
  const matched = JSON.stringify(expected ?? null) === JSON.stringify(actual ?? null);
  const repeatLoop = Number(sameActionCount) >= 2 && hasNewEvidence === false;
  return {
    expected,
    actual,
    matched,
    previous_action: previousAction,
    repeat_loop_detected: repeatLoop,
    learning_candidate: matched ? 'SUCCESS_PATTERN_CANDIDATE' : 'MISMATCH_OR_FAILURE_PATTERN_CANDIDATE',
    required_next_mode: repeatLoop ? 'FIVE_WHYS_BEFORE_NEXT_DISPATCH' : 'NORMAL_REPLAN',
  };
}

export function departmentCapabilityFit(department, taskText) {
  const dept = normalize(department);
  const text = normalize(taskText);
  const patterns = {
    TONY_STARK: /TECHNICAL|ENGINEERING|DEBUG|ROOT CAUSE|WORKFLOW|CODE|CONFIG|DEPLOY|ARCHITECTURE|WEBSITE/,
    RIO: /AFFILIATE|REVENUE|OFFER|TRAFFIC|CONVERSION|COMMISSION|COMMERCIAL/,
    HULK: /RESEARCH|MARKET|EVIDENCE|INVESTIGATE|EXTERNAL INFORMATION/,
    AURA3: /CREATIVE|CONTENT|DESIGN|SOCIAL|ASSET/,
  };
  const pattern = patterns[dept];
  return pattern ? pattern.test(text) : false;
}
