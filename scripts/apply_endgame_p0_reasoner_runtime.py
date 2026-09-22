from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"{label} anchor not found")
    return text.replace(old, new, 1)


p = Path('victor-telegram-worker/autonomy_runtime.mjs')
s = p.read_text()

old_import = "import { buildStrategyFingerprint, evaluateProgressDelta, nextConvergenceState, validateStrategyChange } from '../brain/progress_contract.mjs';\n"
new_import = old_import + "import { shouldInvokeExecutiveReasoner, requestExecutivePlan } from '../brain/executive_reasoning.mjs';\nimport { callVictorModel } from './model_router.mjs';\n"
s = replace_once(s, old_import, new_import, 'reasoner imports')

old_block = r'''  const initialPhase = (
    selection.runtimeGoal?.brain_required_mode === 'FIVE_WHYS_BEFORE_NEXT_DISPATCH'
    || Number(selection.runtimeGoal?.same_recommendation_count) >= 2
    || Number(selection.runtimeGoal?.same_failure_count) >= 2
    || selection.runtimeGoal?.brain_review?.repeat_loop_detected === true
  )
    ? 'FIVE_WHYS_DIAGNOSIS'
    : 'EXECUTE';
  let outcome = await superviseGoal(selection, env, initialPhase);
  state = buildGoalRuntimeState(state, selection, outcome);
'''
new_block = r'''  let initialPhase = (
    selection.runtimeGoal?.brain_required_mode === 'FIVE_WHYS_BEFORE_NEXT_DISPATCH'
    || Number(selection.runtimeGoal?.same_recommendation_count) >= 2
    || Number(selection.runtimeGoal?.same_failure_count) >= 2
    || selection.runtimeGoal?.brain_review?.repeat_loop_detected === true
  )
    ? 'FIVE_WHYS_DIAGNOSIS'
    : 'EXECUTE';

  let executiveReasoning = null;
  if (shouldInvokeExecutiveReasoner(selection.runtimeGoal || {})) {
    let reasoned;
    try {
      reasoned = await requestExecutivePlan({
        env,
        goal: selection.goal,
        runtimeGoal: selection.runtimeGoal || {},
        availableDepartments: available,
        trigger: 'PERSISTED_NO_PROGRESS_OR_STALLED_STRATEGY',
        callModel: callVictorModel,
      });
    } catch (error) {
      return {
        status: 'SAFE_STOP',
        goalId: selection.goal.goal_id,
        target: selection.target,
        error_code: error?.code || 'EXECUTIVE_REASONER_FAILED',
        diagnostics: {
          stage: 'EXECUTIVE_REASONING_BOUNDARY',
          validation_errors: Array.isArray(error?.validationErrors) ? error.validationErrors : [],
          secrets_exposed: false,
        },
      };
    }

    executiveReasoning = {
      status: reasoned.status,
      model: reasoned.model,
      discovery_status: reasoned.discovery_status,
      plan: reasoned.plan,
    };

    if (reasoned.status === 'FOUNDER_GUIDANCE_NEEDED') {
      return {
        status: 'SAFE_STOP',
        goalId: selection.goal.goal_id,
        target: selection.target,
        error_code: 'FOUNDER_GUIDANCE_REQUIRED',
        diagnostics: {
          stage: 'EXECUTIVE_REASONING_BOUNDARY',
          strategy_summary: reasoned.plan.strategy_summary,
          exact_question: reasoned.plan.founder_question,
          unknowns: reasoned.plan.unknowns,
          evidence_needed: reasoned.plan.evidence_needed,
          secrets_exposed: false,
        },
      };
    }

    selection = {
      ...selection,
      target: reasoned.plan.target,
      executiveReasoning,
    };
    initialPhase = reasoned.plan.phase;
  }

  let outcome = await superviseGoal(selection, env, initialPhase);
  if (executiveReasoning) outcome = { ...outcome, executiveReasoning };
  state = buildGoalRuntimeState(state, selection, outcome);
'''
s = replace_once(s, old_block, new_block, 'initial executive reasoning boundary')

old_result = """    result: { ...outcome, progressDelta: finalRuntimeGoal.last_progress_delta || null },
  };
}
"""
new_result = """    result: {
      ...outcome,
      progressDelta: finalRuntimeGoal.last_progress_delta || null,
      executiveReasoning: outcome.executiveReasoning || executiveReasoning || null,
    },
  };
}
"""
s = replace_once(s, old_result, new_result, 'reasoning evidence in cycle result')

p.write_text(s)
