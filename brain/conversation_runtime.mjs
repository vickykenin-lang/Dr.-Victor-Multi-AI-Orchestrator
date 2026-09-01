export function normalizeConversationText(value) {
  return String(value || '').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim();
}

export function classifyConversationFollowUp(text, session = {}) {
  const value = normalizeConversationText(text);
  const hasTarget = ['rio', 'tony_stark', 'aura3'].includes(session?.last_target);
  const hasTask = Boolean(session?.last_task_id);

  const continuation = /^(pata karke batao|check karke batao|dekh ke batao|dekho aur batao|find out|check and tell me|kya hua|kya status hai|status\??)$/i.test(value);
  const taskStatus = /(iska|uska|task ka|task).*status|status.*(iska|uska|task)|kab pata chalega|kab result milega|result kab|revert kab/i.test(value);
  const problemFollowUp = /^(kya pareshani hai abhi|kaha atka hua hai|kahaan atka hua hai|kahan atka hai|what is the issue now|what is blocking it)$/i.test(value);
  const nextStepFollowUp = /^(to |toh |ab |then |so )?(ab )?(kya karna chahiye|kya kare|kya karen|next kya|aage kya|what should we do|what next|what should i do|what should victor do)\??$/i.test(value);

  if (taskStatus && hasTask) {
    return { mode: 'TASK_STATUS_FOLLOWUP', target: session.last_target || null, task_id: session.last_task_id, reason: 'RECENT_TASK_STATUS_REFERENCE' };
  }
  if (nextStepFollowUp && hasTarget) {
    return { mode: 'CONTEXTUAL_NEXT_STEP', target: session.last_target, task_id: hasTask ? session.last_task_id : null, reason: hasTask ? 'NEXT_STEP_BOUND_TO_ACTIVE_TASK' : 'NEXT_STEP_BOUND_TO_ACTIVE_TOPIC' };
  }
  if ((continuation || problemFollowUp) && hasTarget) {
    return { mode: 'CONTEXTUAL_DEPARTMENT_FOLLOWUP', target: session.last_target, task_id: hasTask ? session.last_task_id : null, reason: 'RECENT_DEPARTMENT_CONTEXT' };
  }
  return { mode: null, target: null, task_id: null, reason: 'NO_CONTEXTUAL_FOLLOWUP' };
}

export function formatPendingTaskStatus(session = {}) {
  const target = String(session.last_target || 'department').toUpperCase();
  const taskId = session.last_task_id || 'unknown';
  return `${target} task ${taskId} ka result abhi pending hai. Victor isi task ka fresh revert wait/verify karega; naya duplicate task dispatch nahi karega.`;
}
