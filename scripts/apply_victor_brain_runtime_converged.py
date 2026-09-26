from pathlib import Path
import runpy

RUNTIME = Path('victor-telegram-worker/autonomy_runtime.mjs')
LEGACY_PATCH = Path('scripts/apply_victor_brain_runtime.py')
STEP8_CERT_PATCH = Path('scripts/apply_step8_certification_safehold.py')

text = RUNTIME.read_text(encoding='utf-8')

# Capability markers intentionally match the evolved runtime rather than old
# exact replacement blocks. If all are present, this migration is complete and
# must be a safe no-op. If any are absent, fall back to the legacy targeted
# migration, which retains fail-closed anchor checks for genuinely old source.
CAPABILITY_MARKERS = {
    'brain_import': "import { shouldRunFiveWhys, reviewOutcome, departmentCapabilityFit } from '../brain/runtime.mjs';",
    'assessment_root_cause': "rootCause: strict.root_cause || result?.root_cause || null,",
    'assessment_solution': "solution: strict.solution || result?.solution || null,",
    'goal_prompt_runtime_state': "export function buildGoalTaskPrompt(goal, phase = 'EXECUTE', runtimeGoal = {})",
    'five_whys_prompt': "FIVE_WHYS_DIAGNOSIS",
    'department_capability_fit': "departmentCapabilityFit('tony_stark', text)",
    'brain_review': "const brainReview = reviewOutcome({",
    'brain_runtime_state': "brain_required_mode: fiveWhysRequired ? 'FIVE_WHYS_BEFORE_NEXT_DISPATCH' : 'NORMAL_EXECUTION'",
    'progress_contract': "const progressDelta = evaluateProgressDelta({",
    'executive_reasoning': "shouldInvokeExecutiveReasoner(selection.runtimeGoal || {}",
    'founder_guidance': "readFounderGuidance(env, selection.goal.goal_id)",
    'initial_phase_execution': "let outcome = await superviseGoal(selection, env, initialPhase);",
    'followup_phase': "const followUpPhase = nextRuntimeGoal.brain_required_mode",
    'supervise_prompt_runtime_state': "buildGoalTaskPrompt(selection.goal, phase, selection.runtimeGoal || {})",
    'experience_ledger': "persistCycleExperience(env, experienceEntries)",
}

missing = [name for name, marker in CAPABILITY_MARKERS.items() if marker not in text]

if not missing:
    print('NO_CHANGES_ALREADY_APPLIED:CONVERGED_RUNTIME_CAPABILITIES_PRESENT')
else:
    print('CONVERGENCE_GUARD_MISSING=' + ','.join(missing))
    runpy.run_path(str(LEGACY_PATCH), run_name='__main__')

# Step 8 department certification is intentionally chained from this canonical
# convergence entrypoint so the existing Apply Victor Brain Runtime workflow
# applies the evidence-only SAFE_HOLD exception deterministically.
if not STEP8_CERT_PATCH.exists():
    raise SystemExit('STEP8_CERTIFICATION_PATCH_MISSING')
runpy.run_path(str(STEP8_CERT_PATCH), run_name='__main__')
