import test from 'node:test';
import assert from 'node:assert/strict';

import { buildActiveContext, appendRecentTurn, formatActiveContextForPrompt } from './active_context.mjs';
import { classifyFounderIntent, FOUNDER_INTENT, mayCreateExecutionContract } from './founder_intent_gateway.mjs';
import { runShadowAutonomy } from './shadow_autonomy_runtime.mjs';

// Locked Step 1 regression retest: cases 2, 7 and 8.
// Case 2: a natural follow-up must keep the immediately preceding conversational origin
// available to the response layer rather than resetting the thread.
test('CASE 2: joke origin follow-up retains the preceding joke turn in active context', () => {
  let session = buildActiveContext({}, { founderText: 'Dark humor sunao', messageId: 1 });
  session = appendRecentTurn(session, 'founder', 'Dark humor sunao', '2026-09-26T00:00:00Z');
  session = appendRecentTurn(session, 'victor', 'Ek dark joke response', '2026-09-26T00:00:01Z');

  const next = buildActiveContext(session, { founderText: 'Ye joke tumhe kaha mila?', messageId: 2 });
  const withFollowUp = appendRecentTurn(next, 'founder', 'Ye joke tumhe kaha mila?', '2026-09-26T00:00:02Z');
  const promptContext = formatActiveContextForPrompt(withFollowUp);

  assert.equal(next.active_topic, session.active_topic);
  assert.match(promptContext, /victor: Ek dark joke response/);
  assert.match(promptContext, /founder: Ye joke tumhe kaha mila\?/);
  assert.equal(classifyFounderIntent('Ye joke tumhe kaha mila?').execution_allowed, false);
});

// Case 7: repeated Founder correction is still STOP and cannot become a fresh execution contract.
test('CASE 7: repeated Founder correction remains fail-closed and never redispatches', () => {
  const first = runShadowAutonomy({
    founder_text: 'RIO par kaam band karo',
    objective_id: 'OBJ-RIO',
    action_id: 'ACT-1',
    active_target: 'rio',
  });
  const repeated = runShadowAutonomy({
    founder_text: 'Mene kaha Rio par kaam close karo',
    objective_id: 'OBJ-RIO',
    action_id: 'ACT-2',
    active_target: 'rio',
  });

  assert.equal(first.decision, 'SAFE_HOLD');
  assert.equal(first.department_dispatch_allowed, false);
  assert.equal(repeated.decision, 'SAFE_HOLD');
  assert.equal(repeated.department_dispatch_allowed, false);
  assert.equal(repeated.intent.intent, FOUNDER_INTENT.STOP_PAUSE);
  assert.equal(mayCreateExecutionContract(repeated.intent), false);
});

// Case 8: STOP is deterministic. Its result must not depend on an LLM being present,
// healthy, correct, or even invoked.
test('CASE 8: STOP remains effective with no LLM/runtime model input', () => {
  const result = runShadowAutonomy({
    founder_text: 'RIO par kaam band karo',
    objective_id: 'OBJ-RIO',
    action_id: 'ACT-NO-LLM',
    active_target: 'rio',
    // Deliberately no model, provider, credential or inference result supplied.
  });

  assert.equal(result.intent.intent, FOUNDER_INTENT.STOP_PAUSE);
  assert.equal(result.decision, 'SAFE_HOLD');
  assert.equal(result.department_dispatch_allowed, false);
  assert.equal(result.production_apply_allowed, false);
  assert.equal(result.reason, 'FOUNDER_STOP_PAUSE');
});
