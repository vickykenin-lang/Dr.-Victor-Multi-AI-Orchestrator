const ENTITY_PATTERNS = [
  ['rio', /\brio\b|instagram|heartbeat|rio alerts?/i],
  ['aura3', /\baura\s*3\b|\baura3\b|aura-3\.0/i],
  ['tony_stark', /\btony(?:\s+stark)?\b/i],
  ['hulk', /\bhulk\b/i],
];

const FACT_PATTERNS = [
  ['timestamp', /timestamp|time stamp|exact time|last successful/i],
  ['count', /\bcount\b|\bnumber\b|\btotal\b|kitne|how many/i],
  ['commit_activity', /last commit|commit date|activity date|repo.*activity|github.*activity/i],
  ['pause_state', /pause|paused|auto[- ]?publish|enabled|disabled/i],
  ['heartbeat', /heartbeat/i],
  ['publish_state', /instagram|publish|posted|permalink|media id/i],
  ['source_value', /data\/|\.json|exact value|field value/i],
  ['evidence', /evidence|proof|verify|verified|source|ground truth|fresh|actual|concrete|specific/i],
];

const ACTION_PATTERNS = [
  ['diagnose', /diagnos|root cause|kyu|why|kaha atka|blocker|issue/i],
  ['repair', /fix|repair|recover|thik|correct/i],
  ['execute', /execute|run|start|continue|resume|karvao|karo/i],
  ['publish', /publish|post kar|live kar/i],
  ['verify', /verify|check|confirm|evidence|proof/i],
];

function unique(values) { return [...new Set(values.filter(Boolean))]; }

function splitQuestions(text = '') {
  const value = String(text || '').trim();
  if (!value) return [];
  const explicit = value.split(/\?+/).map(x => x.trim()).filter(Boolean);
  if (explicit.length > 1) return explicit;
  // Preserve compound Founder asks so a second department/fact cannot silently disappear.
  return value.split(/\s+(?:and|aur|or saath me|saath me|plus)\s+/i).map(x => x.trim()).filter(Boolean);
}

export function buildFounderRequest(text = '', activeThread = null) {
  const value = String(text || '').trim();
  const entities = unique(ENTITY_PATTERNS.filter(([, rx]) => rx.test(value)).map(([name]) => name));
  const requestedFacts = unique(FACT_PATTERNS.filter(([, rx]) => rx.test(value)).map(([name]) => name));
  const requestedActions = unique(ACTION_PATTERNS.filter(([, rx]) => rx.test(value)).map(([name]) => name));
  const questions = splitQuestions(value);
  const explicitTopic = entities.length ? entities[0] : null;
  const activeTopic = explicitTopic || activeThread?.topic || activeThread?.active_department || null;
  const asksObjectiveChange = /change.*objective|objective.*change|goal.*change|scope.*change/i.test(value);
  const asksPause = /\b(stop|pause|park)\b/i.test(value);
  const evidenceRequired = requestedFacts.length > 0 || /sach batao|real[- ]?time|cached|default response|template/i.test(value);

  return {
    version: 'FOUNDER_REQUEST_V1',
    raw_text: value,
    intent: requestedActions.length ? 'ACTION_OR_DIAGNOSIS' : (evidenceRequired ? 'FACT_QUERY' : 'CONVERSATION'),
    topic: activeTopic,
    entities,
    questions,
    requested_facts: requestedFacts,
    requested_actions: requestedActions,
    active_thread: activeThread || null,
    evidence_required: evidenceRequired,
    success_condition: requestedActions.includes('publish') ? 'EXTERNALLY_VERIFIED_PUBLISH' : (evidenceRequired ? 'EVERY_REQUESTED_FACT_ANSWERED_OR_EXPLICITLY_UNAVAILABLE' : 'FOUNDER_INTENT_SATISFIED'),
    execution_owner: entities.length === 1 ? entities[0] : (entities.length > 1 ? 'victor_cross_department' : 'victor'),
    founder_boundary: asksObjectiveChange || asksPause ? 'EXPLICIT_FOUNDER_DIRECTION' : null,
  };
}

export const TRUTH_SOURCE_PRECEDENCE = Object.freeze([
  'EXTERNAL_PLATFORM_RESULT',
  'CURRENT_WORKFLOW_OR_JOB_EVIDENCE',
  'FRESH_DEPARTMENT_RESULT_ENVELOPE',
  'CURRENT_CANONICAL_STATE',
  'HISTORICAL_LOG_OR_ALERT',
  'DURABLE_MEMORY',
  'ACTIVE_CONVERSATION_CONTEXT',
]);

export function buildTruthResolutionDirective() {
  return [
    'Truth precedence (highest first):',
    ...TRUTH_SOURCE_PRECEDENCE.map((x, i) => `${i + 1}. ${x}`),
    'When sources conflict, compare freshness and scope explicitly. Never let an older alert override a proven current state.',
    'Internal activity is not a verified outcome.',
  ].join('\n');
}
