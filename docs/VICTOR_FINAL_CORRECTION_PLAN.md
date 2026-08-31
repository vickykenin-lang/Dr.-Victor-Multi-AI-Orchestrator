# Victor Final Correction Plan

Status: LOCKED_BASELINE
Authority: Founder
Purpose: Replace ad-hoc bug patching with a finite, testable correction program.

## Operating rule

No item is considered complete because code changed. Closure requires, in order:
1. source implemented,
2. automated test passed,
3. workflow/runtime integration passed,
4. live Telegram/runtime behavior verified when applicable,
5. business outcome verified separately where applicable.

## Final implementation modules

### P0 — Correct understanding and truthful replies

1. **Founder Intent Resolver**
   - Separate CHAT, CLARIFICATION, DEPARTMENT_STATUS, DEPARTMENT_ACTION, EXECUTIVE_GOAL, FOUNDER_DECISION, POLICY_UPDATE, OBJECTIVE_CHANGE, MEMORY, EMERGENCY.
   - A clarification or correction must not accidentally execute the scheduler.

2. **Conversation State Resolver**
   - Bind current message to reply-to context, previous Founder message, Victor's previous answer, active task and active topic.
   - Short messages such as `??`, `continue`, `ye kya hai`, `isko karo` must resolve from context before generic chat fallback.

3. **Founder Decision Binder**
   - Detect when a Founder statement changes priority, rule, KPI, objective or execution preference.
   - Identify affected canonical record, persist the decision, mark superseded instructions and confirm what changed.

4. **Goal / Founder Intent Reconciliation**
   - Active goal may not silently contradict the latest binding Founder instruction.
   - Clarification, priority shift, KPI change and objective replacement are distinct operations.

5. **Manual Executive Trigger**
   - Founder-triggered executive cycles use a dedicated trigger, not cron-only scheduler semantics.
   - `founder-command` must never return `IGNORED_UNKNOWN_CRON`.

6. **Evidence-First Fact Resolver**
   - Current-state questions fetch canonical department state at request time.
   - Distinguish current state, historical state, external proof and generated inference.

7. **Truth Semantics / Status Ontology**
   - READY, DEPLOYMENT_READY, READY_TO_POST, PUBLISHED, VERIFIED, GOAL_PROGRESS_VERIFIED and GOAL_ACHIEVED_VERIFIED remain distinct.
   - Absence of evidence is never converted into evidence of absence.

8. **Dynamic Capability Inspector**
   - Victor self-assessment is generated from live registry, bindings, bridge health, memory configuration and runtime probes.
   - No generic claims such as `all departments coordinated`, `no API calls`, `no credential access`, or `no context resets` unless evidence supports them.

### P1 — Executive behavior and recovery

9. **Executive Planner & Task Contract Generator**
   - Understand → assess → plan → decompose → assign.
   - Every task has objective, owner, deliverable, authority, evidence, exit criteria and next handoff.

10. **Capability-Based Department Router**
    - Route by capability and verified reliability, not keyword ownership alone.
    - Preserve primary business ownership during cross-department support.

11. **Recovery Manager**
    - Dispatch failure is not a dead end.
    - Diagnose → bridge health → root cause → corrective path → governed retry/re-route → verify.

12. **Five Whys / Root-Cause Analyst**
    - Trigger on repeat failure, repeat recommendation, unexplained blocker or low confidence.
    - Evidence-backed causal chain; unsupported causes labelled HYPOTHESIS.

13. **Strategy Pivot Engine**
    - Detect stale routes and repeated low-yield recommendations.
    - Change HOW without silently changing the Founder objective or hard boundaries.

14. **Victor Result Synthesizer**
    - Founder-facing replies summarize actual conclusion: result, evidence, root cause/decision, next action, goal state.
    - Raw department traffic remains internal unless inspection is requested.

### P2 — Organizational brain, memory and learning

15. **Active Session + Durable Memory Reconciliation**
    - Separate short-term conversational state from durable memory.
    - Query-aware recall and precedence-aware supersession.

16. **Decision Journal & Learning Engine**
    - Record decision, expected result, actual result and verified lesson.
    - Promote Observation → Candidate → Validated → Playbook only with evidence.

17. **Department Capability / Reliability Score**
    - Track capability, transport health, result quality, repeat failure and verified final outcomes.
    - Activity does not earn performance credit.

18. **Unified Source Adapter & Trust Hierarchy**
    - Standard interfaces for GitHub state, department results, external proof and research.
    - Trust order: verified external outcome > canonical state > verified department evidence > generated inference.

### P3 — Reliability, concurrency and production hardening

19. **Single-Flight Execution & Conflict-Safe State**
    - Prevent overlapping Telegram/scheduled cycles from duplicating consequential work.
    - Conflict retries rebuild from fresh canonical state.

20. **Unified Department Transport Contract**
    - Common task/result envelope across RIO, Tony, AURA3 and future HULK bridge.
    - Separate read, dispatch, result and external-side-effect certification.

21. **Verification / Failure-Injection Test Suite**
    - Founder conversation regression corpus.
    - Timeout, stale state, bad schema, credential boundary, duplicate work and bridge-failure tests.
    - Production Telegram acceptance tests for high-risk behaviors.

22. **Architecture Invariant & Self-Assessment Validator**
    - Detect rule drift, stale approval language, bridge mismatch, architecture bypass and false capability claims.
    - Victor periodically audits itself against this plan.

## Locked cognitive pipeline

UNDERSTAND → RESOLVE CONTEXT → RECALL → VERIFY FACTS → RECONCILE AUTHORITY/GOAL → PLAN → DECOMPOSE → ROUTE → EXECUTE → OBSERVE → VERIFY → DIAGNOSE → RECOVER/PIVOT → LEARN → REPORT

## Permanent invariants

- Founder authority has highest operational precedence subject to hard safety/compliance boundaries.
- Credentials/secrets are never exposed.
- Internal task completion is not a real-world business outcome.
- No unsupported success/revenue/public-action claim.
- Department raw output is internal; Victor owns Founder-facing synthesis.
- Routine execution does not wait for Founder approval inside already approved authority.
- Real Founder-only boundaries remain credential/account identity administration, configured spend ceiling, irreversible high-impact commitments, unresolved legal/security judgment, emergency pause, and objective/success-criteria change.

## Closure waves

- **Wave P0:** modules 1–8. Goal: stop misunderstanding and false/stale answers.
- **Wave P1:** modules 9–14. Goal: make Victor an executive manager instead of a workflow router.
- **Wave P2:** modules 15–18. Goal: reliable organizational memory and learning.
- **Wave P3:** modules 19–22. Goal: production-grade reliability and architecture stability.

This file is the canonical correction baseline. New defects should map into an existing module unless they represent a genuinely new architectural class.