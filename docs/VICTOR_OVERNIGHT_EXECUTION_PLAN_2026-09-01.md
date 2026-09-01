# Victor Overnight Executive Brain Consolidation Plan

Date: 2026-09-01
Owner: Founder Vicky Gautam
Execution principle: evidence-first, rollback-safe, no unsupported success claims.

## Objective
By the morning of 2026-09-02, prepare Victor for Founder acceptance testing as a natural executive AI rather than a workflow/ticket router. The overnight work must consolidate the current patch-heavy behavior into one coherent execution path without changing the locked Founder authority, hard boundaries, or RIO commercial objective.

## Non-negotiable rules
1. Never claim production/live success without external or repository evidence.
2. Do not expose or rotate secrets.
3. Do not create new credentials unless unavoidable; use the existing single GitHub orchestration-token architecture.
4. Preserve Founder authority and existing rollback points.
5. Do not silently change objective/success criteria.
6. Prefer root-cause fixes over phrase-specific regex patches.
7. Internal activity is not a verified business outcome.
8. Every implementation wave must finish with tests and repository evidence before moving on.

## Truth hierarchy
Use this precedence for current operational facts:
1. externally verified result / platform result
2. current workflow or job evidence
3. fresh department result envelope
4. current canonical state files
5. historical logs / alerts
6. durable memory
7. active conversation context

If two sources conflict, explicitly reconcile freshness and scope rather than choosing the more convenient result.

## Target executive pipeline
UNDERSTAND -> RECALL ACTIVE THREAD -> DECOMPOSE QUESTIONS/ACTIONS -> RETRIEVE FRESH FACTS -> DECIDE -> DELEGATE/EXECUTE -> VERIFY -> ROOT-CAUSE/RECOVER -> REPLAN -> SYNTHESIZE NATURAL ANSWER -> UPDATE MEMORY

## Wave 1 — Architecture cleanup and truth baseline
- Inventory all current Telegram interceptors and remove duplicate/dead routing blocks.
- Build one structured Founder request object: intent, topic, entities, questions[], requested_facts[], requested_actions[], active_thread, evidence_required, success_condition, execution_owner, founder_boundary.
- Lock truth-source precedence in code and tests.
- Ensure explicit current-vs-historical conflict resolution.
- Preserve emergency/security deterministic controls.
- Stop adding sentence-specific regex behavior except hard deterministic commands.

Acceptance:
- multi-part requests retain every sub-question;
- explicit department/topic switching does not carry stale task IDs;
- current state beats historical alert when freshness is proven;
- no duplicate contextual-investigation code paths.

## Wave 2 — Reliable working thread + fresh fact engine
- Replace best-effort Cache API as the sole working-context authority with a durable per-chat state design where available; if runtime binding is not currently available, implement repository-safe abstraction and fail explicitly rather than pretending durability.
- Maintain topic, subtopic, active department, unresolved questions, task lineage, last Founder correction, last verified facts, last answer and next expected result.
- Make concrete fact questions retrieval-first: timestamp, count, latest commit/activity, pause state, workflow result, alert/log, JSON value, publish state.
- Exact fact request must return the fact or the precise reason it cannot be obtained.

Acceptance:
- follow-ups like “kyu?”, “uska status?”, “link?” stay on the same thread;
- multi-part RIO + Tony + AURA3 fact query answers all parts;
- exact timestamp/count requests do not return generic “checking” text.

## Wave 3 — Problem ownership and self-healing
- Treat Founder problem statements as owned outcomes, not information-only requests.
- Diagnose symptom vs root cause.
- If blocker is within existing authority, automatically fix/retry/replan.
- Use Five Whys on repeated failure or repeated same recommendation without new evidence.
- Change department/strategy if the same route does not advance the objective.
- Escalate only credential/account identity, spend ceiling, irreversible commitment, unresolved legal/security, explicit objective change/pause, or verified objective impossibility.
- Distinguish TASK_SENT, WORK_PERFORMED, RESULT_VERIFIED, OBJECTIVE_ACHIEVED.

Acceptance:
- “RIO post kyu nahi kar raha?” leads to evidence collection, internal repair where allowed, retry and publish verification—not just a blocker report;
- no routine Founder approval request;
- repeated failure triggers RCA/replan rather than repeated dispatch.

## Wave 4 — Natural Founder conversation and acceptance tests
- Generate Founder replies from verified facts/decisions, not acknowledgement templates.
- Hide task IDs, schema names, file paths and transport jargon unless Founder asks.
- Direct answer first, then implication/blocker/next action only if useful.
- Preserve uncertainty naturally.
- Add adversarial behavioral tests with unseen phrasings, not only exact known sentences.

Minimum acceptance scenarios:
1. short follow-up continuity
2. pronoun/referent resolution
3. explicit topic switch
4. multi-part question
5. exact timestamp
6. exact count
7. historical-vs-current conflict
8. current Instagram pause state
9. latest repository commit/activity
10. RIO blocker diagnosis
11. automatic internal recovery
12. repeated failure -> Five Whys
13. cross-department handoff
14. Founder correction
15. objective-change request kept distinct from operating preference
16. ready-to-post vs actually published distinction
17. stale result rejection
18. no unnecessary task IDs
19. only genuine Founder-boundary escalation
20. self-assessment matches actual capability evidence

## Overnight iteration protocol
Each scheduled iteration must:
1. Read this plan and current repository state.
2. Determine the highest-priority unfinished acceptance gap.
3. Inspect existing implementation before editing.
4. Implement one coherent root-cause improvement; avoid overlapping patches.
5. Run the relevant unit/regression/syntax tests.
6. Verify GitHub Actions when a workflow is triggered.
7. Commit only evidence-backed safe changes.
8. Update `docs/VICTOR_OVERNIGHT_STATUS_2026-09-02.md` with completed items, commit/run evidence, unresolved blockers, and next priority.
9. Continue automatically unless a genuine Founder-only boundary is reached.
10. Never mark READY_FOR_FOUNDER_TEST until all critical P0 acceptance scenarios pass.

## Morning readiness definition
READY_FOR_FOUNDER_TEST requires:
- core CI green;
- no known duplicate routing blocks;
- structured multi-question decomposition implemented;
- fresh-fact retrieval path implemented and tested;
- current-vs-history truth reconciliation implemented;
- active-thread continuity tests pass;
- owned-problem recovery/self-healing path tested;
- natural result synthesis derives from evidence;
- no unresolved P0 regression documented.

If any of these remain unresolved, morning report must say NOT_READY and identify the exact blockers instead of claiming completion.
