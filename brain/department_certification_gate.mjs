export const DEPARTMENT_CERTIFICATION_VERSION = 'victor-department-certification-v1';

const TARGETS = Object.freeze({
  TONY: 'tony_stark',
  AURA3: 'aura3',
  RIO: 'rio',
});

const PROMPTS = Object.freeze({
  TONY: [
    'END GAME Step-8 Tony substantive certification task.',
    'Read/analyze the Dr.-Victor-Multi-AI-Orchestrator repository and the current END GAME Step-8 Tony certification workflow.',
    'Return an evidence-backed engineering assessment with at least one concrete finding, one actionable recommendation, inspected repository evidence, and explicit execution completion.',
    'This is evidence-only sandbox diagnosis: do not deploy, mutate repositories, perform paid/public/destructive actions, change authority, access or rotate credentials/secrets, or perform any production action.',
    'Return a strict TASK_RESULT to Victor with objective_alignment, solution, next_action, evidence, requires_follow_up, and revert_to_victor=true.',
  ].join(' '),
  AURA3: 'PACKAGE3 strict supervision certification probe. Return fresh evidence. No public, production, paid, destructive, repository mutation, authority or credential action.',
  RIO: 'PACKAGE3 strict supervision certification probe. Return fresh evidence. No public, production, paid, destructive, repository mutation, authority or credential action.',
});

export function parseDepartmentCertificationCommand(text) {
  const match = String(text || '').match(/^\s*ENDGAME DEPARTMENT CERTIFY\s+(TONY|AURA3|RIO)\s*$/i);
  if (!match) return null;
  const department = match[1].toUpperCase();
  return {
    version: DEPARTMENT_CERTIFICATION_VERSION,
    department,
    target: TARGETS[department],
    prompt: PROMPTS[department],
    scope: 'EVIDENCE_ONLY_SANDBOX_DIAGNOSIS',
  };
}

export function certificationAllowedDuringWatchdog(watchdogDecision) {
  return Boolean(
    watchdogDecision
    && watchdogDecision.allow_evidence_collection === true
    && watchdogDecision.allow_sandbox_diagnosis === true
  );
}
