import test from 'node:test';
import assert from 'node:assert/strict';
import { routeDeterministically, normalizeSemanticRoute, resolveDepartment } from './single_router.mjs';
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

test('explicit RIO Instagram last-post question is a read-only fact query, not an action', () => {
  const route = routeDeterministically('Rio ne last post instagram par kab kiya tha?');
  assert.equal(route.type, 'FACT_QUERY');
  assert.equal(route.department, 'rio');
  assert.equal(route.action, 'instagram_last_post');
  assert.equal(route.risk, 'GREEN');
});

test('last-post follow-up inherits recent RIO task context', () => {
  const route = routeDeterministically('Last post kab hua tha?', { department: 'rio', type: 'STATUS', action: 'status' });
  assert.equal(route.type, 'FACT_QUERY');
  assert.equal(route.department, 'rio');
  assert.equal(route.action, 'instagram_last_post');
  assert.equal(route.source, 'context-rule');
});

test('last-post text without department context stays chat instead of guessing a department', () => {
  const route = routeDeterministically('Last post kab hua tha?');
  assert.equal(route.type, 'CHAT');
  assert.equal(route.department, null);
});

test('explicit department action routes to the named department', () => {
  const route = routeDeterministically('AURA3 ko task do aur system fix karo');
  assert.equal(route.type, 'ACTION');
  assert.equal(route.department, 'aura3');
  assert.equal(route.risk, 'AMBER');
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

test('procedure registry is the routing authority for status, fact reads and actions', () => {
  const status = resolveProcedureRoute({ type: 'STATUS', department: 'rio', action: 'status', risk: 'GREEN' });
  assert.equal(status.ok, true);
  assert.equal(status.procedure_id, 'founder-status-check-v1');
  assert.equal(status.approval_required, false);

  const fact = resolveProcedureRoute({ type: 'FACT_QUERY', department: 'rio', action: 'instagram_last_post', risk: 'GREEN' });
  assert.equal(fact.ok, true);
  assert.equal(fact.procedure_id, 'founder-status-check-v1');
  assert.equal(fact.approval_required, false);

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
