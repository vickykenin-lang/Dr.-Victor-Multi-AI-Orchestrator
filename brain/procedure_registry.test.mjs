import assert from "node:assert/strict";
import test from "node:test";
import {listVerifiedProcedures,buildProcedureExecutionPlan,resolveProcedureRoute} from "./procedure_registry.mjs";

test("registry exposes the four bounded runtime procedures",()=>{
 const procedures=listVerifiedProcedures();
 assert.equal(procedures.length,4);
 assert.deepEqual(new Set(procedures.map(p=>p.id)),new Set([
  "founder-status-check-v1","safe-stop-v1","department-action-v1","sensitive-action-v1"
 ]));
});
test("known founder procedure is deterministic and LLM free",()=>{const x=buildProcedureExecutionPlan({procedureId:"founder-status-check-v1",trigger:"founder-command"});assert.equal(x.execution_allowed,true);assert.equal(x.llm_required,false);});
test("department action is Founder-command bounded",()=>{const x=buildProcedureExecutionPlan({procedureId:"department-action-v1",trigger:"founder-command"});assert.equal(x.execution_allowed,true);assert.equal(x.procedure.risk_class,"GOVERNED_REVERSIBLE");});
test("sensitive action cannot execute on ordinary founder-command trigger",()=>{const x=buildProcedureExecutionPlan({procedureId:"sensitive-action-v1",trigger:"founder-command"});assert.equal(x.execution_allowed,false);assert.equal(x.reason,"TRIGGER_NOT_ALLOWED");});
test("sensitive action permits only explicit approved trigger",()=>{const x=buildProcedureExecutionPlan({procedureId:"sensitive-action-v1",trigger:"founder-approved-command"});assert.equal(x.execution_allowed,true);assert.equal(x.procedure.risk_class,"RED");});
test("routing metadata makes RED approval explicit",()=>{const x=resolveProcedureRoute({type:"ACTION",department:"tony_stark",action:"sensitive_action",risk:"RED"});assert.equal(x.ok,true);assert.equal(x.procedure_id,"sensitive-action-v1");assert.equal(x.approval_required,true);});
test("unknown procedure fails closed",()=>{const x=buildProcedureExecutionPlan({procedureId:"unknown",trigger:"founder-command"});assert.equal(x.execution_allowed,false);assert.equal(x.reason,"PROCEDURE_NOT_VERIFIED");});
test("scheduler trigger fails closed",()=>{const x=buildProcedureExecutionPlan({procedureId:"safe-stop-v1",trigger:"scheduler"});assert.equal(x.execution_allowed,false);assert.equal(x.reason,"TRIGGER_NOT_ALLOWED");});

test("registry exposes locked lifecycle metadata",()=>{const p=listVerifiedProcedures()[0];assert.equal(p.status,"ACTIVE");assert.equal(p.environment_fingerprint,"victor-endgame-p0-v1");assert.ok(Array.isArray(p.evidence_predicates));});
test("environment mismatch fails closed",()=>assert.equal(buildProcedureExecutionPlan({procedureId:"founder-status-check-v1",trigger:"founder-command",environmentFingerprint:"other"}).reason,"ENVIRONMENT_MISMATCH"));
