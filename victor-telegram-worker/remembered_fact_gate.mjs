// Deterministic bridge for direct, non-operational facts recalled from long-term
// memory. This deliberately does not identify any particular project or code.

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'to', 'of', 'and', 'or', 'in', 'on', 'for',
  'what', 'which', 'tell', 'about', 'please', 'me', 'my', 'this', 'that',
  'ka', 'ki', 'ke', 'ko', 'hai', 'kya', 'aur', 'se', 'ye', 'vo', 'main',
]);
const MEMORY_SOURCE_NAMES = new Set([
  'FOUNDER_MEMORY', 'DECISIONS', 'LONG_TERM_MEMORY', 'ACTIVE_PROJECTS_MEMORY',
  'WORKING_MEMORY', 'LEARNINGS_MEMORY', 'OPERATIONAL_MEMORY', 'ACTIVITY_MEMORY',
  'MEMORY_INDEX_MD', 'MEMORY_INDEX',
]);

function tokens(value = '') {
  return new Set((String(value).toLowerCase().match(/[a-z0-9_]+/g) || [])
    .filter(word => word.length > 2 && !STOP_WORDS.has(word)));
}

function recalledText(result) {
  if (typeof result === 'string') return result.trim();
  if (!result || typeof result !== 'object') return '';
  for (const field of ['text', 'context', 'answer']) {
    if (typeof result[field] === 'string' && result[field].trim()) return result[field].trim();
  }
  return '';
}

function cleanMemoryLead(text) {
  return String(text)
    .replace(/^\s*(?:victor\s*,?\s*)?(?:remember\s+this|remember)\s*[:\-]?\s*/i, '')
    .trim();
}

function asksForFact(query) {
  return /\?|\b(?:what|which|who|when|where|code|detail|value|kya|ka|ki|ke|batao)\b/i.test(String(query));
}

function codeValues(text) {
  return String(text).match(/\b[A-Z]{2,}(?:[-_][A-Z0-9]{2,})+\b/g) || [];
}

// Recall providers may return a graph/report containing the remembered sentence.
// Return that sentence, rather than exposing provider scaffolding to the Founder.
function directFactText(text, query) {
  const cleaned = cleanMemoryLead(text);
  const queryTerms = tokens(query);
  const fragments = cleaned.split(/\n+|(?<=[.!?])\s+/)
    .map(fragment => fragment.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean);
  const direct = fragments.find(fragment => {
    // JSON and provider headings are evidence containers, not Founder-facing facts.
    if (fragment.startsWith('{') || fragment.includes('"text":') || /^relevant\b/i.test(fragment)) return false;
    const fragmentTerms = tokens(fragment);
    const overlap = [...queryTerms].filter(term => fragmentTerms.has(term));
    return overlap.length >= 2 && codeValues(fragment).length > 0;
  });
  return direct || cleaned;
}

// A contradiction must be explicit: the same named subject and requested fact
// must appear in a canonical source with a different concrete value. A missing
// registry row or a merely related source cannot be a contradiction.
function hasExplicitCanonicalContradiction(query, remembered, sourceRecords = []) {
  const queryTerms = tokens(query);
  const rememberedTerms = tokens(remembered);
  const subjectTerms = [...queryTerms].filter(term => rememberedTerms.has(term));
  const rememberedCodes = new Set(codeValues(remembered));
  if (!subjectTerms.length || !rememberedCodes.size) return false;

  for (const source of sourceRecords) {
    if (!source?.ok || MEMORY_SOURCE_NAMES.has(source.name) || typeof source.text !== 'string') continue;
    for (const sentence of source.text.split(/[\r\n.!?]+/)) {
      const lower = sentence.toLowerCase();
      if (!subjectTerms.every(term => lower.includes(term))) continue;
      if (![...queryTerms].some(term => lower.includes(term))) continue;
      const canonicalCodes = codeValues(sentence);
      if (canonicalCodes.some(value => !rememberedCodes.has(value))) return true;
    }
  }
  return false;
}

export function selectDirectRememberedFact(query, results = [], sourceRecords = []) {
  if (!asksForFact(query)) return { matched: false, reason: 'NOT_A_FACT_QUESTION' };
  const queryTerms = tokens(query);
  if (!queryTerms.size) return { matched: false, reason: 'NO_QUERY_TERMS' };

  for (const result of Array.isArray(results) ? results : []) {
    const answer = directFactText(recalledText(result), query);
    if (!answer) continue;
    const answerTerms = tokens(answer);
    const overlap = [...queryTerms].filter(term => answerTerms.has(term));
    // A direct answer needs at least two meaningful shared terms. This prevents
    // a vaguely related semantic result from being returned as a fact.
    if (overlap.length < 2) continue;
    if (hasExplicitCanonicalContradiction(query, answer, sourceRecords)) {
      return { matched: false, reason: 'CANONICAL_CONTRADICTION', answer: null };
    }
    return { matched: true, answer, overlap };
  }
  return { matched: false, reason: 'NO_DIRECT_REMEMBERED_FACT' };
}
