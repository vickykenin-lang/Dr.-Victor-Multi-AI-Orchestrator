from pathlib import Path

worker_path = Path('victor-telegram-worker/worker.js')
worker = worker_path.read_text(encoding='utf-8')

old = """          const semanticMemory = await recallVictorMemory(env, text, authoritativeMemory, { topK: 5 });\n          const semanticResults = Array.isArray(semanticMemory?.cogneeMemory) ? semanticMemory.cogneeMemory : [];\n          let reply;\n          if (env.ENABLE_AI_INFERENCE === 'true' && env.API_VICTOR) {"""
new = """          const semanticMemory = await recallVictorMemory(env, text, authoritativeMemory, { topK: 5 });\n          const semanticResults = Array.isArray(semanticMemory?.cogneeMemory) ? semanticMemory.cogneeMemory : [];\n          const canonicalTargetEvidencePresent = Boolean(\n            (Array.isArray(factRequest?.targets) && factRequest.targets.length) ||\n            evidence?.rio || evidence?.aura3 || evidence?.tony_stark\n          );\n          const firstSemantic = semanticResults[0];\n          const semanticTextRaw = firstSemantic && typeof firstSemantic === 'object'\n            ? (typeof firstSemantic.text === 'string' ? firstSemantic.text\n              : typeof firstSemantic.context === 'string' ? firstSemantic.context\n              : typeof firstSemantic.answer === 'string' ? firstSemantic.answer\n              : '')\n            : (typeof firstSemantic === 'string' ? firstSemantic : '');\n          const semanticText = String(semanticTextRaw || '')\n            .replace(/^\\s*Victor\\s*,?\\s*remember\\s+this\\s*[:\\-]?\\s*/i, '')\n            .replace(/^\\s*remember\\s+this\\s*[:\\-]?\\s*/i, '')\n            .trim();\n          let reply;\n          if (semanticText && !canonicalTargetEvidencePresent) {\n            reply = semanticText;\n            console.log(JSON.stringify({\n              event: 'VICTOR_MEMORY_DIRECT_ANSWER',\n              provider: 'COGNEE',\n              semantic_result_count: semanticResults.length,\n              canonical_target_evidence_present: false,\n              secrets_exposed: false,\n            }));\n          } else if (env.ENABLE_AI_INFERENCE === 'true' && env.API_VICTOR) {"""

if old not in worker:
    if "VICTOR_MEMORY_DIRECT_ANSWER" in worker:
        print('SEMANTIC_DIRECT_ANSWER_ALREADY_APPLIED')
    else:
        raise RuntimeError('FACT_GATEWAY_SEMANTIC_ANCHOR_NOT_FOUND')
else:
    worker = worker.replace(old, new, 1)
    worker_path.write_text(worker, encoding='utf-8')
    print('SEMANTIC_DIRECT_ANSWER_APPLIED')
