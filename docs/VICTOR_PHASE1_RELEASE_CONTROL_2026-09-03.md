# Victor Phase 1 — Release & Deployment Control

Date: 2026-09-03
Status: IN_PROGRESS — REPO CONTROLS IMPLEMENTED, CLOUDFLARE BUILD WATCH/PARITY VERIFICATION PENDING

## Objective

Prevent routine state/evidence commits from causing unnecessary production Worker deployments and make every production deployment attributable to an approved Git commit and reproducible deploy toolchain.

## Implemented in repository

1. `package.json` added with Wrangler pinned exactly to `4.128.0`.
2. `package-lock.json` generated and committed; root and installed Wrangler version are both locked to `4.128.0`.
3. Deploy script injects Cloudflare Workers Builds `WORKERS_CI_COMMIT_SHA` into runtime variable `VICTOR_DEPLOY_GIT_SHA` and `WORKERS_CI_BUILD_UUID` into `VICTOR_BUILD_UUID` when Cloudflare deploy command is `npm run deploy`.
4. `wrangler.toml` now declares Cloudflare version metadata binding `CF_VERSION_METADATA`.
5. Victor Pre-Commercial Gate now checks:
   - runtime JavaScript syntax;
   - brain regressions;
   - commercial behavior invariants;
   - exact Wrangler pin in package and lockfile;
   - lockfile installability with `npm ci`;
   - exact installed Wrangler version;
   - deploy SHA/build UUID injection contract;
   - Cloudflare version metadata binding;
   - absence of one-shot `fix-victor-*` repair workflows;
   - obvious embedded runtime credential literals.

## Required Cloudflare dashboard configuration

Workers project: `victor-telegram-webhook`

### A. Build watch paths

Cloudflare Dashboard → Worker → Settings → Build → Build watch paths.

Recommended include paths:

- `victor-telegram-worker/*`
- `brain/*`
- `wrangler.toml`
- `package.json`
- `package-lock.json`

Recommended exclude paths:

- `data/*`
- `docs/*`
- `memory/*`
- `backups/*`

The include list is the primary release boundary. The exclusion list is defense-in-depth/readability. Cloudflare evaluates exclusions first and then includes.

### B. Deploy command

Set production deploy command to:

`npm run deploy`

This uses the committed pinned Wrangler toolchain and injects the Workers Builds commit SHA/build UUID into the deployed runtime environment.

Do not use unversioned `npx wrangler deploy` as the commercial production command after this migration.

### C. Production branch

Production branch must remain explicitly `main`. Non-production branch builds may be enabled only for preview/validation and must not promote to production.

## Phase 1 acceptance tests

Phase 1 is complete only when all are proven:

1. Pre-Commercial Gate passes on the release-control commit.
2. Cloudflare Build Watch Paths match the approved include boundary.
3. A state-only `data/**` commit does not start a production Worker build.
4. A runtime-impacting commit does start a production Worker build.
5. Cloudflare production build records the same Git SHA as the approved runtime commit.
6. Production health/version evidence exposes the deployed Worker version metadata; Git SHA exposure will be wired to health in the truthful-capability/health hardening step after the deploy command is switched to `npm run deploy`.
7. Existing runtime bindings/secrets, especially `VICTOR_CONVERSATION_STATE`, remain present after the first release-controlled deploy.

## Boundary / truth

Repository controls are not proof of Cloudflare dashboard configuration. Until Build Watch Paths and deploy command are set and production behavior is verified, Phase 1 remains IN_PROGRESS.
