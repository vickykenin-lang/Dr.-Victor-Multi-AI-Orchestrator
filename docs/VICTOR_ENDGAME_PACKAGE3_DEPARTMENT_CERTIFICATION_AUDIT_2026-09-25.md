# VICTOR END GAME — PACKAGE 3 DEPARTMENT CERTIFICATION AUDIT

**Date:** 2026-09-25  
**Package:** 3 — Department Certification  
**Stage:** TONY_LIVE_ROUNDTRIP_PENDING

## Objective
Freshly certify Victor↔department execution paths after V2 cutover. Certification requires real dispatch, department execution, strict result return and Victor verification. Read-only bridge health alone is not certification.

## Order
1. Tony Stark — first priority because registry currently has connection VERIFIED but live certification NOT_VERIFIED.
2. AURA3 — refresh previously certified evidence after V2 cutover.
3. RIO — refresh governed runtime evidence after V2 cutover.

## Tony acceptance gate
The Package 3 Tony workflow uses the existing governed `department_bridge.mjs` transport to:
- dispatch a bounded status/certification request to Tony's real transport workflow;
- prohibit production, paid, destructive, credential and public actions;
- wait for Tony's persisted result envelope;
- verify task ID, sender, recipient, message type and strict-supervision fields;
- require explicit false values for destructive, paid and production actions;
- require returned evidence and explicit follow-up state.

No department is marked newly certified until the fresh live round-trip result passes.
