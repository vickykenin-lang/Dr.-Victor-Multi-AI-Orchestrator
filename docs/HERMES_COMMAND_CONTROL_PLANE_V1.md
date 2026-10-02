# Hermes Command Control Plane V1

Status: RELEASE CANDIDATE — SOURCE + CI VERIFIED; PRODUCTION DEPLOYMENT EVIDENCE PENDING

## Purpose
One governed command plane for Founder-authorized commands from Telegram, ChatGPT, dashboard, or internal services without duplicating execution policy per channel.

## V1 interfaces
- `POST /v1/commands`
- `GET /v1/commands/{id}`
- `GET /v1/health`
- `POST /integrations/telegram/webhook`
- existing `POST /telegram` mixed mode: recognized Hermes slash commands use the governed command plane; ordinary messages pass through to the existing Victor LLM-first runtime.

## Registered actions
Read only: `hermes.status`, `hermes.audit`, `rio.status`, `rio.image_usage`, `rio.image_budget`, `victor.status`.

Safe execution: `rio.generate_product_flyer`.

Unknown actions fail closed.

## Security and evidence contract
V1 implements bearer authentication, HMAC request signatures, timestamp freshness, replay protection, Founder/actor checks, schema validation, durable idempotency, policy classification, and command/receipt persistence.

During controlled cutover, existing `API_VICTOR` and `TELEGRAM_WEBHOOK_SECRET` may be used as transitional command/HMAC bindings. Dedicated Hermes secrets can replace these later without changing the command contract.

Never collapse these states: credential available; endpoint/config present; source implemented; test passed; production deployed; live request verified; real output verified; real business outcome verified.

## Telegram commands
- `/hermes status`
- `/hermes audit`
- `/rio status`
- `/rio usage`
- `/rio budget`
- `/rio flyer <product-reference> <exact-https-product-image-url>`
- `/victor status`

Handled Hermes commands return a concise status/receipt through the existing Telegram bot. Non-Hermes Telegram messages continue through the existing Victor LLM-first queue/runtime.

## RIO flyer path
The exact RIO flyer transport is implemented in `vickykenin-lang/rio-affiliate-engine` through `.github/workflows/hermes-rio-flyer-transport.yml`. Hermes requires an exact product reference and an HTTPS product image before dispatch. The feature flag remains fail-closed until live provider/runtime prerequisites are verified.

The RIO transport applies an application-level monthly provider-call ledger. Provider spend telemetry/hard-dollar enforcement remains a separate verification item. Generated media is not treated as final/approved until semantic product-identity QA succeeds.

## Runtime cutover
`wrangler.toml` selects `victor-telegram-worker/hermes_runtime_entry_v2.js`. That entrypoint wraps, rather than replaces, `llm_first_runtime.js`, preserving its fetch/scheduled/queue behavior for requests that are not handled by Hermes.

`HERMES_COMMAND_STORE` is declared as a durable KV binding. Production presence must still be proven after deployment.

## Persistent context model
The architecture separates Context Registry (stable decisions/policies), State Registry (current runtime state), Evidence Registry (tests/receipts/results), and Command API (governed read/execution). V1 durably implements command lifecycle, idempotency and evidence receipts; a richer editable Context Registry API can be layered on the same control plane.

## Release checklist
- [x] Canonical command contract and risk classification.
- [x] Authentication, HMAC, timestamp and replay protection.
- [x] Durable command/idempotency/receipt storage abstraction.
- [x] HTTP routes and governed router.
- [x] Existing `/telegram` mixed-mode integration.
- [x] Preserve Victor LLM-first runtime and queue.
- [x] Exact RIO flyer bridge and product-image gate.
- [x] Dedicated Hermes tests including mixed Telegram webhook behavior.
- [x] Release-candidate CI gates passed on tested feature head.
- [ ] Merge release candidate to `main`.
- [ ] Observe production deployment/version evidence.
- [ ] Verify live `/v1/health`.
- [ ] Verify live Telegram `/hermes status`.
- [ ] Configure/verify RIO provider credentials before enabling flyer transport.
- [ ] Verify real flyer dispatch, generated output, semantic QA, and provider-spend controls separately.
- [ ] Connect an authenticated ChatGPT-side connector before claiming ChatGPT can issue live Hermes commands from a new chat.

Green source/CI is not a production claim. Each live milestone requires fresh evidence.
