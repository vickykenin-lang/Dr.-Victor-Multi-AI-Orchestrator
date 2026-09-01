#!/usr/bin/env python3
from pathlib import Path

P = Path('victor-telegram-worker/worker.js')
s = P.read_text(encoding='utf-8')

import_anchor = "import { classifyFactRequest, collectFactEvidence, buildFactAnswerPrompt } from '../brain/fact_runtime.mjs';\n"
import_line = "import { buildRuntimeFounderRequest, buildSessionPatchForRequest, buildFactRequestFromFounderRequest, shouldUseFactGateway } from '../brain/request_gateway.mjs';\n"
if import_line not in s:
    if import_anchor not in s:
        raise SystemExit('request gateway import anchor missing')
    s = s.replace(import_anchor, import_anchor + import_line, 1)

# Remove duplicate health metadata while exposing the consolidated gateway.
s = s.replace("        founder_conversation_layer: 'NATURAL_CONVERSATION_FIRST_V1',\n        fact_evidence_runtime: 'FRESH_GITHUB_FACTS_V1',\n        founder_conversation_layer: 'NATURAL_CONVERSATION_FIRST_V1',\n",
              "        founder_conversation_layer: 'NATURAL_CONVERSATION_FIRST_V1',\n        fact_evidence_runtime: 'FRESH_GITHUB_FACTS_V1',\n        founder_request_gateway: 'STRUCTURED_REQUEST_GATEWAY_V1',\n", 1)

old = """      const sessionWithFounderTurn = appendRecentTurn({ ...session, ...activePatch }, 'founder', text);\n      await writeConversationSession(chatId, sessionWithFounderTurn);\n      const deterministicIntent = resolveFounderIntent(text, replyContext);\n      const contextualFollowUp = classifyConversationFollowUp(text, sessionWithFounderTurn);\n      const ownedProblem = classifyOwnedProblem(text, sessionWithFounderTurn);\n      const factRequest = classifyFactRequest(text);\n      const hulkRequest = classifyHulkRequest(text);\n"""
new = """      let sessionWithFounderTurn = appendRecentTurn({ ...session, ...activePatch }, 'founder', text);\n      const founderRequest = buildRuntimeFounderRequest(text, sessionWithFounderTurn);\n      const requestSessionPatch = buildSessionPatchForRequest(founderRequest);\n      sessionWithFounderTurn = { ...sessionWithFounderTurn, ...requestSessionPatch };\n      await writeConversationSession(chatId, sessionWithFounderTurn);\n      const deterministicIntent = resolveFounderIntent(text, replyContext);\n      const contextualFollowUp = classifyConversationFollowUp(text, sessionWithFounderTurn);\n      const ownedProblem = classifyOwnedProblem(text, sessionWithFounderTurn);\n      const factRequest = buildFactRequestFromFounderRequest(founderRequest, text);\n      const hulkRequest = classifyHulkRequest(text);\n"""
if new not in s:
    if old not in s:
        raise SystemExit('request gateway classification anchor missing')
    s = s.replace(old, new, 1)

s = s.replace("if (!memoryDirective && factRequest.matched) {", "if (!memoryDirective && shouldUseFactGateway(founderRequest, factRequest)) {", 1)
s = s.replace("return json({ ok: true, mode: 'FACT_EVIDENCE_QUERY', targets: factRequest.targets });",
              "return json({ ok: true, mode: 'FACT_EVIDENCE_QUERY', targets: factRequest.targets, questions: founderRequest.questions.length });", 1)

P.write_text(s, encoding='utf-8')
print('REQUEST_GATEWAY_APPLIED')
