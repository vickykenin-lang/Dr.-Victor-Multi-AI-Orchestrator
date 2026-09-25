import assert from "node:assert/strict";import test from "node:test";
import {makeTelemetryEvent,classifyTelemetryFreshness,telemetrySnapshot} from "./truthful_telemetry.mjs";
const e=makeTelemetryEvent({eventId:"e1",type:"progress.material",timestampUtc:"2026-09-25T06:00:00Z",source:"victor-runtime",status:"VERIFIED",evidenceRefs:["receipt:1"]});
test("fresh bounded event is LIVE",()=>{assert.equal(classifyTelemetryFreshness(e,{nowUtc:"2026-09-25T06:01:00Z"}).surface,"LIVE");});
test("old persisted event is HISTORY not LIVE",()=>{assert.equal(classifyTelemetryFreshness(e,{nowUtc:"2026-09-25T07:00:00Z"}).surface,"HISTORY");});
test("snapshot never promotes history to live",()=>{const s=telemetrySnapshot([e],{nowUtc:"2026-09-25T07:00:00Z"});assert.equal(s.live.length,0);assert.equal(s.history.length,1);});
test("unknown event type fails closed",()=>{assert.throws(()=>makeTelemetryEvent({eventId:"x",type:"made.up",source:"x"}));});
