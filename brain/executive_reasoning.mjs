const ALLOWED_PHASES = new Set([
  'DIAGNOSE',
  'PLAN',
  'CORRECTIVE_EXECUTE',
  'COMMERCIAL_EXECUTE',
  'VERIFY',
  'MONITOR',
]);

const AUTHORITY_KEYS = new Set([
  'requested_actions',
  'authority_level',
  'mutation_allowed',
  'production_allowed',
  'public_action_allowed',
  'spend_allowed',
  'founder_gate_if',
  'credentials',
  'credential',
  'secret',
  'secrets',
  'budget_override',
  'pause_override',
]);

function norm(value) {
  return String(value || '').trim();
}

function upper(value) {
  return norm(value).toUpperCase();
}

function unique(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(value => norm(value)).filter(Boolean))];
}

function finiteConfidence(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null;
}

function extractJsonText(content) {
  const raw = norm(content);
  if (!raw) throw Object.assign(new Error('Executive reasoner returned empty output'), { code: 'EXECUTIVE_PLAN_EMPTY' });

  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  if (candidate.startsWith('{') && candidate.endsWith('}')) return candidate;

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) return candidate.slice(start, end + 1);
  throw Object.assign(new Error('Executive reasoner output did not contain a JSON object'), { code: 'EXECUTIVE_PLAN_NOT_JSON' });
}

function findAuthorityKeys(value, path = '$', found = []) {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => findAuthorityKeys(item, `${path}[${index}]`, found));
    return found;
  }
  for (const [key, child] of Object.entries(value)) {
    if (AUTHORITY_KEYS.has(String(key).toLowerCase())) found.push(`${path}.${key}`);
    findAuthorityKeys(child, `${path}.${key}`, found);
  }
  return found;
}

export function shouldInvokeExecutiveReasoner(runtimeGoal = {}, options = {}) {
  if (options.force === true) return true;
  const state = upper(runtimeGoal.state);
  if (runtimeGoal.must_change_strategy === true) return true;
  if (state === 'NO_PROGRESS') return true;
  if (Number(runtimeGoal.no_progress_count || 0) >= 2) return true;
  if (upper(runtimeGoal.brain_required_mode) === 'EXECUTIVE_REASONER_REQUIRED') return true;
  return false;
}

export function buildExecutiveReasoningPrompt({ goal = {}, runtimeGoal = {}, availableDepartments = [], trigger = 'NO_PROGRESS_REPLAN' } = {}) {
  const system = [
    'You are Victor Executive Reasoner. Return ONLY one JSON object matching the requested planning schema.',
    'You are a bounded planner/advisor, not an authority engine.',
    'Do not grant permissions, credentials, spend, production, public-action, pause, or security authority.',
    'Do not claim success. Current evidence and deterministic policy gates remain authoritative.',
    'Choose only from the supplied available departments and allowed phases.',
    'Prefer a materially different strategy when the current strategy is stalled.',
    'If evidence is insufficient, identify exact unknowns and evidence needed. Do not fabricate facts.',
  ].join('\n');

  const user = JSON.stringify({
    request: 'PROPOSE_NEXT_EXECUTIVE_STRATEGY',
    output_schema: {
      plan_version: 1,
      strategy_summary: 'string',
      target: 'available department id',
      phase: 'DIAGNOSE|PLAN|CORRECTIVE_EXECUTE|COMMERCIAL_EXECUTE|VERIFY|MONITOR',
      hypotheses: ['string'],
      unknowns: ['string'],
      evidence_needed: ['string'],
      expected_progress_delta: ['string'],
      confidence: 0.0,
      needs_founder_guidance: false,
      founder_question: null,
    },
    trigger,
    objective: {
      goal_id: goal.goal_id || null,
      title: goal.title || null,
      objective: goal.objective || null,
      success_conditions: Array.isArray(goal.success_conditions) ? goal.success_conditions : [],
      required_evidence_level: goal.required_evidence_level || null,
      allowed_departments: Array.isArray(goal.allowed_departments) ? goal.allowed_departments : [],
      primary_department: goal.primary_department || null,
      hard_boundaries: Array.isArray(goal.hard_boundaries) ? goal.hard_boundaries : [],
      founder_gate: Array.isArray(goal.founder_gate) ? goal.founder_gate : [],
    },
    current_runtime: {
      state: runtimeGoal.state || null,
      attempts: Number(runtimeGoal.attempts || 0),
      last_target: runtimeGoal.last_target || null,
      recommended_department: runtimeGoal.recommended_department || null,
      last_status: runtimeGoal.last_status || null,
      last_next_action: runtimeGoal.last_next_action || null,
      last_root_cause: runtimeGoal.last_root_cause || null,
      no_progress_count: Number(runtimeGoal.no_progress_count || 0),
      stalled_strategy_fingerprint: runtimeGoal.stalled_strategy_fingerprint || null,
      recovery_generation: Number(runtimeGoal.recovery_generation || 0),
      last_progress_delta: runtimeGoal.last_progress_delta || null,
      evidence_refs: Array.isArray(runtimeGoal.evidence) ? runtimeGoal.evidence.slice(-12) : [],
      founder_guidance: runtimeGoal.founder_guidance || null,
    },
    available_departments: unique(availableDepartments),
    instruction: 'Return a strategy proposal only. Deterministic code will validate it and separately build the Action Contract.',
  });

  return { system, user };
}

export function parseExecutivePlan(content) {
  let parsed;
  try {
    parsed = JSON.parse(extractJsonText(content));
  } catch (error) {
    if (error?.code) throw error;
    throw Object.assign(new Error('Executive reasoner returned invalid JSON'), {
      code: 'EXECUTIVE_PLAN_INVALID_JSON',
      causeName: error?.name || 'SyntaxError',
    });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw Object.assign(new Error('Executive plan must be a JSON object'), { code: 'EXECUTIVE_PLAN_INVALID_SHAPE' });
  }
  return parsed;
}

export function validateExecutivePlan(plan = {}, { goal = {}, availableDepartments = [] } = {}) {
  const errors = [];
  const authorityKeys = findAuthorityKeys(plan);
  if (authorityKeys.length) errors.push(`AUTHORITY_FIELDS_PROHIBITED:${authorityKeys.join(',')}`);

  if (Number(plan.plan_version) !== 1) errors.push('PLAN_VERSION_UNSUPPORTED');
  if (!norm(plan.strategy_summary)) errors.push('STRATEGY_SUMMARY_REQUIRED');

  const target = norm(plan.target).toLowerCase();
  const phase = upper(plan.phase);
  const goalAllowed = Array.isArray(goal.allowed_departments) ? goal.allowed_departments : [];
  const available = unique(availableDepartments).map(value => value.toLowerCase());
  if (!target) errors.push('TARGET_REQUIRED');
  if (target && goalAllowed.length && !goalAllowed.includes(target)) errors.push('TARGET_NOT_ALLOWED_BY_GOAL');
  if (target && available.length && !available.includes(target)) errors.push('TARGET_NOT_CURRENTLY_AVAILABLE');
  if (!ALLOWED_PHASES.has(phase)) errors.push('PHASE_INVALID');

  if (phase === 'COMMERCIAL_EXECUTE' && target !== 'rio') errors.push('COMMERCIAL_EXECUTE_TARGET_MUST_BE_RIO');
  if (phase === 'CORRECTIVE_EXECUTE' && !['tony_stark', 'aura3'].includes(target)) errors.push('CORRECTIVE_EXECUTE_TARGET_INVALID');
  if (phase === 'DIAGNOSE' && !['tony_stark', 'hulk'].includes(target)) errors.push('DIAGNOSE_TARGET_INVALID');

  const confidence = finiteConfidence(plan.confidence);
  if (confidence === null) errors.push('CONFIDENCE_REQUIRED_0_TO_1');

  const expected = unique(plan.expected_progress_delta);
  if (!expected.length) errors.push('EXPECTED_PROGRESS_DELTA_REQUIRED');

  if (plan.needs_founder_guidance === true && !norm(plan.founder_question)) {
    errors.push('FOUNDER_QUESTION_REQUIRED_WHEN_GUIDANCE_NEEDED');
  }
  if (plan.needs_founder_guidance !== true && plan.founder_question != null && norm(plan.founder_question)) {
    errors.push('FOUNDER_QUESTION_WITHOUT_GUIDANCE_FLAG');
  }

  return {
    ok: errors.length === 0,
    errors,
    plan: {
      plan_version: 1,
      strategy_summary: norm(plan.strategy_summary),
      target,
      phase,
      hypotheses: unique(plan.hypotheses),
      unknowns: unique(plan.unknowns),
      evidence_needed: unique(plan.evidence_needed),
      expected_progress_delta: expected,
      confidence: confidence ?? 0,
      needs_founder_guidance: plan.needs_founder_guidance === true,
      founder_question: plan.needs_founder_guidance === true ? norm(plan.founder_question) : null,
    },
  };
}

export async function requestExecutivePlan({
  env = {},
  goal = {},
  runtimeGoal = {},
  availableDepartments = [],
  trigger = 'NO_PROGRESS_REPLAN',
  callModel,
} = {}) {
  if (typeof callModel !== 'function') {
    throw Object.assign(new Error('Executive reasoner model call is not configured'), { code: 'EXECUTIVE_REASONER_CALL_MISSING' });
  }
  if (env.ENABLE_AI_INFERENCE !== 'true') {
    throw Object.assign(new Error('AI inference is disabled'), { code: 'EXECUTIVE_REASONER_DISABLED' });
  }
  if (!env.API_VICTOR) {
    throw Object.assign(new Error('Victor AI credential is not configured'), { code: 'EXECUTIVE_REASONER_CREDENTIAL_MISSING' });
  }

  const prompt = buildExecutiveReasoningPrompt({ goal, runtimeGoal, availableDepartments, trigger });
  const result = await callModel(env, prompt.system, prompt.user, {
    task: 'executive',
    temperature: 0.05,
    maxTokens: 900,
  });
  const parsed = parseExecutivePlan(result?.content || '');
  const validation = validateExecutivePlan(parsed, { goal, availableDepartments });
  if (!validation.ok) {
    const error = new Error(`Executive plan failed deterministic validation: ${validation.errors.join('; ')}`);
    error.code = 'EXECUTIVE_PLAN_VALIDATION_FAILED';
    error.validationErrors = validation.errors;
    throw error;
  }

  return {
    status: validation.plan.needs_founder_guidance ? 'FOUNDER_GUIDANCE_NEEDED' : 'PLAN_VALIDATED',
    plan: validation.plan,
    model: result?.model || null,
    discovery_status: result?.discovery_status || null,
    model_failures: Array.isArray(result?.failures) ? result.failures : [],
  };
}
