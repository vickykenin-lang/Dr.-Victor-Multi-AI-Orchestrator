# VICTOR LLM-FIRST + CAPABILITY ACQUISITION ARCHITECTURE LOCK

Date: 2026-09-28
Founder: Vicky Gautam
Status: LOCKED FOR IMPLEMENTATION

## Core objective
Victor must understand the Founder naturally, choose or acquire the capabilities required to complete work, safely execute through governed boundaries, and report only verified outcomes.

> LLM is the brain. Agents are specialists. Tools are hands. Memory is context. Evidence is truth. Governance is the brake, not the steering wheel.

> Kaam hona chahiye. If the current system cannot complete the work, Victor must identify the capability gap, find an executable solution, safely adopt or build the missing capability where possible, test it in sandbox/staging, then continue execution. Victor must never falsely claim completion.

## Target runtime

```text
FOUNDER
  -> Telegram ingress
     - Founder auth
     - update_id dedupe
     - enqueue
     - immediate HTTP ack
  -> Queue
  -> normalize/context
  -> VICTOR LLM CORE
     - understand meaning and context
     - direct answer when no tool is needed
     - select capability/department/agent when needed
     - plan simple or multi-agent execution
     - identify capability gaps
       -> CAPABILITY ACQUISITION ENGINE
          - search existing capabilities
          - discover external service/API/plugin/tool
          - select alternate provider/path
          - build adapter or specialist agent
          - sandbox/staging test
          - register reusable capability after verification
     -> RISK/AUTHORIZATION BOUNDARY
        - read-only: allow
        - GREEN: bounded allow
        - AMBER: governed policy
        - RED: Founder approval
     -> TOOL / AGENT / DEPARTMENT EXECUTION
     -> RESULT + EVIDENCE
     -> VICTOR LLM FINAL SYNTHESIS
  -> Telegram reply
```

## LLM authority
The LLM is the primary semantic and planning authority. It may understand conversation, choose tools and agents, plan work, query memory/evidence when needed, identify capability gaps, research alternate paths, build bounded adapters/agents/sandbox workflows, replan after failures, and synthesize the final answer.

The LLM cannot create its own external authority. It cannot independently grant credentials, spend money, weaken security, expand permissions, perform destructive RED actions, or upgrade unverified work to completed.

## Conversation-first rule
Normal conversation and general questions must not be forced through department/evidence/Cognee/procedure/action pipelines.

Examples:
- `Hi` -> direct LLM conversation.
- `Aaj kya date hai?` -> direct current-time answer; no department evidence.
- humour/frustration/dismissive speech -> conversation unless a real action is clearly requested.

Governance applies at the action boundary, not to every sentence.

## Capability Registry
Capabilities can include GitHub, Cloudflare, web/research, files/data, Cognee/memory, RIO, AURA3, Tony Stark, HULK, Dev, Infra, Research, Ops, QA, image generation, video generation, audio/voice, browser/external services, plugins/connectors/APIs, and future capabilities.

Each capability should declare where applicable: capability_id, description, provider/owner, input/output contract, read/write class, risk, credentials, spend requirement, health check, sandbox/staging support, rollback, and verification method.

New departments/tools should be added through registry/configuration rather than new global message classifiers.

## Capability Acquisition Engine
When no current capability can complete a task:

```text
TASK
 -> capability lookup
 -> no adequate match
 -> capability gap analysis
 -> alternate current path?
 -> discover external provider/API/plugin/tool
 -> or build adapter/specialist agent
 -> sandbox/staging
 -> test
 -> failed? diagnose + alternate + retry
 -> verified? register capability
 -> authorization boundary if required
 -> execute original task
```

Valid acquisition paths include alternate existing tools, plugins/connectors, APIs, external-service/browser workflows, specialist agents, generated adapters, temporary sandbox tooling, or a new repo/service when the task requires it.

## Representative use cases
- Image generation: choose image capability; if unavailable, discover/connect/adopt/build one, test, then generate.
- Reel/video: decompose into script, assets, video, voice/audio, captions/editing, QA; acquire missing capability instead of static failure.
- 30-minute movie: dynamic Writer/Director/Visual/Video/Audio/Continuity/QA capabilities with continuity and asset verification.
- New business idea: move from research through economics, brand/assets, systems/repo/store, channels, content, operations and launch readiness, subject to external authorization/spend boundaries.
- New repo: architecture, repo creation, bootstrap, CI/CD, tests, security baseline and deployment when permissions allow.
- External tools: discover/adopt plugins/connectors/APIs or build adapters; ask Founder only when external account authorization, paid spend, credentials or irreversible decisions are genuinely required.

## Multi-agent policy
Multi-agent execution is optional and selected by the LLM only when useful.

Simple task:
`LLM -> one capability -> result -> LLM reply`

Complex task:
`LLM -> plan -> selected Dev/Infra/Research/Ops/QA specialists -> results -> LLM synthesis -> next action`

Do not fan every task to every agent.

## Procedure Registry role
Procedure Registry remains as an execution playbook, not the conversational brain:
`LLM selects capability/action -> Procedure Registry provides verified execution steps and constraints.`

## Memory and learning
Cognee and Experience Ledger are advisory context systems. Memory is queried when useful, not injected into every message. Historical tool/status output must not become uncontrolled conversational truth. Learning may record observations and propose improvements but may not auto-rewrite authority, prompts, procedures or production runtime.

## Evidence and truthful completion
Evidence is required for system state, execution state, deployment state, department state, revenue and external outcomes. Victor must distinguish requested, planned, dispatched, running, result received, verified and completed.

## Courtesy response
If work crosses the configured latency threshold, send one deduplicated courtesy message such as:
`Iske answer me thoda time lagega, main check kar raha hoon.`
Then continue and send the final result.

## Deterministic boundaries retained
Outside LLM self-authorization:
- Founder authentication
- ingress validation and idempotency
- STOP/PAUSE
- secret handling
- spend/payment authority
- destructive/delete actions
- security weakening
- authority expansion
- RED production operations requiring Founder approval
- evidence-based completion truth

## Legacy cleanup
No big-bang delete.
1. Add LLM-first decision path and capability registry/acquisition engine.
2. Route normal conversation through LLM-first path.
3. Keep old routing/classifier components isolated as rollback-only.
4. Regression-test real Founder transcripts.
5. Cut over after acceptance.
6. Deprecate/remove obsolete classifiers and one-off patches only after verified replacement.

## Preserve
Queue/KV, Founder auth, Telegram ingress, Cloudflare deploy, GitHub integration, Cognee, Experience Ledger, Procedure Registry, RIO/AURA3/Tony/HULK bridges, Action Contract, Capability Broker, sandbox, watchdog/resource budgets, rollback, evidence ladder/truth receipts, revenue verification, CI/CD and deployment identity.

## Acceptance criteria
1. Ordinary chat/general questions reach LLM directly without department/evidence contamination.
2. LLM can select an existing capability.
3. LLM can identify a missing capability and return a structured acquisition plan.
4. Safe acquisition can be sandboxed/tested without weakening security.
5. Registered capabilities are reusable without new global classifiers.
6. RED actions remain Founder-gated.
7. Long-running work sends at most one courtesy message before final result.
8. Evidence-backed tasks preserve task-state truth.
9. Legacy path stays available for rollback until acceptance completes.
10. No false completion, false revenue or fabricated execution.

## Locked implementation sequence
Phase 1: LLM-first decision contract + capability registry + capability-gap engine in non-destructive mode.
Phase 2: capability discovery/adoption workflow + sandbox verification contract.
Phase 3: specialist capability selection and multi-agent planner.
Phase 4: conversation-path cutover; legacy classifiers isolated from normal chat.
Phase 5: real Founder acceptance tests and telemetry verification.
Phase 6: deprecate/remove obsolete routing layers only after verified replacement.

This is the canonical architecture lock for the next Victor runtime evolution. It does not authorize secret rotation, external spend, destructive actions, security weakening or unrestricted production autonomy.