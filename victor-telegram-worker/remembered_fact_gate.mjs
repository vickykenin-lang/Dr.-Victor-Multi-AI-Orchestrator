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

// Accept a one-character typo in a meaningful Roman-script term, but never
// make fuzzy matching the only evidence: the caller still requires two matches.
function oneEditApart(left, right) {
  if (left === right || left.length < 4 || right.length < 4) return left === right;
  if (Math.abs(left.length - right.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) i += 1;
    else if (right.length > left.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return true;
}

function matchedTerms(queryTerms, answerTerms) {
  return [...queryTerms].filter(term => answerTerms.has(term)
    || [...answerTerms].some(candidate => oneEditApart(term, candidate)));
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
  return /\?|\b(?:what|which|who|when|where|code|detail|value|kya|ka|ki|ke|batao)\b|(?:क्या|कोड|वैलिडेशन|बताओ|विवरण)/i.test(String(query));
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
  const isDirectCandidate = fragment => !fragment.startsWith('{')
    && !fragment.includes('"text":')
    && !/^relevant\b|^related\s+facts\b|^document\s+chunk\b/i.test(fragment)
    && codeValues(fragment).length > 0;
  const direct = fragments.find(fragment => {
    if (!isDirectCandidate(fragment)) return false;
    const fragmentTerms = tokens(fragment);
    const overlap = matchedTerms(queryTerms, fragmentTerms);
    return overlap.length >= 2;
  });
  if (direct) return direct;

  // Some Founder messages use a non-Latin script while the stored entity name is
  // Latin. With no comparable tokens, only use a single unambiguous coded fact.
  if (!queryTerms.size) {
    const candidates = [...new Set(fragments.filter(isDirectCandidate))];
    if (candidates.length === 1) return candidates[0];
  }
  return cleaned;
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

function queryLanguage(query) {
  const text = String(query || '');
  if (/[\u0900-\u097F]/.test(text)) return 'HINDI';
  if (/\b(?:kya|ka|ki|ke|batao|mujhe|chahiye|hai|nahi|yaad|memory)\b/i.test(text)) return 'HINGLISH';
  return 'ENGLISH';
}

// The fact selection stays deterministic, while its short presentation follows
// the Founder's language. It only reformats a parsed subject/property/value
// sentence; unparseable facts are returned verbatim so no details are invented.
export function renderRememberedFactForFounder(query, answer) {
  const text = String(answer || '').trim();
  const match = text.match(/^(.+?)\s+(?:has|have|had)\s+(?:an?\s+)?(.+?)\s+([A-Z]{2,}(?:[-_][A-Z0-9]{2,})+)\.?$/i);
  if (!match) return text;
  const [, subject, property, value] = match;
  const language = queryLanguage(query);
  if (language === 'HINDI') return `${subject} का ${property} ${value} है।`;
  if (language === 'HINGLISH') return `${subject} ka ${property} ${value} hai.`;
  return text;
}

export function selectDirectRememberedFact(query, results = [], sourceRecords = []) {
  if (!asksForFact(query)) return { matched: false, reason: 'NOT_A_FACT_QUESTION' };
  const queryTerms = tokens(query);
  const nonLatinFactQuestion = !queryTerms.size
    && /[^\u0000-\u007F]/.test(String(query))
    && asksForFact(query);
  if (!queryTerms.size && !nonLatinFactQuestion) return { matched: false, reason: 'NO_QUERY_TERMS' };

  const recallResults = Array.isArray(results) ? results : [];
  for (const result of recallResults) {
    const answer = directFactText(recalledText(result), query);
    if (!answer) continue;
    const answerTerms = tokens(answer);
    const overlap = matchedTerms(queryTerms, answerTerms);
    // A direct answer needs at least two meaningful shared terms. This prevents
    // a vaguely related semantic result from being returned as a fact.
    const unambiguousNonLatinFact = nonLatinFactQuestion
      && recallResults.length === 1
      && codeValues(answer).length === 1
      && !/\n/.test(answer);
    if (overlap.length < 2 && !unambiguousNonLatinFact) continue;
    if (hasExplicitCanonicalContradiction(query, answer, sourceRecords)) {
      return { matched: false, reason: 'CANONICAL_CONTRADICTION', answer: null };
    }
    return { matched: true, answer, overlap };
  }
  return { matched: false, reason: 'NO_DIRECT_REMEMBERED_FACT' };
}
