# Hermes Command Control Plane V1

Status: IMPLEMENTATION IN PROGRESS — NOT DEPLOYED

## Purpose
Create one governed command plane that can accept Founder-authorized commands from Telegram, ChatGPT, dashboard, or internal services without duplicating business logic in each channel.

## Core rule
Every external channel is only an adapter. All commands normalize into one canonical envelope before routing to Hermes/RIO/Victor.

## Canonical command endpoint
Source-level routes now implemented:

- `POST /v1/commands`
- `GET /v1/commands/{id}`
- `GET /v1/health`
- `POST /integrations/telegram/webhook`

Planned but not yet implemented:
- `POST /v1/approvals/{command_id}`

These routes are wired through `victor-telegram-worker/hermes_runtime_entry.js`. The production deployment entrypoint has not been changed by this branch.

## Command envelope
```json
{
  "command_id": "cmd_20261002_001",
  "source": "chatgpt",
  "actor": "founder_authorized_assistant",
  "target": "rio",
  "action": "rio.generate_product_flyer",
  "payload": {
    "product_reference": "B0XXXXXXX"
  },
  "execution_mode": "manual",
  "idempotency_key": "rio-B0XXXXXXX-flyer-001"
}
```

## V1 registered actions
Read only:
- `hermes.status`
- `hermes.audit`
- `rio.status`
- `rio.image_usage`
- `rio.image_budget`
- `victor.status`

Safe execution:
- `rio.generate_product_flyer`

Unknown actions fail closed.

## Security boundary
Before any consequential execution, the runtime must support:
1. HTTPS only.
2. Bearer/API token authentication.
3. HMAC signature over timestamp + raw body.
4. Timestamp freshness validation.
5. Replay protection.
6. Founder/authorized actor validation.
7. Schema validation.
8. Idempotency enforcement.
9. Policy/risk classification.
10. Receipt persistence before and after execution.

Block 2 provides deterministic primitives for Bearer validation, HMAC verification, a default 5-minute timestamp window, and replay protection through an injected key-value store. Production secrets are still not configured by this branch.

## Authentication contract
Expected request headers for `POST /v1/commands`:

- `Authorization: Bearer <HERMES_COMMAND_TOKEN>`
- `X-Hermes-Timestamp: <unix-seconds>`
- `X-Hermes-Signature: sha256=<hmac>`
- `X-Idempotency-Key: <unique-key>`

Canonical signature input:

`HMAC_SHA256(secret, timestamp + "." + raw_request_body)`

The request fails closed when token, timestamp, signature, idempotency key, or replay store is invalid/missing.

## Persistence contract
Block 3 adds a fail-closed durable store abstraction using one KV-like binding named `HERMES_COMMAND_STORE`.

Key namespaces:
- `idempotency:<key>` — reserves one logical command key and detects duplicates.
- `command:<command_id>` — stores current command lifecycle state.
- `receipt:<receipt_id>` — stores evidence and execution receipts.

The persistence layer does not fall back to transient cache for command acceptance. If `HERMES_COMMAND_STORE` is unavailable, command persistence fails closed.

Default idempotency retention is 35 days. This is a source-level default and is not proof that a production KV binding exists.

## HTTP behavior
`GET /v1/health` reports only capability/configuration state and does not expose secrets.

`POST /v1/commands` performs authentication, canonical validation, durable acceptance, then passes the accepted command through the governed router. Read-only commands may complete immediately. Blocked commands persist their SAFE_STOP result and error code.

`GET /v1/commands/{id}` reads persisted command state and requires the Hermes bearer token.

`POST /integrations/telegram/webhook` validates the Telegram webhook secret and Founder chat ID, normalizes recognized commands, persists them, then sends them through the same governed router used by the API path.

## Governed routing
Block 5 adds `hermes_command_router.mjs`.

Rules:
- Unknown actions fail closed.
- Approval-required actions cannot run without approval mode.
- Read-only status commands may complete synchronously.
- Evidence states remain separate; credential/config presence never becomes live verification.
- `rio.image_usage` does not invent a current count when the counter is not wired.
- `rio.image_budget` does not invent current provider spend when telemetry is not wired.
- `rio.generate_product_flyer` requires an exact product reference.
- The existing generic RIO bridge is not repurposed as an image-flyer transport without fresh evidence that the exact transport exists.

## Fresh RIO transport evidence
Current RIO repository inspection found no `.github/workflows/victor-rio-transport.yml` on `main`; the workflows directory currently exposes only `deploy-pages.yml`.

Therefore the existing Victor-side `dispatchRioTask()` reference to `victor-rio-transport.yml` is not treated as proof of a live RIO transport. The flyer action currently SAFE_STOPs with:

`RIO_EXACT_FLYER_TRANSPORT_NOT_IMPLEMENTED`

This is intentional. The next dependency is to implement and verify an exact RIO flyer transport before any real image-generation dispatch is enabled.

## Evidence states
Never collapse these into one status:
- credential available
- endpoint/configuration present
- source implemented
- test passed
- production deployed
- live request verified
- real output verified
- real business outcome verified

A receipt preserves validation, execution, live-request verification, real-output verification, and business-outcome verification separately.

## Telegram adapter
Examples:
- `/hermes status` -> `hermes.status`
- `/rio status` -> `rio.status`
- `/rio usage` -> `rio.image_usage`
- `/rio budget` -> `rio.image_budget`
- `/rio flyer B0ABC123` -> `rio.generate_product_flyer`
- `/victor status` -> `victor.status`

The existing production `/telegram` route is intentionally untouched. The new control-plane adapter is isolated at `/integrations/telegram/webhook` until deployment/cutover is explicitly approved.

## ChatGPT adapter
When an authenticated ChatGPT-to-Hermes connector is available, ChatGPT should submit the same canonical envelope with `source=chatgpt` and `actor=founder_authorized_assistant`.

## Persistent context model
Hermes development separates:
1. Context Registry — stable architecture, policies, provider purposes, locked decisions.
2. State Registry — current deployment, active version, current usage, pending jobs, failures.
3. Evidence Registry — tests, live receipts, provider responses, output verification.
4. Command API — governed reads and executions against the above registries.

## RIO image policy target
Planned policy:
- 30 approved final images per month.
- Max 2 generation attempts per product.
- External AI spend hard cap handled separately at provider/gateway level.
- Product identity and factual copy must be verified before generation.
- Final image count increments only after QA approval.

Current counter and provider-spend telemetry are not yet wired and are reported as unverified instead of fabricated.

## Implementation sequence
### Block 1 — command contract
- [x] Canonical action registry.
- [x] Envelope validator.
- [x] Risk classifier.
- [x] Receipt skeleton with evidence-state separation.
- [x] Telegram command normalizer.
- [x] Unit tests added.

### Block 2 — authentication and replay protection
- [x] Bearer token validation.
- [x] HMAC signature validation.
- [x] Timestamp freshness window.
- [x] Replay-store contract and replay detection.
- [x] Unit tests added.

### Block 3 — persistence
- [x] Idempotency store contract.
- [x] Command state store.
- [x] Receipt/evidence store.
- [x] Fail-closed missing-store behavior.
- [x] Unit tests added.

### Block 4 — HTTP wiring
- [x] `POST /v1/commands`.
- [x] `GET /v1/commands/{id}`.
- [x] `GET /v1/health`.
- [x] Telegram adapter route integration.
- [x] Isolated runtime entrypoint added.
- [x] HTTP/adapter unit tests added.

### Block 5 — governed routing
- [x] Route read-only commands.
- [x] Preserve approval boundary in router.
- [x] Persist routed results and SAFE_STOP receipts.
- [x] Add RIO flyer product-reference gate.
- [x] Refuse to reuse unverified generic RIO transport.
- [x] Add governed router unit tests.
- [ ] Implement exact RIO flyer transport in RIO repository.
- [ ] Wire verified monthly image counter.
- [ ] Wire verified provider spend telemetry/hard-stop evidence.

### Block 6 — deployment and live verification
- [ ] CI tests pass.
- [ ] Configure production `HERMES_COMMAND_STORE` and secrets.
- [ ] Deploy candidate.
- [ ] Verify health.
- [ ] Verify Telegram command.
- [ ] Verify ChatGPT connector when available.
- [ ] Verify real RIO flyer output separately.

## Current status
Blocks 1–5 control-plane source are present on `feature/hermes-command-control-plane-v1`, but exact RIO flyer transport remains a verified dependency gap. Nothing here proves production KV/secrets, CI success, production deployment, live command execution, real image output, or business outcome.
