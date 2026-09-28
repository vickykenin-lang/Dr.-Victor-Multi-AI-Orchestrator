import test from 'node:test';
import assert from 'node:assert/strict';
import { routeDeterministically, normalizeSemanticRoute, resolveDepartment } from './single_router.mjs';
import { getDepartmentFactSource, extractDepartmentFact } from './department_fact_registry.mjs';
import { hasExtendedEvidencePack } from './department_query_runtime.mjs';
import { resolveProcedureRoute, buildProcedureExecutionPlan } from '../brain/procedure_registry.mjs';

test('casual and frustrated Founder messages default to chat and never dispatch', () => {
  for (const text of [
    'Victor, mujhe tumse kuch important kaam hai',
    'Tumare se kuch nhi hoga',
    'Bekar ho tum',
    'Kutte kyu bhig rahe hai raat ko 12 baje',
    'Scripted msg hi kar sakte ho tum bas',
    'Vah kya baat hai, tum bhi haal chal puchte ho?',
    'To ek kaam karo bhag jao yaha se',
  ]) {
    const route = routeDeterministically(text);
    assert.equal(route.type, 'CHAT', text);
    assert.equal(route.department, null, text);
  }
});

test('explicit department status is deterministic and green', () => {
  const route = routeDeterministically('RIO ka status check karo');
  assert.equal(route.type, 'STATUS');
  assert.equal(route.department, 'rio');
  assert.equal(route.risk, 'GREEN');
  assert.equal(route.confidence, 1);
});

test('arbitrary read-only department questions use one generic query route', () => {
  for (const [text, department] of [
    ['Rio ne last post instagram par kab kiya tha?', 'rio'],
    ['Aura 3 ka last post kab hua tha?', 'aura3'],
    ['RIO ki earning kitni hui?', 'rio'],
    ['AURA3 me kya pending hai?', 'aura3'],
    ['Tony Stark ka last result kya tha?', 'tony_stark'],
    ['Hulk ka blocker kya hai?', 'hulk'],
    ['RIO me kitne posts published hain?', 'rio'],
    ['Aura3 ka current target kya hai?', 'aura3'],
  ]) {
    const route = routeDeterministically(text);
    assert.equal(route.type, 'DEPARTMENT_QUERY', text);
    assert.equal(route.department, department, text);
    assert.equal(route.action, 'answer_question', text);
    assert.equal(route.risk, 'GREEN', text);
  }
});

test('read-only follow-up inherits recent department context generically', () => {
  for (const department of ['rio', 'aura3', 'tony_stark', 'hulk']) {
    const route = routeDeterministically('Last result kya tha?', { department, type: 'STATUS', action: 'status' });
    assert.equal(route.type, 'DEPARTMENT_QUERY');
    assert.equal(route.department, department);
    assert.equal(route.action, 'answer_question');
    assert.equal(route.source, 'context-rule');
  }
});

test('read-only question without department context stays chat instead of guessing', () => {
  const route = routeDeterministically('Last post kab hua tha?');
  assert.equal(route.type, 'CHAT');
  assert.equal(route.department, null);
});

test('mutating department instructions remain actions, not read-only queries', () => {
  for (const text of [
    'AURA3 ko post publish karo',
    'RIO ko campaign start karne ko bolo',
    'Tony Stark system fix karo',
  ]) {
    const route = routeDeterministically(text);
    assert.equal(route.type, 'ACTION', text);
  }
});

test('generic department query evidence packs cover Victor, RIO, AURA3 and Tony', () => {
  assert.equal(hasExtendedEvidencePack('victor'), true);
  assert.equal(hasExtendedEvidencePack('rio'), true);
  assert.equal(hasExtendedEvidencePack('aura3'), true);
  assert.equal(hasExtendedEvidencePack('tony_stark'), true);
});

test('legacy exact-fact registry remains available as deterministic evidence utility', () => {
  const rio = getDepartmentFactSource('rio', 'instagram_last_post');
  const aura3 = getDepartmentFactSource('aura3', 'instagram_last_post');
  assert.equal(rio?.parser, 'rio_posted_map');
  assert.equal(aura3?.parser, 'aura_published_map');
  assert.equal(getDepartmentFactSource('tony_stark', 'instagram_last_post'), null);
});

test('department fact parsers select latest verified record deterministically', () => {
  const rioSource = getDepartmentFactSource('rio', 'instagram_last_post');
  const rio = extractDepartmentFact(rioSource, { posted: {
    OLD: { posted_at: '2026-09-01T10:00:00+05:30' },
    NEW: { posted_at: '2026-09-27T18:47:00+05:30', permalink: 'https://example.test/new' },
  } });
  assert.equal(rio.record_id, 'NEW');

  const auraSource = getDepartmentFactSource('aura3', 'instagram_last_post');
  const aura = extractDepartmentFact(auraSource, {
    one: { instagram: { at: '2026-09-02T11:28:54+0000', url: 'https://example.test/aura' }, source: 'published' },
  });
  assert.equal(aura.record_id, 'one');
  assert.equal(aura.timestamp, '2026-09-02T11:28:54+0000');
});

test('sensitive action requires red routing', () => {
  const route = routeDeterministically('Tony Stark production deploy kar do');
  assert.equal(route.type, 'ACTION');
  assert.equal(route.department, 'tony_stark');
  assert.equal(route.risk, 'RED');
});

test('reminder intent is recognized without department routing', () => {
  const route = routeDeterministically('Kal subah 7 baje remind kar dena');
  assert.equal(route.type, 'REMINDER');
  assert.equal(route.department, null);
});

test('bare AURA means AURA3 while explicit AURA2 wins', () => {
  assert.equal(resolveDepartment('AURA ka status'), 'aura3');
  assert.equal(resolveDepartment('AURA2 ka status'), 'aura2');
});

test('semantic fallback cannot dispatch below high confidence', () => {
  const route = normalizeSemanticRoute({ type: 'ACTION', department: 'rio', action: 'run', risk: 'AMBER', confidence: 0.7 });
  assert.equal(route.type, 'CHAT');
  assert.equal(route.source, 'semantic-low-confidence');
});

test('procedure registry remains authority for status, fact reads and actions', () => {
  const status = resolveProcedureRoute({ type: 'STATUS', department: 'rio', action: 'status', risk: 'GREEN' });
  assert.equal(status.ok, true);
  assert.equal(status.procedure_id, 'founder-status-check-v1');
  assert.equal(status.approval_required, false);

  const fact = resolveProcedureRoute({ type: 'FACT_QUERY', department: 'aura3', action: 'instagram_last_post', risk: 'GREEN' });
  assert.equal(fact.ok, true);
  assert.equal(fact.procedure_id, 'founder-status-check-v1');

  const action = resolveProcedureRoute({ type: 'ACTION', department: 'aura3', action: 'department_action', risk: 'AMBER' });
  assert.equal(action.procedure_id, 'department-action-v1');

  const red = resolveProcedureRoute({ type: 'ACTION', department: 'tony_stark', action: 'sensitive_action', risk: 'RED' });
  assert.equal(red.procedure_id, 'sensitive-action-v1');
  assert.equal(red.approval_required, true);
});

test('verified procedure execution remains bounded by trigger', () => {
  const allowed = buildProcedureExecutionPlan({ procedureId: 'department-action-v1', trigger: 'founder-command' });
  assert.equal(allowed.execution_allowed, true);
  const denied = buildProcedureExecutionPlan({ procedureId: 'sensitive-action-v1', trigger: 'founder-command' });
  assert.equal(denied.execution_allowed, false);
  assert.equal(denied.reason, 'TRIGGER_NOT_ALLOWED');
});
