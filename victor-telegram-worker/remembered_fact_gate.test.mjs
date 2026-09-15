import test from 'node:test';
import assert from 'node:assert/strict';
import { selectDirectRememberedFact, renderRememberedFactForFounder } from './remembered_fact_gate.mjs';

test('returns a direct long-term-memory fact when canonical sources are silent', () => {
  const result = selectDirectRememberedFact(
    'Comet ka validation code kya hai?',
    [{ text: 'Project Comet validation code is CM-914-QZ.' }],
    [{ name: 'DEPARTMENT_REGISTRY', ok: true, text: 'Registered departments: RIO, AURA3.' }],
  );
  assert.equal(result.matched, true);
  assert.equal(result.answer, 'Project Comet validation code is CM-914-QZ.');
});

test('does not return remembered fact when canonical source explicitly gives a different value', () => {
  const result = selectDirectRememberedFact(
    'Comet ka validation code kya hai?',
    [{ text: 'Project Comet validation code is CM-914-QZ.' }],
    [{ name: 'MASTER_RULE_BOOK', ok: true, text: 'Project Comet validation code is CM-111-AX.' }],
  );
  assert.equal(result.matched, false);
  assert.equal(result.reason, 'CANONICAL_CONTRADICTION');
});

test('does not turn a loosely related semantic result into a direct answer', () => {
  const result = selectDirectRememberedFact(
    'Comet ka validation code kya hai?',
    [{ text: 'The validation process requires two approvers.' }],
    [],
  );
  assert.equal(result.matched, false);
});


test('extracts the direct fact from a structured Cognee graph response', () => {
  const result = selectDirectRememberedFact(
    'Comet ka validation code kya hai?',
    [{ text: 'Relevant passages\n{"source":"memory"}\nRelevant entities\n- Project Comet has validation code CM-914-QZ.\nRelated facts\n- A related note exists.' }],
    [],
  );
  assert.equal(result.matched, true);
  assert.equal(result.answer, 'Project Comet has validation code CM-914-QZ.');
});


test('does not return a JSON evidence container when it embeds the remembered code', () => {
  const result = selectDirectRememberedFact(
    'Comet ka validation code kya hai?',
    [{ text: '{"text":"Project Comet validation code is CM-914-QZ."}\n- Project Comet has validation code CM-914-QZ.' }],
    [],
  );
  assert.equal(result.matched, true);
  assert.equal(result.answer, 'Project Comet has validation code CM-914-QZ.');
});


test('renders a parsed remembered fact in Hinglish when the Founder uses Hinglish', () => {
  const reply = renderRememberedFactForFounder(
    'Comet ka validation code batao.',
    'Project Comet has validation code CM-914-QZ.',
  );
  assert.equal(reply, 'Project Comet ka validation code CM-914-QZ hai.');
});

test('renders a parsed remembered fact in Hindi when the Founder uses Devanagari', () => {
  const reply = renderRememberedFactForFounder(
    'कॉमेट का वैलिडेशन कोड क्या है?',
    'Project Comet has validation code CM-914-QZ.',
  );
  assert.equal(reply, 'Project Comet का validation code CM-914-QZ है।');
});

test('does not invent a localized structure for an unparseable remembered fact', () => {
  const fact = 'The Comet rollout needs two approvers.';
  assert.equal(renderRememberedFactForFounder('Comet ke baare mein batao.', fact), fact);
});
