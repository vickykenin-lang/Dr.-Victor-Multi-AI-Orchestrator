import assert from "node:assert/strict"; import test from "node:test";
function gate(env={}){return env.VICTOR_DEPLOY_GIT_SHA&&(env.VICTOR_BUILD_UUID||env.CF_VERSION_ID)?"IDENTITY_PRESENT_NOT_LIVE_VERIFIED":"IDENTITY_INCOMPLETE";}
test("sha alone never proves deployment identity",()=>assert.equal(gate({VICTOR_DEPLOY_GIT_SHA:"abc"}),"IDENTITY_INCOMPLETE"));
test("sha plus immutable build identity remains not live verified until fresh health receipt",()=>assert.equal(gate({VICTOR_DEPLOY_GIT_SHA:"abc",VICTOR_BUILD_UUID:"build-1"}),"IDENTITY_PRESENT_NOT_LIVE_VERIFIED"));
