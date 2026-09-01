from pathlib import Path

worker = Path('victor-telegram-worker/worker.js')
text = worker.read_text(encoding='utf-8')

ownership_import = "import { classifyOwnedProblem, buildOwnedProblemPrompt, naturalOwnedProblemAck } from '../brain/problem_ownership.mjs';\n"
outcome_import = "import { createOwnedOutcomeState, assessVerifiedDepartmentResult, shouldContinueOwnedRecovery, buildOwnedRecoveryDirective } from '../brain/outcome_state.mjs';\n"
if outcome_import not in text:
    if ownership_import not in text:
        raise SystemExit('outcome state import anchor missing')
    text = text.replace(ownership_import, ownership_import + outcome_import, 1)

old_dispatch = """        await writeConversationSession(chatId, {
          last_target: ownedProblem.target,
          last_task_id: dispatch.taskId,
          last_task_type: 'OWNED_PROBLEM_RECOVERY',
          active_issue: text,
          unresolved_question: text,
          task_state: 'OWNED_RECOVERY_RUNNING',
        }, env);
"""
new_dispatch = """        const ownedOutcome = createOwnedOutcomeState({
          target: ownedProblem.target,
          founderRequest: text,
          taskId: dispatch.taskId,
        });
        await writeConversationSession(chatId, {
          last_target: ownedProblem.target,
          last_task_id: dispatch.taskId,
          last_task_type: 'OWNED_PROBLEM_RECOVERY',
          active_issue: text,
          unresolved_question: text,
          task_state: ownedOutcome.stage,
          owned_outcome: ownedOutcome,
        }, env);
"""
if 'owned_outcome: ownedOutcome' not in text:
    if old_dispatch not in text:
        raise SystemExit('owned dispatch state anchor missing')
    text = text.replace(old_dispatch, new_dispatch, 1)

# Each verified department handler invokes the same bounded owned-outcome continuation path.
for target, report_anchor in [
    ('aura3', "    const report = formatAura3ResultForFounder(received.result);\n"),
    ('rio', "    const report = formatRioResultForFounder(received.result);\n"),
    ('tony_stark', "    const report = formatTonyResultForFounder(received.result);\n"),
]:
    marker = f"    if (await maybeContinueOwnedOutcome(env, chatId, '{target}', dispatch, received.result, replyToMessageId)) return;\n"
    if marker not in text:
        if report_anchor not in text:
            raise SystemExit(f'{target} verified-result anchor missing')
        text = text.replace(report_anchor, marker + report_anchor, 1)

helper_anchor = "async function sendNaturalDepartmentResult(env, chatId, target, rawReport, replyToMessageId) {\n"
helper = """async function maybeContinueOwnedOutcome(env, chatId, target, dispatch, rawResult, replyToMessageId) {
  const session = await readConversationSession(chatId, env);
  if (session?.last_task_type !== 'OWNED_PROBLEM_RECOVERY') return false;
  if (session?.last_task_id && session.last_task_id !== dispatch.taskId) return false;

  const prior = session?.owned_outcome || createOwnedOutcomeState({
    target,
    founderRequest: session?.active_issue || session?.unresolved_question || session?.last_founder_text || '',
    taskId: dispatch.taskId,
  });
  const assessed = assessVerifiedDepartmentResult({ ...rawResult, __victor_verified: true }, prior);
  await writeConversationSession(chatId, {
    task_state: assessed.stage,
    owned_outcome: assessed,
  }, env);

  if (!shouldContinueOwnedRecovery(assessed)) return false;

  const founderRequest = assessed.founder_request || session?.active_issue || session?.unresolved_question || session?.last_founder_text || '';
  const continuationText = [
    buildOwnedProblemPrompt(target, founderRequest, rawResult),
    buildOwnedRecoveryDirective(assessed),
  ].join('\n\n');
  const nextDispatch = await dispatchContextualInvestigation(env, target, continuationText, { messageId: 'owned-recovery' });
  const nextOutcome = createOwnedOutcomeState({
    target,
    founderRequest,
    taskId: nextDispatch.taskId,
    previous: assessed,
  });
  await writeConversationSession(chatId, {
    last_target: target,
    last_task_id: nextDispatch.taskId,
    last_task_type: 'OWNED_PROBLEM_RECOVERY',
    task_state: nextOutcome.stage,
    owned_outcome: nextOutcome,
    unresolved_question: founderRequest,
  }, env);

  if (target === 'rio') await handleRioRoundTrip(env, chatId, nextDispatch, replyToMessageId);
  else if (target === 'tony_stark') await handleTonyRoundTrip(env, chatId, nextDispatch, replyToMessageId);
  else if (target === 'aura3') await handleAura3RoundTrip(env, chatId, nextDispatch, replyToMessageId);
  return true;
}

"""
if 'async function maybeContinueOwnedOutcome(' not in text:
    if helper_anchor not in text:
        raise SystemExit('owned outcome helper anchor missing')
    text = text.replace(helper_anchor, helper + helper_anchor, 1)

# Preserve explicit outcome stage when natural synthesis writes the final answer.
old_natural_patch = """  await writeConversationSession(chatId, {
    last_victor_reply: reply,
    unresolved_question: null,
    task_state: 'RESULT_VERIFIED',
  }, env);
"""
new_natural_patch = """  const finalSession = await readConversationSession(chatId, env);
  await writeConversationSession(chatId, {
    last_victor_reply: reply,
    unresolved_question: finalSession?.owned_outcome?.objective_achieved === true ? null : finalSession?.unresolved_question || null,
    task_state: finalSession?.owned_outcome?.stage || 'RESULT_VERIFIED',
  }, env);
"""
if 'finalSession?.owned_outcome?.stage' not in text:
    if old_natural_patch not in text:
        raise SystemExit('natural result state anchor missing')
    text = text.replace(old_natural_patch, new_natural_patch, 1)

worker.write_text(text, encoding='utf-8')
print('OUTCOME_STATE_APPLIED')
