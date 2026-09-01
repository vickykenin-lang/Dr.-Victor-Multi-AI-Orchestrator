export function normalizeConversationText(value) {
  return String(value || '').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim();
}

function looksLikeEvidenceGap(text = '') {
  const value = normalizeConversationText(text);
  return /(evidence unavailable|evidence not available|fresh verified evidence unavailable|not verified|unverified|unknown|not confirmed|cannot confirm|no evidence|pending verification|evidence nahi|verify nahi|pata nahi)/i.test(value);
}

export function classifyConversationFollowUp(text, session = {}) {
  const value = normalizeConversationText(text);
  const hasTarget = ['rio', 'tony_stark', 'aura3'].includes(session?.last_target || session?.active_target);
  const target = session?.last_target || session?.active_target || null;
  const hasTask = Boolean(session?.last_task_id || session?.active_task_id);
  const taskId = session?.last_task_id || session?.active_task_id || null;
  const previousVictor = String(session?.last_victor_reply || '');

  const continuation = /^(pata karke batao|check karke batao|dekh ke batao|dekho aur batao|find out|check and tell me|kya hua|kya status hai|status\??)$/i.test(value);
  const taskStatus = /(iska|uska|task ka|task).*status|status.*(iska|uska|task)|kab pata chalega|kab result milega|result kab|revert kab/i.test(value);
  const problemFollowUp = /^(kya pareshani hai abhi|kaha atka hua hai|kahaan atka hua hai|kahan atka hai|what is the issue now|what is blocking it)$/i.test(value);
  const nextStepFollowUp = /^(to |toh |ab |then |so )?(ab )?(kya karna chahiye|kya kare|kya karen|next kya|aage kya|what should we do|what next|what should i do|what should victor do)\??$/i.test(value);
  const investigationVerb = /(iska|iske|uska|ye|this|that).{0,35}(pata karo|verify karo|check karo|confirm karo|investigate karo|find out|verify this|check this|investigate this|confirm this)|(pata karo|verify karo|check karo|confirm karo|investigate karo|find out).{0,50}(iska|iske|uska|ye|this|that)/i.test(value);
  const explicitGapReference = looksLikeEvidenceGap(value);
  const previousGap = looksLikeEvidenceGap(previousVictor);

  // A request to investigate a specific unknown/unverified point is new evidence work,
  // not a request to replay the previous task result.
  if (hasTarget && (investigationVerb || explicitGapReference) && (previousGap || explicitGapReference || value.length > 20)) {
    return {
      mode: 'CONTEXTUAL_INVESTIGATION',
      target,
      task_id: taskId,
      parent_task_id: taskId,
      query: String(text || '').trim(),
      reason: 'FOLLOWUP_REQUESTS_NEW_EVIDENCE_ON_ACTIVE_THREAD',
    };
  }

  if (taskStatus && hasTask) {
    return { mode: 'TASK_STATUS_FOLLOWUP', target, task_id: taskId, reason: 'RECENT_TASK_STATUS_REFERENCE' };
  }
  if (nextStepFollowUp && hasTarget) {
    return { mode: 'CONTEXTUAL_NEXT_STEP', target, task_id: taskId, reason: hasTask ? 'NEXT_STEP_BOUND_TO_ACTIVE_TASK' : 'NEXT_STEP_BOUND_TO_ACTIVE_TOPIC' };
  }
  if ((continuation || problemFollowUp) && hasTarget) {
    return { mode: 'CONTEXTUAL_DEPARTMENT_FOLLOWUP', target, task_id: taskId, reason: 'RECENT_DEPARTMENT_CONTEXT' };
  }
  return { mode: null, target: null, task_id: null, reason: 'NO_CONTEXTUAL_FOLLOWUP' };
}

export function buildInvestigationTaskText(followUp = {}, session = {}) {
  const target = String(followUp?.target || session?.last_target || session?.active_target || 'department').toUpperCase();
  const parentTask = followUp?.parent_task_id || session?.last_task_id || session?.active_task_id || 'NONE';
  const founderQuery = String(followUp?.query || session?.last_founder_text || '').trim();
  const previousReply = String(session?.last_victor_reply || '').trim();
  return [
    'VICTOR CONTEXTUAL FOLLOW-UP INVESTIGATION',
    `Department: ${target}`,
    `Parent task: ${parentTask}`,
    `Founder asks: ${founderQuery}`,
    previousReply ? `Previous Victor report: ${previousReply.slice(0, 1800)}` : 'Previous Victor report: unavailable',
    'Instruction: Investigate only the specific follow-up question using fresh evidence. Do not merely repeat the parent task report. If the requested fact is still unverified, identify exactly which source, collector, artifact, permission, or execution step is missing; state the root cause of the evidence gap; and return the concrete next corrective action. Return traceable evidence.',
  ].join('\n');
}

export function formatPendingTaskStatus(session = {}) {
  const target = String(session.last_target || 'department').toUpperCase();
  const taskId = session.last_task_id || 'unknown';
  return `${target} task ${taskId} ka result abhi pending hai. Victor isi task ka fresh revert wait/verify karega; naya duplicate task dispatch nahi karega.`;
}
