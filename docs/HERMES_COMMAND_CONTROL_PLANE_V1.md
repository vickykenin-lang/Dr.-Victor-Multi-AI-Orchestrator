# Hermes Command Control Plane V1

Status: IMPLEMENTATION IN PROGRESS — NOT DEPLOYED

## Purpose
Create one governed command plane that can accept Founder-authorized commands from Telegram, ChatGPT, dashboard, or internal services without duplicating business logic in each channel.

## Core rule
Every external channel is only an adapter. All commands normalize into one canonical envelope before routing to Hermes/RIO/Victor.

## Canonical command endpoint
Planned external contract:

- `POST /v1/commands`
- `GET /v1/commands/{id}`
- `GET /v1/health`
- `POST /integrations/telegram/webhook`
- `POST /v1/approvals/{command_id}`

These routes are not deployed by this document.

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

Block 2 provides deterministic primitives for Bearer validation, HMAC verification, a default 5-minute timestamp window, and replay protection through an injected key-value store. HTTP endpoint wiring and production secrets are still not configured by this branch.

## Authentication contract
Expected request headers for the future HTTP endpoint:

- `Authorization: Bearer <HERMES_COMMAND_TOKEN>`
- `X-Hermes-Timestamp: <unix-seconds>`
- `X-Hermes-Signature: sha256=<hmac>`
- `X-Idempotency-Key: <unique-key>`

Canonical signature input:

`HMAC_SHA256(secret, timestamp + "." + raw_request_body)`

The request must fail closed when the token, timestamp, signature, idempotency key, or replay store is invalid/missing.

## Persistence contract
Block 3 adds a fail-closed durable store abstraction using one KV-like binding named `HERMES_COMMAND_STORE`.

Key namespaces:
- `idempotency:<key>` — reserves one logical command key and detects duplicates.
- `command:<command_id>` — stores current command lifecycle state.
- `receipt:<receipt_id>` — stores evidence and execution receipts.

The persistence layer does not fall back to transient cache for command acceptance. If `HERMES_COMMAND_STORE` is unavailable, command persistence fails closed.

Default idempotency retention is 35 days. This is a source-level default and is not proof that a production KV binding exists.

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

A receipt must preserve at least:
- validation status
- execution status
- live request verified
- real output verified
- business outcome verified

## Telegram adapter
Examples:
- `/hermes status` -> `hermes.status`
- `/rio status` -> `rio.status`
- `/rio usage` -> `rio.image_usage`
- `/rio budget` -> `rio.image_budget`
- `/rio flyer B0ABC123` -> `rio.generate_product_flyer`
- `/victor status` -> `victor.status`

Telegram must not contain a second copy of execution policy. It only normalizes into the canonical command envelope.

## ChatGPT adapter
When an authenticated ChatGPT-to-Hermes connector is available, ChatGPT should submit the same canonical envelope with `source=chatgpt` and `actor=founder_authorized_assistant`.

## Persistent context model
Hermes development should separate:
1. Context Registry — stable architecture, policies, provider purposes, locked decisions.
2. State Registry — current deployment, active version, current usage, pending jobs, failures.
3. Evidence Registry — tests, live receipts, provider responses, output verification.
4. Command API — governed reads and executions against the above registries.

## RIO image policy target
Planned policy (not yet wired):
- 30 approved final images per month.
- Max 2 generation attempts per product.
- External AI spend hard cap handled separately at provider/gateway level.
- Product identity and factual copy must be verified before generation.
- Final image count increments only after QA approval.

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
- [ ] `POST /v1/commands`.
- [ ] `GET /v1/commands/{id}`.
- [ ] `GET /v1/health`.
- [ ] Telegram adapter route integration.

### Block 5 — governed routing
- [ ] Route read-only commands.
- [ ] Route RIO flyer command to existing RIO bridge only after policy gates.
- [ ] Add approval boundary for consequential actions.

### Block 6 — deployment and live verification
- [ ] CI tests pass.
- [ ] Deploy candidate.
- [ ] Verify health.
- [ ] Verify Telegram command.
- [ ] Verify ChatGPT connector when available.
- [ ] Verify real RIO output separately.

## Current status
Block 1, Block 2, and Block 3 source are present on `feature/hermes-command-control-plane-v1`. Nothing in this document proves a production `HERMES_COMMAND_STORE` binding, production deployment, configured production credentials, CI success, or live command execution.
