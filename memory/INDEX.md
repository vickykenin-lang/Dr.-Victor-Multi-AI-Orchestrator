# Victor Memory Index

## Retrieval Order
1. `founder_memory.json` — canonical stable Founder profile/authority facts.
2. `decisions.jsonl` — explicit Founder directives; newer active decisions override older conflicts.
3. `MEMORY.md` — compressed durable strategic memory.
4. `ACTIVE_PROJECTS.md` — current initiatives, blockers, owners, next actions.
5. `WORKING_MEMORY.md` — current short-horizon operational context.
6. `LEARNINGS.md` — reusable lessons and operating consequences.
7. `operational_memory.jsonl` — machine-oriented operational events.
8. `ACTIVITY_LOG.md` — human-readable high-signal chronology.

## Write Policy
- Explicit Founder directive -> `decisions.jsonl`.
- Stable Founder/system fact -> `founder_memory.json` or `MEMORY.md`.
- Current volatile context -> `WORKING_MEMORY.md`.
- Proven reusable lesson -> `LEARNINGS.md`.
- Current initiative status/blocker -> `ACTIVE_PROJECTS.md`.
- Material milestone/failure/fix -> `ACTIVITY_LOG.md` and, when useful for machines, `operational_memory.jsonl`.

## Conflict Rule
Founder explicit active decision > durable memory > project/working memory > learned heuristic > old operational history.

## Compaction Rule
Working memory should be rewritten, not endlessly appended. Promote durable facts upward; archive/drop stale working details. Never store secrets, tokens, passwords, OTPs, or raw credentials.

## Decision Quality Rule
Memory is context, not proof. External/business claims still require fresh evidence. Unknown telemetry remains UNKNOWN.
