from pathlib import Path

path = Path('victor-telegram-worker/worker.js')
text = path.read_text(encoding='utf-8')

fact_import = "import { classifyFactRequest, collectFactEvidence, buildFactAnswerPrompt } from '../brain/fact_runtime.mjs';\n"
anchor_import = "import { classifyOwnedProblem, buildOwnedProblemPrompt, naturalOwnedProblemAck } from '../brain/problem_ownership.mjs';\n"
if fact_import not in text:
    if anchor_import not in text:
        raise SystemExit('fact runtime import anchor missing')
    text = text.replace(anchor_import, anchor_import + fact_import, 1)

# Later request-gateway integration may derive factRequest from the structured Founder
# request instead of classifyFactRequest(text). Either form is a valid fact classifier.
if "const factRequest =" not in text:
    classify_anchor = "      const ownedProblem = classifyOwnedProblem(text, sessionWithFounderTurn);\n      const hulkRequest = classifyHulkRequest(text);\n"
    classify_repl = "      const ownedProblem = classifyOwnedProblem(text, sessionWithFounderTurn);\n      const factRequest = classifyFactRequest(text);\n      const hulkRequest = classifyHulkRequest(text);\n"
    if classify_anchor not in text:
        raise SystemExit('fact classification anchor missing')
    text = text.replace(classify_anchor, classify_repl, 1)

handler_anchor = "      if (!memoryDirective && ownedProblem.matched) {\n"
handler = '''      if (!memoryDirective && factRequest.matched) {
        processingStage = 'FACT_RETRIEVAL';
        try {
          const evidence = await collectFactEvidence(env, text, factRequest);
          let reply;
          if (env.ENABLE_AI_INFERENCE === 'true' && env.API_VICTOR) {
            reply = await askModel(
              env,
              'Answer from fresh GitHub evidence only. Cover every sub-question. Be natural and concise; never replace facts with reassurance or a status template.',
              buildFactAnswerPrompt(text, evidence),
            );
          } else {
            reply = `Fresh evidence fetched at ${evidence.fetched_at_utc}. AI synthesis unavailable; raw fact retrieval succeeded.`;
          }
          await sendTelegramMessage(env, chatId, reply, message.message_id);
          return json({ ok: true, mode: 'FACT_EVIDENCE_QUERY', targets: factRequest.targets });
        } catch (error) {
          console.error('Fresh fact retrieval failed:', safeErrorMessage(error));
          await sendTelegramMessage(env, chatId, 'Fresh evidence read fail hua. Main generic status line se gap cover nahi karunga; exact GitHub fact abhi verify nahi hua.', message.message_id);
          return json({ ok: true, mode: 'FACT_EVIDENCE_QUERY_FAILED' });
        }
      }

'''
# Gateway handler is semantically equivalent and intentionally preferred.
if "processingStage = 'FACT_RETRIEVAL';" not in text:
    if handler_anchor not in text:
        raise SystemExit('fact handler anchor missing')
    text = text.replace(handler_anchor, handler + handler_anchor, 1)

needle = "      if (!memoryDirective && contextualFollowUp.mode === 'CONTEXTUAL_INVESTIGATION') {"
first = text.find(needle)
if first != -1:
    second = text.find(needle, first + len(needle))
    if second != -1:
        end_anchor = "      if (!memoryDirective && contextualFollowUp.mode) {"
        end = text.find(end_anchor, second)
        if end != -1:
            text = text[:second] + text[end:]

text = text.replace("        founder_conversation_layer: 'NATURAL_CONVERSATION_FIRST_V1',\n        founder_conversation_layer: 'NATURAL_CONVERSATION_FIRST_V1',\n", "        founder_conversation_layer: 'NATURAL_CONVERSATION_FIRST_V1',\n")
if "        fact_evidence_runtime: 'FRESH_GITHUB_FACTS_V1',\n" not in text:
    health_anchor = "        founder_conversation_layer: 'NATURAL_CONVERSATION_FIRST_V1',\n"
    if health_anchor in text:
        text = text.replace(health_anchor, health_anchor + "        fact_evidence_runtime: 'FRESH_GITHUB_FACTS_V1',\n", 1)

path.write_text(text, encoding='utf-8')
print('FACT_RUNTIME_VERIFIED_OR_APPLIED')
