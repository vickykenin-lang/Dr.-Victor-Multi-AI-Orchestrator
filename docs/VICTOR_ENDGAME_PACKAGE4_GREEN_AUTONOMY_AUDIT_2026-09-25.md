# Victor END GAME Package 4 — GREEN Autonomy Audit

Date: 2026-09-25

## Scope
Controlled autonomous execution is limited to security-kernel GREEN capabilities only:
- `repo.read`
- `evidence.read`
- `sandbox.execute`

## Hard boundaries
Package 4 does **not** authorize:
- branch or PR writes
- production mutation
- public actions
- credential actions
- security-policy changes
- authority expansion
- destructive actions
- pause override

AMBER and RED remain outside GREEN autonomous scope.

## Runtime model
The GREEN controller delegates capability authorization to the external security kernel and fails closed. Emergency pause converts the cycle to `SAFE_HOLD`.

The scheduled acceptance workflow runs hourly with `contents: read`, no repository write permission, and `persist-credentials: false`. Its execution is restricted to source/security regression tests plus fresh read-only production health/evidence checks.

## Acceptance criteria
PASS requires:
1. all GREEN policy tests pass;
2. AMBER/RED denial regressions pass;
3. sandbox/security regressions pass;
4. fresh production health surfaces return HTTP 200;
5. no production mutation, public action, credential action or authority expansion is performed.

## Important distinction
This package activates bounded unattended GREEN verification only. It does not enable general Victor production autonomy. The Telegram Worker scheduler remains separately governed, and AMBER/RED rollout requires later packages and their own evidence gates.
