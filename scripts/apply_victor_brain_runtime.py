from pathlib import Path

PATH = Path('victor-telegram-worker/autonomy_runtime.mjs')
text = PATH.read_text(encoding='utf-8')
original = text

ALREADY_APPLIED_MARKERS = {
    'initial_phase': "const initialPhase = (",
    'followup_phase': "const followUpPhase = nextRuntimeGoal.brain_required_mode",
    'supervise_prompt': "buildGoalTaskPrompt(selection.goal, phase, selection.runtimeGoal || {})",
}


def replace_once(old: str, new: str, label: str):
    global text
    if new in text:
        return
    marker = ALREADY_APPLIED_MARKERS.get(label)
    if marker and marker in text:
        return
    if old not in text:
        raise SystemExit(f'PATCH_ANCHOR_NOT_FOUND:{label}')
    text = text.replace(old, new, 1)


replace_once(
    "import { isExecutionPaused } from './emergency_pause_runtime.mjs';\n",
    "import { isExecutionPaused } from './emergency_pause_runtime.mjs';\nimport { shouldRunFiveWhys, reviewOutcome, departmentCapabilityFit } from '../brain/runtime.mjs';\n",
    'brain_import',
)

replace_once(
    "    outcomeProgress: strict.outcome_progress || result?.outcome_progress || null,\n    evidence,\n    finalOutcome,\n",
    "    outcomeProgress: strict.outcome_progress || result?.outcome_progress || null,\n    rootCause: strict.root_cause || result?.root_cause || null,\n    solution: strict.solution || result?.solution || null,\n    evidence,\n    finalOutcome,\n",
    'assessment_root_cause',
)

old_prompt = '''export function buildGoalTaskPrompt(goal, phase = 'EXECUTE') {
  const success = Array.isArray(goal?.success_conditions) ? goal.success_conditions : [];
  const boundaries = Array.isArray(goal?.hard_boundaries) ? goal.hard_boundaries : [];
  return [
    `VICTOR GOAL CONTRACT — ${phase}`,
    `Goal ID: ${goal?.goal_id || 'UNKNOWN'}`,
    `Target: ${goal?.objective || 'NOT_PROVIDED'}`,
    `Success conditions: ${success.join(' | ') || 'Use canonical department objective and evidence standard.'}`,
    `Required evidence: ${goal?.required_evidence_level || 'CANONICAL_REQUIRED_EVIDENCE'}`,
    `Hard boundaries: ${boundaries.join(' | ') || 'Existing constitutional, credential, cost, compliance and evidence boundaries.'}`,
    'Operating rule: the target is fixed; HOW is delegated. Choose the highest-impact valid next action yourself, execute it inside existing authority, and change the plan if the previous route is weak or blocked.',
    'Commercial priority rule: when verified revenue is zero and executable offers/actions exist, prioritize the closest policy-valid revenue/conversion action. Planning, readiness documents, or pillar rotation must not displace an executable higher-impact commercial action unless they remove a verified blocker.',
    'Do not wait for routine Founder approval. Founder is required only for credential/account identity administration, a hard-boundary/goal change, or objective impossibility after governed recovery.',
    'Return fresh evidence. Do not report task completion as goal achievement unless the Goal Contract success conditions are actually verified.',
    'Return strict_supervision with status, goal_id, outcome_progress, error_or_blocker, next_action, evidence, requires_follow_up. Include final_outcome only when final outcome evidence exists.',
  ].join('\\n');
}
'''
new_prompt = '''export function buildGoalTaskPrompt(goal, phase = 'EXECUTE', runtimeGoal = {}) {
  const success = Array.isArray(goal?.success_conditions) ? goal.success_conditions : [];
  const boundaries = Array.isArray(goal?.hard_boundaries) ? goal.hard_boundaries : [];
  const fiveWhysMode = phase === 'FIVE_WHYS_DIAGNOSIS' || runtimeGoal?.brain_required_mode === 'FIVE_WHYS_BEFORE_NEXT_DISPATCH';
  return [
    `VICTOR GOAL CONTRACT — ${phase}`,
    `Goal ID: ${goal?.goal_id || 'UNKNOWN'}`,
    `Target: ${goal?.objective || 'NOT_PROVIDED'}`,
    `Success conditions: ${success.join(' | ') || 'Use canonical department objective and evidence standard.'}`,
    `Required evidence: ${goal?.required_evidence_level || 'CANONICAL_REQUIRED_EVIDENCE'}`,
    `Hard boundaries: ${boundaries.join(' | ') || 'Existing constitutional, credential, cost, compliance and evidence boundaries.'}`,
    'Brain rule: decompose work into a concrete deliverable with authority, evidence, exit criteria, and next handoff. Department role is capability guidance, not a reason to reject a valid cross-department technical support task.',
    fiveWhysMode
      ? 'BRAIN FIVE-WHYS MODE: do not repeat the previous action. Start from the verified symptom, build an evidence-backed causal chain, label unsupported causes HYPOTHESIS, identify the best supported controllable root cause, and return the corrective next action. If the verified chain ends at a Founder-only boundary, state the exact Founder action required; otherwise continue without Founder approval.'
      : 'Operating rule: the target is fixed; HOW is delegated. Choose the highest-impact valid next action yourself, execute it inside existing authority, and change the plan if the previous route is weak or blocked.',
    'Commercial priority rule: when verified revenue is zero and executable offers/actions exist, prioritize the closest policy-valid revenue/conversion action. Planning, readiness documents, or pillar rotation must not displace an executable higher-impact commercial action unless they remove a verified blocker.',
    'Do not wait for routine Founder approval. Founder is required only for credential/account identity administration, a hard-boundary/goal change, or objective impossibility after governed recovery.',
    'Return fresh evidence. Do not report task completion as goal achievement unless the Goal Contract success conditions are actually verified.',
    'Return strict_supervision with status, goal_id, outcome_progress, error_or_blocker, root_cause, solution, next_action, evidence, requires_follow_up. Include final_outcome only when final outcome evidence exists.',
  ].join('\\n');
}
'''
replace_once(old_prompt, new_prompt, 'goal_prompt')

old_recommend = '''export function recommendNextDepartment(goal, assessment, currentTarget) {
  const allowed = new Set(Array.isArray(goal?.allowed_departments) ? goal.allowed_departments : []);
  const text = [assessment?.status, assessment?.nextAction, assessment?.hasBlocker ? 'BLOCKER' : '', assessment?.outcomeProgress]
    .filter(Boolean).join(' ').toUpperCase();
  if (allowed.has('tony_stark') && /TONY|TECHNICAL|RUNTIME|WORKFLOW|CODE|CONFIG|DEPLOY|BRIDGE|BUG|SYSTEM FAILURE|INTEGRATION FAILURE/.test(text)) return 'tony_stark';
  if (allowed.has('aura3') && /AURA3|AURA 3|CONTENT CREATIVE|DESIGN ASSET/.test(text)) return 'aura3';
  if (allowed.has('rio') && /RIO|AFFILIATE|REVENUE|TRAFFIC|CONVERSION|NICHE|OFFER|COMMISSION/.test(text)) return 'rio';
  return currentTarget || goal?.primary_department || null;
}
'''
new_recommend = '''export function recommendNextDepartment(goal, assessment, currentTarget) {
  const allowed = new Set(Array.isArray(goal?.allowed_departments) ? goal.allowed_departments : []);
  const text = [assessment?.status, assessment?.nextAction, assessment?.rootCause, assessment?.solution, assessment?.hasBlocker ? 'BLOCKER' : '', assessment?.outcomeProgress]
    .filter(Boolean).join(' ').toUpperCase();
  if (allowed.has('tony_stark') && departmentCapabilityFit('tony_stark', text)) return 'tony_stark';
  if (allowed.has('aura3') && departmentCapabilityFit('aura3', text)) return 'aura3';
  if (allowed.has('rio') && departmentCapabilityFit('rio', text)) return 'rio';
  if (allowed.has('hulk') && departmentCapabilityFit('hulk', text)) return 'hulk';
  return currentTarget || goal?.primary_department || null;
}
'''
replace_once(old_recommend, new_recommend, 'department_recommendation')

replace_once(
    "  const nextDepartment = achieved ? null : recommendNextDepartment(goal, assessment, selection?.target);\n  const evidence = unique([...(oldGoal.evidence || []), ...(assessment.evidence || [])]).slice(-50);\n",
    "  const nextDepartment = achieved ? null : recommendNextDepartment(goal, assessment, selection?.target);\n  const oldEvidence = Array.isArray(oldGoal.evidence) ? oldGoal.evidence : [];\n  const assessmentEvidence = Array.isArray(assessment.evidence) ? assessment.evidence : [];\n  const hasNewEvidence = assessmentEvidence.some(item => !oldEvidence.includes(item));\n  const sameFailureCount = failureFingerprint && failureFingerprint === oldGoal.failure_fingerprint\n    ? (Number(oldGoal.same_failure_count) || 1) + 1\n    : (failureFingerprint ? 1 : 0);\n  const sameRecommendationCount = assessment.nextAction && assessment.nextAction === oldGoal.last_next_action\n    ? (Number(oldGoal.same_recommendation_count) || 1) + 1\n    : (assessment.nextAction ? 1 : 0);\n  const brainReview = reviewOutcome({\n    expected: oldGoal.last_next_action || null,\n    actual: assessment.nextAction || null,\n    previousAction: oldGoal.last_status || null,\n    sameActionCount: Math.max(sameFailureCount, sameRecommendationCount),\n    hasNewEvidence,\n  });\n  const fiveWhysRequired = !achieved && !founderBlocked && shouldRunFiveWhys({\n    rootCauseKnown: Boolean(assessment.rootCause),\n    repeatedFailureCount: sameFailureCount,\n    sameRecommendationCount,\n    hasNewEvidence,\n    departmentExplainsFailure: assessment.hasBlocker ? Boolean(assessment.rootCause || assessment.outcomeProgress) : true,\n    confidence: assessment.hasBlocker && !assessment.rootCause ? 'LOW' : 'MEDIUM',\n  });\n  const evidence = unique([...oldEvidence, ...assessmentEvidence]).slice(-50);\n",
    'brain_review_calculation',
)

replace_once(
    "        recommended_department: nextDepartment,\n        last_status: assessment.status || 'UNKNOWN',\n",
    "        recommended_department: nextDepartment,\n        brain_required_mode: fiveWhysRequired ? 'FIVE_WHYS_BEFORE_NEXT_DISPATCH' : 'NORMAL_EXECUTION',\n        brain_review: brainReview,\n        same_failure_count: sameFailureCount,\n        same_recommendation_count: sameRecommendationCount,\n        last_status: assessment.status || 'UNKNOWN',\n",
    'brain_runtime_state',
)

replace_once(
    "  let outcome = await superviseGoal(selection, env, 'EXECUTE');\n",
    "  const initialPhase = selection.runtimeGoal?.brain_required_mode === 'FIVE_WHYS_BEFORE_NEXT_DISPATCH'\n    ? 'FIVE_WHYS_DIAGNOSIS'\n    : 'EXECUTE';\n  let outcome = await superviseGoal(selection, env, initialPhase);\n",
    'initial_phase',
)

replace_once(
    "      const followUp = await superviseGoal(selection, env, 'REPLAN_EXECUTE');\n",
    "      const followUpPhase = nextRuntimeGoal.brain_required_mode === 'FIVE_WHYS_BEFORE_NEXT_DISPATCH'\n        ? 'FIVE_WHYS_DIAGNOSIS'\n        : 'REPLAN_EXECUTE';\n      const followUp = await superviseGoal(selection, env, followUpPhase);\n",
    'followup_phase',
)

replace_once(
    "  const prompt = buildGoalTaskPrompt(selection.goal, phase);\n",
    "  const prompt = buildGoalTaskPrompt(selection.goal, phase, selection.runtimeGoal || {});\n",
    'supervise_prompt',
)

if text == original:
    print('NO_CHANGES_ALREADY_APPLIED')
else:
    PATH.write_text(text, encoding='utf-8')
    print('VICTOR_BRAIN_RUNTIME_PATCH_APPLIED')
