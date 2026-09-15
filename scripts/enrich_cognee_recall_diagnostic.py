from pathlib import Path

worker_path = Path('victor-telegram-worker/worker.js')
worker = worker_path.read_text(encoding='utf-8')

old = """        const result = await cogneeRecall(env, diagnosticQuery, { topK: 5, timeoutMs: 10000 });\n        const reply = [\n          'Cognee recall diagnostic',\n          `Status: ${result.status || 'unknown'}`,\n          `Dataset: ${result.dataset || 'unknown'}`,\n          `Result count: ${Array.isArray(result.results) ? result.results.length : Number(result.result_count || 0)}`,\n          `Payload shape: ${result.payload_shape || 'n/a'}`,\n          `HTTP status: ${result.http_status || 'n/a'}`,\n          `Reason: ${result.reason || 'n/a'}`,\n          'Secrets exposed: no',\n        ].join('\\n');"""

new = """        const result = await cogneeRecall(env, diagnosticQuery, { topK: 5, timeoutMs: 10000 });\n        const diagnosticResults = Array.isArray(result.results) ? result.results : [];\n        const serializedResults = JSON.stringify(diagnosticResults).toLowerCase();\n        const firstResult = diagnosticResults[0];\n        const firstResultType = Array.isArray(firstResult) ? 'array' : typeof firstResult;\n        const firstResultKeys = firstResult && typeof firstResult === 'object' && !Array.isArray(firstResult)\n          ? Object.keys(firstResult).slice(0, 12).join(',')\n          : 'n/a';\n        const containsFalcon = serializedResults.includes('falcon');\n        const containsExpectedCode = serializedResults.includes('cf-914-vg');\n        const reply = [\n          'Cognee recall diagnostic',\n          `Status: ${result.status || 'unknown'}`,\n          `Dataset: ${result.dataset || 'unknown'}`,\n          `Result count: ${diagnosticResults.length || Number(result.result_count || 0)}`,\n          `Payload shape: ${result.payload_shape || 'n/a'}`,\n          `First result type: ${firstResultType}`,\n          `First result keys: ${firstResultKeys}`,\n          `Contains Falcon: ${containsFalcon ? 'yes' : 'no'}`,\n          `Contains expected code: ${containsExpectedCode ? 'yes' : 'no'}`,\n          `HTTP status: ${result.http_status || 'n/a'}`,\n          `Reason: ${result.reason || 'n/a'}`,\n          'Secrets exposed: no',\n        ].join('\\n');"""

if old not in worker:
    if 'Contains expected code:' not in worker:
        raise RuntimeError('RECALL_DIAGNOSTIC_ANCHOR_NOT_FOUND')
else:
    worker = worker.replace(old, new, 1)

old_json = """          result_count: Array.isArray(result.results) ? result.results.length : Number(result.result_count || 0),\n          payload_shape: result.payload_shape || null,"""
new_json = """          result_count: diagnosticResults.length || Number(result.result_count || 0),\n          payload_shape: result.payload_shape || null,\n          first_result_type: firstResultType,\n          first_result_keys: firstResultKeys,\n          contains_falcon: containsFalcon,\n          contains_expected_code: containsExpectedCode,"""
if old_json in worker:
    worker = worker.replace(old_json, new_json, 1)
elif 'contains_expected_code: containsExpectedCode' not in worker:
    raise RuntimeError('RECALL_DIAGNOSTIC_JSON_ANCHOR_NOT_FOUND')

worker_path.write_text(worker, encoding='utf-8')
print('COGNEE_RECALL_DIAGNOSTIC_ENRICHED')
