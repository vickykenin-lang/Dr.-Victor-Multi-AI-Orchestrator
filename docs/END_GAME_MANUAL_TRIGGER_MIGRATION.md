# END GAME manual-trigger migration

## Scope

END GAME goal execution is Founder-manual-only. Governance, validation, SAFE_STOP, evidence logging, goal-state persistence, department routing, and post-action verification remain in the execution path.

## Scheduler and production-binding inventory

| Entry point or binding | Previous behavior | Manual-only change |
| --- | --- | --- |
| `wrangler.toml` `[triggers]` | Bound the production Worker to `*/15 * * * *` goal cycles and `30 16 * * *` daily reports | Entire cron binding removed |
| `victor-telegram-worker/worker.js` `scheduled()` | Executed and persisted an END GAME cycle for Cloudflare scheduled events | Fails closed and performs no goal execution or state write |
| `victor-telegram-worker/autonomy_runtime.mjs` | Accepted the supervision cron, daily-report cron, and `founder-command` | Accepts only `founder-command`; every other trigger returns `SAFE_STOP / MANUAL_TRIGGER_REQUIRED` |
| `.github/workflows/victor_heartbeat.yml` | Ran readiness reconciliation every 15 minutes and by manual dispatch | Schedule removed; `workflow_dispatch` retained |
| Telegram `EXECUTIVE_GOAL` path | Created a `founder-command` controller and persisted result evidence | Retained as the primary manual END GAME trigger |
| Founder Guidance wake | Created a `founder-command` controller and persisted result evidence | Retained as an immediate Founder-driven continuation |

## Explicit exclusions

`.github/workflows/vision_engine.yml` keeps its existing schedule. It belongs to the separate Vision production capability and is not an END GAME/Victor executive scheduler. No RIO or other department repository/configuration is changed by this migration.

## Verification ladder

- Configuration changed: verify cron bindings are absent and only manual workflow dispatch remains.
- Source implemented: verify non-manual triggers fail closed before credential, network, dispatch, or persistence work.
- Tests passed: run the deterministic END GAME and runtime regression suites.
- Deployment state: unverified until a deployment containing this change is observed.
- Live manual trigger: unverified until a post-deployment Founder trigger produces fresh runtime evidence.
- Real output: unverified until that manual cycle produces independently verified material output; SAFE_STOP alone is not real output.
