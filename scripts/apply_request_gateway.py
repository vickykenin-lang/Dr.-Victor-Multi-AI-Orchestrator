#!/usr/bin/env python3
from pathlib import Path

P = Path('victor-telegram-worker/worker.js')
s = P.read_text(encoding='utf-8')

# Later consolidation layers can change storage and neighboring classifiers.
# If the structured gateway is already the ingress decomposition source and
# drives the fact gateway, this historical patcher is complete.
if (
    "from '../brain/request_gateway.mjs'" in s
    and "const founderRequest = buildRuntimeFounderRequest(text, sessionWithFounderTurn);" in s
    and "buildSessionPatchForRequest(founderRequest)" in s
    and "buildFactRequestFromFounderRequest(founderRequest, text)" in s
    and "shouldUseFactGateway(founderRequest, factRequest)" in s
):
    print('REQUEST_GATEWAY_ALREADY_APPLIED')
    raise SystemExit(0)

raise SystemExit('request gateway semantic end-state missing; manual integration review required')
