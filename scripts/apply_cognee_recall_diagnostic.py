from pathlib import Path

bridge_path = Path('victor-telegram-worker/cognee_memory_bridge.mjs')
worker_path = Path('victor-telegram-worker/worker.js')

bridge = bridge_path.read_text(encoding='utf-8')
old = """  const results = Array.isArray(payload) ? payload : (payload?.results || payload?.items || []);\n  return { status: 'RECALLED', dataset: c.dataset, results };"""
new = """  let results = [];\n  let payloadShape = Array.isArray(payload) ? 'array' : typeof payload;\n  if (Array.isArray(payload)) {\n    results = payload;\n  } else if (payload && typeof payload === 'object') {\n    if (Array.isArray(payload.results)) results = payload.results;\n    else if (Array.isArray(payload.items)) results = payload.items;\n    else if (Array.isArray(payload.data)) results = payload.data;\n    else if (Array.isArray(payload.search_results)) results = payload.search_results;\n    else if (typeof payload.context === 'string' && payload.context.trim()) results = [{ context: payload.context }];\n    else if (typeof payload.answer === 'string' && payload.answer.trim()) results = [{ answer: payload.answer, context: payload.context || '' }];\n    payloadShape = 'object:' + Object.keys(payload).slice(0, 12).join(',');\n  } else if (typeof payload === 'string' && payload.trim()) {\n    results = [{ context: payload }];\n    payloadShape = 'string';\n  }\n  return { status: 'RECALLED', dataset: c.dataset, results, result_count: results.length, payload_shape: payloadShape };"""
if old not in bridge:
    if 'payload_shape: payloadShape' not in bridge:
        raise RuntimeError('COGNEE_RECALL_PARSER_ANCHOR_NOT_FOUND')
else:
    bridge = bridge.replace(old, new, 1)
bridge_path.write_text(bridge, encoding='utf-8')

worker = worker_path.read_text(encoding='utf-8')
import_anchor = "import { memoryBrainStatus, writeVictorMemory, recallVictorMemory } from './memory_brain.mjs';"
import_new = import_anchor + "\nimport { cogneeRecall } from './cognee_memory_bridge.mjs';"
if "import { cogneeRecall } from './cognee_memory_bridge.mjs';" not in worker:
    if import_anchor not in worker:
        raise RuntimeError('MEMORY_BRAIN_IMPORT_ANCHOR_NOT_FOUND')
    worker = worker.replace(import_anchor, import_new, 1)

fact_anchor = "      if (!memoryDirective && shouldUseFactGateway(founderRequest, factRequest)) {"
if "LIVE_COGNEE_RECALL_DIAGNOSTIC" not in worker:
    if fact_anchor not in worker:
        raise RuntimeError('FACT_GATEWAY_ANCHOR_NOT_FOUND')
    block = r'''      const explicitMemoryRecallDiagnostic = /\b(memory recall diagnostic|cognee recall diagnostic|debug memory recall)\b/i.test(text);
      if (!memoryDirective && explicitMemoryRecallDiagnostic) {
        processingStage = 'LIVE_COGNEE_RECALL_DIAGNOSTIC';
        const diagnosticQuery = text
          .replace(/\b(memory recall diagnostic|cognee recall diagnostic|debug memory recall)\b/ig, '')
          .replace(/^\s*[:\-]\s*/, '')
          .trim() || 'Falcon validation code';
        const result = await cogneeRecall(env, diagnosticQuery, { topK: 5, timeoutMs: 10000 });
        const reply = [
          'Cognee recall diagnostic',
          `Status: ${result.status || 'unknown'}`,
          `Dataset: ${result.dataset || 'unknown'}`,
          `Result count: ${Array.isArray(result.results) ? result.results.length : Number(result.result_count || 0)}`,
          `Payload shape: ${result.payload_shape || 'n/a'}`,
          `HTTP status: ${result.http_status || 'n/a'}`,
          `Reason: ${result.reason || 'n/a'}`,
          'Secrets exposed: no',
        ].join('\n');
        await sendTelegramMessage(env, chatId, reply, message.message_id);
        return json({
          ok: result.status === 'RECALLED',
          mode: 'LIVE_COGNEE_RECALL_DIAGNOSTIC',
          status: result.status || 'unknown',
          dataset: result.dataset || null,
          result_count: Array.isArray(result.results) ? result.results.length : Number(result.result_count || 0),
          payload_shape: result.payload_shape || null,
          http_status: result.http_status || null,
          reason: result.reason || null,
          secrets_exposed: false,
        }, 200);
      }

'''
    worker = worker.replace(fact_anchor, block + fact_anchor, 1)
worker_path.write_text(worker, encoding='utf-8')

print('COGNEE_RECALL_DIAGNOSTIC_APPLIED')
