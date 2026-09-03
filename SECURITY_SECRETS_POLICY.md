# Victor Secrets & Credential Scope Policy

Status: ACTIVE
Authority: Founder → Victor
Scope: Victor control plane and all departments

## Core rule

Secrets are never stored in source, logs, prompts, evidence files, Telegram messages, or shared plaintext memory.

Credentials are scoped by function and authority:

1. **GitHub orchestration credential** — one approved `GITHUB_ORCHESTRATION_TOKEN` may be used by the Victor control plane to read/dispatch across explicitly authorized repositories. It is an orchestration credential only; possession does not grant business-side authority.
2. **Department business/provider credentials** — Instagram, provider, payment, publishing, analytics, or other external-service secrets remain in the authorized department/runtime scope that owns that capability.
3. **Victor control-plane credentials** — Telegram webhook/bot credentials and Victor AI credential remain in the Victor Worker scope only.
4. **No credential value is copied into another department merely to simplify routing.** Cross-department work is mediated by Victor through capability/transport contracts rather than by sharing business credentials.

## Authority separation

Technical access is not organizational authority. A token being present does not authorize an action. Every consequential action must still pass capability, policy, authority, dependency, cost, and evidence gates defined by the canonical architecture.

## Prohibited

- committing tokens, passwords, API keys, webhook secrets, access tokens, or private credentials to Git
- exposing secret values in logs, Telegram, dashboards, reports, prompts, evidence receipts, or error messages
- using a department business credential for an unrelated department/capability
- bypassing capability/authority gates because a credential technically works
- creating additional orchestration tokens without a demonstrated need and Founder approval
- inferring provider/account identity from a secret value
- automated credential provisioning, rotation, privilege expansion, or security exceptions without the required Founder/account authority

## Allowed

- the existing approved single GitHub orchestration-token architecture for Victor repository coordination
- separate department/provider keys where an external provider or platform requires department-scoped credentials
- references to environment-variable names or secret identifiers, without values
- read-only checks that report only credential presence/configuration state

## Runtime expectations

- Victor Worker: `TELEGRAM_BOT_TOKEN_VICTOR`, `TELEGRAM_WEBHOOK_SECRET`, `API_VICTOR`, Founder/chat identifiers, and the approved GitHub orchestration credential as required
- RIO: RIO-owned Instagram/publishing/analytics credentials only in RIO runtime scope
- AURA3: AURA3-owned provider/social credentials only in AURA3 runtime scope
- Tony: only credentials required by approved Tony capabilities; Tony may diagnose credential absence but cannot reveal or self-provision credentials
- Other departments: same department/capability-scoped rule

## Audit requirements

- production source must pass secret-literal scanning
- logs/evidence must redact authorization headers and credential values
- credential presence may be reported only as boolean/configured state
- credential-dependent failures must fail closed
- any change to credential scope, privilege, or sharing model is an explicit security/authority change and must not happen silently

This policy supersedes legacy AURA2/Vision-era secret maps where they conflict with the current canonical Victor architecture.
