import { translateFounderIntent, buildTaskContract } from './runtime.mjs';

const EXECUTIVE_PATTERNS = [
  /\b5\s*WHY\b|\bFIVE\s*WHYS?\b/i,
  /ROOT\s*CAUSE/i,
  /BLIND\s*RETRY/i,
  /SAME\s+(?:RECOMMENDATION|BLOCKER|FAILURE)/i,
  /\bBRAIN\b/i,
  /NEXT\s+BEST\s+ACTION/i,
  /REVIEW.{0,40}(?:GOAL|REVENUE|BLOCKER|PROGRESS)/i,
  /(?:GOAL|REVENUE).{0,40}REVIEW/i,
  /DECOMPOSE|TASK\s+BREAKDOWN|WORKSTREAM/i,
  /DECIDE.{0,40}(?:DEPARTMENT|ROUTE|NEXT\s+ACTION)/i,
];

const SIMPLE_STATUS_PATTERNS = [
  /^\s*(?:RIO|TONY(?:\s+STARK)?|AURA\s*3|AURA3)\s+(?:KA|KI|KYA|STATUS|CURRENT)/i,
  /\b(?:KYA\s+KAR\s+RHA|KYA\s+KAR\s+RAHA|STATUS\s+BATAO|PURA\s+STATUS)\b/i,
];

export function classifyTelegramBrainIntent(message, context = {}) {
  const text = String(message || '').trim();
  const translated = translateFounderIntent(text, context);

  if (translated.intent === 'CROSS_DEPARTMENT_SUPPORT') {
    return { mode: 'CROSS_DEPARTMENT_SUPPORT', plan: translated };
  }

  if (SIMPLE_STATUS_PATTERNS.some(pattern => pattern.test(text))) {
    return { mode: 'LEGACY_DIRECT_STATUS' };
  }

  if (EXECUTIVE_PATTERNS.some(pattern => pattern.test(text))) {
    return {
      mode: 'EXECUTIVE_GOAL_REVIEW',
      reason: 'FOUNDER_REQUEST_REQUIRES_BRAIN_REASONING_BEFORE_DEPARTMENT_ROUTING',
    };
  }

  return { mode: 'LEGACY_DIRECT' };
}

export function shouldForceFiveWhysFromRuntime(runtimeGoal = {}) {
  return runtimeGoal?.brain_required_mode === 'FIVE_WHYS_BEFORE_NEXT_DISPATCH'
    || Number(runtimeGoal?.same_recommendation_count) >= 2
    || Number(runtimeGoal?.same_failure_count) >= 2
    || runtimeGoal?.brain_review?.repeat_loop_detected === true;
}

export function buildCrossDepartmentSupportPrompt(plan, founderMessage = '') {
  const contract = buildTaskContract({
    objective: `Support ${plan?.beneficiary || 'beneficiary department'} without taking over its ownership`,
    department: plan?.department,
    deliverable: plan?.deliverable,
    authorityLevel: plan?.authority_level,
    evidenceRequired: ['FRESH_REPO_OR_RUNTIME_EVIDENCE', 'ACTIONABLE_DELIVERABLE'],
    exitCriteria: `${plan?.beneficiary || 'beneficiary'} receives a concrete actionable deliverable with verified blockers or readiness`,
    nextHandoff: plan?.next_handoff,
  });
  if (!contract.valid) throw new Error(`INVALID_BRAIN_TASK_CONTRACT_${contract.missing.join('_')}`);

  return [
    'VICTOR BRAIN — CROSS-DEPARTMENT TASK CONTRACT',
    `Founder instruction: ${String(founderMessage || '').slice(0, 1200)}`,
    `Department: ${contract.department}`,
    `Objective: ${contract.objective}`,
    `Deliverable: ${contract.deliverable}`,
    `Authority: ${contract.authority_level}`,
    `Evidence required: ${contract.evidence_required.join(' | ')}`,
    `Exit criteria: ${contract.exit_criteria}`,
    `Next handoff: ${contract.next_handoff}`,
    'Do not reject this task merely because the beneficiary owns commercial execution. Perform the department-compatible technical/research/creative support inside existing authority.',
    'Return strict_supervision with status, outcome_progress, error_or_blocker, root_cause, solution, next_action, evidence, requires_follow_up.',
  ].join('\n');
}
