import assert from "node:assert/strict";import test from "node:test";
import {resolveDegradedMode} from "./degraded_mode.mjs";
test("LLM offline permits verified LLM-free procedure",()=>{const x=resolveDegradedMode({llmAvailable:false,procedureId:"founder-status-check-v1"});assert.equal(x.mode,"DEGRADED_VERIFIED_PROCEDURE");assert.equal(x.execution_allowed,true);});
test("LLM offline novel action safe holds",()=>{const x=resolveDegradedMode({llmAvailable:false,procedureId:"novel-action"});assert.equal(x.mode,"SAFE_HOLD");assert.equal(x.execution_allowed,false);});
test("scheduler cannot exploit degraded mode",()=>{const x=resolveDegradedMode({llmAvailable:false,procedureId:"safe-stop-v1",trigger:"scheduler"});assert.equal(x.mode,"SAFE_HOLD");assert.equal(x.execution_allowed,false);});
