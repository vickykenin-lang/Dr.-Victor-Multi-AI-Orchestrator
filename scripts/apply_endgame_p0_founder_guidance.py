from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"{label} anchor not found")
    return text.replace(old, new, 1)


# 1) Executive reasoner receives scoped Founder-confirmed guidance as advisory planning context.
p = Path('brain/executive_reasoning.mjs')
s = p.read_text()
old = """      last_progress_delta: runtimeGoal.last_progress_delta || null,
      evidence_refs: Array.isArray(runtimeGoal.evidence) ? runtimeGoal.evidence.slice(-12) : [],
    },
"""
new = """      last_progress_delta: runtimeGoal.last_progress_delta || null,
      evidence_refs: Array.isArray(runtimeGoal.evidence) ? runtimeGoal.evidence.slice(-12) : [],
      founder_guidance: runtimeGoal.founder_guidance || null,
    },
"""
s = replace_once(s, old, new, 'founder guidance in reasoner prompt')
p.write_text(s)


# 2) Autonomous runtime persists/reads precise guidance requests and consumes answers only after a validated dispatch.
p = Path('victor-telegram-worker/autonomy_runtime.mjs')
s = p.read_text()
old_import = "import { shouldInvokeExecutiveReasoner, requestExecutivePlan } from '../brain/executive_reasoning.mjs';\n"
new_import = old_import + "import { buildFounderGuidanceRequest, persistFounderGuidanceRequest, readFounderGuidance, attachFounderGuidanceMessage, founderGuidanceContext, consumeFounderGuidance, formatFounderGuidanceQuestion } from '../brain/founder_guidance.mjs';\n"
s = replace_once(s, old_import, new_import, 'Founder guidance autonomy import')

old = """  let initialPhase = (
    selection.runtimeGoal?.brain_required_mode === 'FIVE_WHYS_BEFORE_NEXT_DISPATCH'
"""
new = """  const storedGuidance = await readFounderGuidance(env, selection.goal.goal_id);
  if (storedGuidance?.status === 'PENDING') {
    return {
      status: 'SAFE_STOP',
      goalId: selection.goal.goal_id,
      target: selection.target,
      error_code: 'FOUNDER_GUIDANCE_PENDING',
      diagnostics: {
        stage: 'FOUNDER_GUIDANCE_LOOP',
        guidance_id: storedGuidance.guidance_id || null,
        exact_question: storedGuidance.exact_question || null,
        secrets_exposed: false,
      },
    };
  }

  const answeredGuidance = founderGuidanceContext(storedGuidance);
  if (answeredGuidance) {
    selection = {
      ...selection,
      runtimeGoal: {
        ...(selection.runtimeGoal || {}),
        founder_guidance: answeredGuidance,
      },
    };
  }

  let initialPhase = (
    selection.runtimeGoal?.brain_required_mode === 'FIVE_WHYS_BEFORE_NEXT_DISPATCH'
"""
s = replace_once(s, old, new, 'guidance read before initial phase')

old = """  if (shouldInvokeExecutiveReasoner(selection.runtimeGoal || {})) {
"""
new = """  if (shouldInvokeExecutiveReasoner(selection.runtimeGoal || {}, { force: Boolean(answeredGuidance) })) {
"""
s = replace_once(s, old, new, 'force reasoner after guidance answer')

old = """    if (reasoned.status === 'FOUNDER_GUIDANCE_NEEDED') {
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
"""
new = """    if (reasoned.status === 'FOUNDER_GUIDANCE_NEEDED') {
      const guidanceRequest = buildFounderGuidanceRequest({
        goal: selection.goal,
        reasonedPlan: reasoned.plan,
        runtimeGoal: selection.runtimeGoal || {},
      });
      const persisted = await persistFounderGuidanceRequest(env, guidanceRequest);
      if (persisted.status === 'PENDING_CONFIGURATION') {
        return {
          status: 'SAFE_STOP',
          goalId: selection.goal.goal_id,
          target: selection.target,
          error_code: 'FOUNDER_GUIDANCE_STORE_UNAVAILABLE',
          diagnostics: { stage: 'FOUNDER_GUIDANCE_LOOP', secrets_exposed: false },
        };
      }
      let telegramMessageId = persisted.record?.telegram_message_id || null;
      if (persisted.status === 'PERSISTED' || !telegramMessageId) {
        const sent = await sendFounder(env, formatFounderGuidanceQuestion(persisted.record || guidanceRequest));
        telegramMessageId = sent?.message_id || null;
        if (telegramMessageId) {
          await attachFounderGuidanceMessage(env, selection.goal.goal_id, telegramMessageId);
        }
      }
      return {
        status: 'SAFE_STOP',
        goalId: selection.goal.goal_id,
        target: selection.target,
        error_code: 'FOUNDER_GUIDANCE_PENDING',
        diagnostics: {
          stage: 'FOUNDER_GUIDANCE_LOOP',
          guidance_id: persisted.record?.guidance_id || guidanceRequest.guidance_id,
          exact_question: persisted.record?.exact_question || guidanceRequest.exact_question,
          telegram_message_id: telegramMessageId,
          secrets_exposed: false,
        },
      };
    }
"""
s = replace_once(s, old, new, 'persist precise Founder guidance request')

old = """  let outcome = await superviseGoal(selection, env, initialPhase);
  if (executiveReasoning) outcome = { ...outcome, executiveReasoning };
  state = buildGoalRuntimeState(state, selection, outcome);
"""
new = """  let outcome = await superviseGoal(selection, env, initialPhase);
  if (executiveReasoning) outcome = { ...outcome, executiveReasoning };
  if (answeredGuidance && executiveReasoning && outcome?.actionContract?.action_id) {
    await consumeFounderGuidance(env, selection.goal.goal_id, {
      actionId: outcome.actionContract.action_id,
      strategySummary: executiveReasoning.plan?.strategy_summary || null,
    });
  }
  state = buildGoalRuntimeState(state, selection, outcome);
"""
s = replace_once(s, old, new, 'consume applied Founder guidance')

old = """async function sendFounder(env, text) {
  const response = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN_VICTOR}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: String(env.VICTOR_FOUNDER_CHAT_ID),
      text: String(text).slice(0, 4096),
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) throw new Error(`AUTONOMY_TELEGRAM_HTTP_${response.status}`);
}
"""
new = """async function sendFounder(env, text) {
  const response = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN_VICTOR}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: String(env.VICTOR_FOUNDER_CHAT_ID),
      text: String(text).slice(0, 4096),
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) throw new Error(`AUTONOMY_TELEGRAM_HTTP_${response.status}`);
  const body = await response.json().catch(() => null);
  return body?.result || null;
}
"""
s = replace_once(s, old, new, 'sendFounder return Telegram message')
p.write_text(s)


# 3) Telegram worker binds the Founder's answer only to the pending guidance question and wakes autonomy immediately.
p = Path('victor-telegram-worker/worker.js')
s = p.read_text()
old_import = "import { classifyHulkRequest, hulkActionBlockedReply, hulkStatusReply, isCasualWellbeing, casualWellbeingReply } from '../brain/hulk_guard.mjs';\n"
new_import = old_import + "import { readActiveFounderGuidance, shouldTreatAsFounderGuidanceAnswer, recordFounderGuidanceAnswer } from '../brain/founder_guidance.mjs';\n"
s = replace_once(s, old_import, new_import, 'Founder guidance worker import')

old = """    try {
      processingStage = 'MEMORY_WRITE';
"""
new = """    try {
      processingStage = 'FOUNDER_GUIDANCE_CHECK';
      const pendingGuidance = await readActiveFounderGuidance(env);
      if (shouldTreatAsFounderGuidanceAnswer(text, message, pendingGuidance)) {
        const answered = await recordFounderGuidanceAnswer(env, pendingGuidance, text, {
          chatId,
          messageId: message.message_id,
        });
        if (answered.status === 'ANSWERED') {
          await writeConversationSession(chatId, {
            task_state: 'FOUNDER_GUIDANCE_ANSWERED',
            founder_guidance_id: answered.record.guidance_id,
            founder_guidance_goal_id: answered.record.goal_id,
          }, env);
          await sendTelegramMessage(
            env,
            chatId,
            `Guidance received for ${answered.record.goal_id}. Victor is replanning now; completion will be claimed only after fresh verified evidence.`,
            message.message_id,
          );
          ctx?.waitUntil(runFounderGuidanceWake(env));
          return json({ ok: true, mode: 'FOUNDER_GUIDANCE_ANSWER', status: 'ANSWERED', goal_id: answered.record.goal_id });
        }
      }

      processingStage = 'MEMORY_WRITE';
"""
s = replace_once(s, old, new, 'Telegram guidance answer binding')

anchor = """function sanitizeRuntimeError(error) {
  const value = String(error?.message || 'AUTONOMOUS_CYCLE_FAILED').toUpperCase();
  return value.replace(/[^A-Z0-9_:-]/g, '_').slice(0, 120);
}
"""
insert = anchor + """

async function runFounderGuidanceWake(env) {
  const controller = { cron: 'founder-command', scheduledTime: Date.now() };
  let result;
  try {
    result = await runAutonomousCycle(controller, env);
  } catch (error) {
    result = {
      status: 'SAFE_STOP',
      target: null,
      error_code: sanitizeRuntimeError(error),
    };
  }
  await persistAutonomyEvidence(env, controller, result);
  console.log(JSON.stringify({
    event: 'VICTOR_FOUNDER_GUIDANCE_WAKE',
    status: result.status,
    goal_id: result.goalId || null,
    target: result.target || null,
    secrets_exposed: false,
  }));
  return result;
}
"""
if 'async function runFounderGuidanceWake' not in s:
    s = replace_once(s, anchor, insert, 'Founder guidance immediate wake helper')
p.write_text(s)


# 4) Extend reasoner test so Founder-confirmed scoped guidance is explicitly present in the model context.
p = Path('brain/executive_reasoning.test.mjs')
s = p.read_text()
if "prompt carries FOUNDER_CONFIRMED scoped guidance" not in s:
    s += r'''

test('prompt carries FOUNDER_CONFIRMED scoped guidance after Founder answer', () => {
  const prompt = buildExecutiveReasoningPrompt({
    goal,
    runtimeGoal: {
      state: 'NO_PROGRESS',
      founder_guidance: {
        guidance_id: 'ORG-REVENUE-001:4',
        scope: 'GOAL',
        answer: 'Prioritize verified conversion evidence when landed-cost ceiling is satisfied.',
        provenance: 'FOUNDER_CONFIRMED',
      },
    },
    availableDepartments: ['rio', 'tony_stark'],
    trigger: 'FOUNDER_GUIDANCE_APPLIED',
  });
  assert.match(prompt.user, /FOUNDER_CONFIRMED/);
  assert.match(prompt.user, /Prioritize verified conversion evidence/);
});
'''
    p.write_text(s)
