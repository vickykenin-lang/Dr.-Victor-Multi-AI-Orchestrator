from pathlib import Path

path = Path('victor-telegram-worker/worker.js')
worker = path.read_text(encoding='utf-8')

old = """      if (!memoryDirective && shouldUseFactGateway(founderRequest, factRequest)) {
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
          return json({ ok: true, mode: 'FACT_EVIDENCE_QUERY', targets: factRequest.targets, questions: founderRequest.questions.length });
        } catch (error) {
          console.error('Fresh fact retrieval failed:', safeErrorMessage(error));
          await sendTelegramMessage(env, chatId, 'Fresh evidence read fail hua. Main generic status line se gap cover nahi karunga; exact GitHub fact abhi verify nahi hua.', message.message_id);
          return json({ ok: true, mode: 'FACT_EVIDENCE_QUERY_FAILED' });
        }
      }
"""

new = """      if (!memoryDirective && shouldUseFactGateway(founderRequest, factRequest)) {
        processingStage = 'FACT_RETRIEVAL';
        try {
          const evidence = await collectFactEvidence(env, text, factRequest);
          const authoritativeMemory = buildMemoryContext(text, [], 0);
          const semanticMemory = await recallVictorMemory(env, text, authoritativeMemory, { topK: 5 });
          const semanticResults = Array.isArray(semanticMemory?.cogneeMemory) ? semanticMemory.cogneeMemory : [];
          let reply;
          if (env.ENABLE_AI_INFERENCE === 'true' && env.API_VICTOR) {
            reply = await askModel(
              env,
              'Answer from verified evidence. GitHub canonical evidence has precedence. Cognee long-term memory may be used when it directly answers the Founder query and does not conflict with canonical evidence. Never claim a Cognee memory is canonical unless GitHub also supports it. If neither source supports the answer, say UNVERIFIED.',
              buildFactAnswerPrompt(text, evidence) + `\n\nCOGNEE LONG-TERM MEMORY (advisory semantic recall):\n${JSON.stringify(semanticResults)}`,
            );
          } else if (semanticResults.length) {
            reply = `Semantic memory recall returned ${semanticResults.length} result(s), but AI synthesis is unavailable.`;
          } else {
            reply = `Fresh evidence fetched at ${evidence.fetched_at_utc}. AI synthesis unavailable; raw fact retrieval succeeded.`;
          }
          await sendTelegramMessage(env, chatId, reply, message.message_id);
          return json({
            ok: true,
            mode: 'FACT_EVIDENCE_QUERY',
            targets: factRequest.targets,
            questions: founderRequest.questions.length,
            semantic_recall_status: semanticMemory?.semantic_recall_status || null,
            semantic_result_count: semanticResults.length,
          });
        } catch (error) {
          console.error('Fresh fact retrieval failed:', safeErrorMessage(error));
          await sendTelegramMessage(env, chatId, 'Fresh evidence read fail hua. Main generic status line se gap cover nahi karunga; exact GitHub/Cognee fact abhi verify nahi hua.', message.message_id);
          return json({ ok: true, mode: 'FACT_EVIDENCE_QUERY_FAILED' });
        }
      }
"""

if new in worker:
    print('MEMORY_FACT_GATEWAY_ALREADY_PATCHED')
elif old in worker:
    worker = worker.replace(old, new, 1)
    path.write_text(worker, encoding='utf-8')
    print('MEMORY_FACT_GATEWAY_PATCHED')
else:
    raise RuntimeError('FACT_GATEWAY_ANCHOR_NOT_FOUND')
