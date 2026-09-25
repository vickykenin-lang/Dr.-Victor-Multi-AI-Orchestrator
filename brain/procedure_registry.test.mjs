import assert from "node:assert/strict";
import test from "node:test";
import {listVerifiedProcedures,buildProcedureExecutionPlan} from "./procedure_registry.mjs";

test("registry exposes two bounded procedures",()=>{assert.equal(listVerifiedProcedures().length,2);});
test("known founder procedure is deterministic and LLM free",()=>{const x=buildProcedureExecutionPlan({procedureId:"founder-status-check-v1",trigger:"founder-command"});assert.equal(x.execution_allowed,true);assert.equal(x.llm_required,false);});
test("unknown procedure fails closed",()=>{const x=buildProcedureExecutionPlan({procedureId:"unknown",trigger:"founder-command"});assert.equal(x.execution_allowed,false);assert.equal(x.reason,"PROCEDURE_NOT_VERIFIED");});
test("scheduler trigger fails closed",()=>{const x=buildProcedureExecutionPlan({procedureId:"safe-stop-v1",trigger:"scheduler"});assert.equal(x.execution_allowed,false);assert.equal(x.reason,"TRIGGER_NOT_ALLOWED");});

test("registry exposes locked lifecycle metadata",()=>{const p=listVerifiedProcedures()[0];assert.equal(p.status,"ACTIVE");assert.equal(p.environment_fingerprint,"victor-endgame-p0-v1");assert.ok(Array.isArray(p.evidence_predicates));});
test("environment mismatch fails closed",()=>assert.equal(buildProcedureExecutionPlan({procedureId:"founder-status-check-v1",trigger:"founder-command",environmentFingerprint:"other"}).reason,"ENVIRONMENT_MISMATCH"));
