import { buildFounderRequest } from './founder_request.mjs';
import { classifyFactRequest } from './fact_runtime.mjs';
import { buildExecutionPlan } from './execution_plan.mjs';

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

export function buildRuntimeFounderRequest(text = '', session = {}) {
  const activeThread = {
    topic: session?.active_topic || session?.last_target || null,
    active_department: session?.last_target || null,
    task_id: session?.last_task_id || null,
    parent_task_id: session?.parent_task_id || null,
    unresolved_question: session?.unresolved_question || null,
  };
  const baseRequest = buildFounderRequest(text, activeThread);
  const explicitEntities = Array.isArray(baseRequest.entities) ? baseRequest.entities : [];
  const priorTarget = session?.last_target || null;
  const explicitPrimary = explicitEntities[0] || null;
  const topicSwitched = Boolean(explicitPrimary && priorTarget && explicitPrimary !== priorTarget);
  const request = {
    ...baseRequest,
    runtime: {
      explicit_primary_target: explicitPrimary,
      prior_target: priorTarget,
      topic_switched: topicSwitched,
      clear_stale_task_lineage: topicSwitched,
    },
  };
  return {
    ...request,
    execution_plan: buildExecutionPlan(request),
  };
}

export function buildSessionPatchForRequest(request = {}) {
  const explicitPrimary = request?.runtime?.explicit_primary_target || null;
  const patch = {
    active_topic: request?.topic || explicitPrimary || null,
    last_founder_request: {
      version: request?.version || 'FOUNDER_REQUEST_V1',
      intent: request?.intent || 'CONVERSATION',
      topic: request?.topic || null,
      entities: unique(request?.entities || []),
      questions: request?.questions || [],
      requested_facts: unique(request?.requested_facts || []),
      requested_actions: unique(request?.requested_actions || []),
      evidence_required: request?.evidence_required === true,
      success_condition: request?.success_condition || null,
      execution_plan: request?.execution_plan || null,
    },
  };

  if (request?.runtime?.clear_stale_task_lineage) {
    Object.assign(patch, {
      last_target: explicitPrimary,
      last_task_id: null,
      parent_task_id: null,
      last_task_type: null,
      task_state: 'TOPIC_SWITCHED_NO_ACTIVE_TASK',
      unresolved_question: null,
      active_issue: null,
    });
  }
  return patch;
}

export function buildFactRequestFromFounderRequest(request = {}, rawText = '') {
  const legacy = classifyFactRequest(rawText);
  const structuredFacts = new Set(request?.requested_facts || []);
  const structuredTargets = request?.entities || [];
  const evidenceRequired = request?.evidence_required === true || structuredFacts.size > 0;

  return {
    ...legacy,
    matched: evidenceRequired || legacy.matched,
    targets: unique([...structuredTargets.filter(x => ['rio', 'aura3', 'tony_stark'].includes(x)), ...(legacy.targets || [])]),
    asksHeartbeat: structuredFacts.has('heartbeat') || legacy.asksHeartbeat,
    asksPause: structuredFacts.has('pause_state') || legacy.asksPause,
    asksCommit: structuredFacts.has('commit_activity') || legacy.asksCommit,
    asksCounts: structuredFacts.has('count') || legacy.asksCounts,
    asksCachedTruth: legacy.asksCachedTruth || /cached|default response|template|real[- ]?time|sach batao/i.test(String(rawText || '')),
    questions: request?.questions || [],
    success_condition: request?.success_condition || null,
  };
}

export function shouldUseFactGateway(request = {}, factRequest = {}) {
  return request?.evidence_required === true || (request?.requested_facts || []).length > 0 || factRequest?.matched === true;
}
