from pathlib import Path
import re

router_path = Path('victor-telegram-worker/model_router.mjs')
bridge_path = Path('victor-telegram-worker/cognee_memory_bridge.mjs')
worker_path = Path('victor-telegram-worker/worker.js')
router_test_path = Path('victor-telegram-worker/model_router.test.mjs')
bridge_test_path = Path('victor-telegram-worker/cognee_memory_bridge.test.mjs')

# ---------------------------------------------------------------------------
# Cognee Cloud tenant contract
# - tenant-specific base URL from COGNEE_SERVICE_URL
# - X-Api-Key ONLY from dedicated COGNEE_API_KEY
# - X-Tenant-Id from COGNEE_TENANT_ID
# - never route Cognee through Bedrock/API_VICTOR or legacy VICTOR_COGNEE_API
# - use a dedicated auth-breaker namespace for this corrected credential contract
# ---------------------------------------------------------------------------
router = router_path.read_text(encoding='utf-8')

router = router.replace(
    "const COGNEE_AUTH_BREAKER_KEY = 'victor:cognee:auth-breaker:v1';",
    "const COGNEE_AUTH_BREAKER_KEY = 'victor:cognee:auth-breaker:v3';",
)
router = router.replace(
    "const COGNEE_AUTH_BREAKER_KEY = 'victor:cognee:auth-breaker:v2';",
    "const COGNEE_AUTH_BREAKER_KEY = 'victor:cognee:auth-breaker:v3';",
)
router = router.replace(
    "new Error('Cognee inference auth is blocked until VICTOR_COGNEE_API changes')",
    "new Error('Cognee auth is blocked for the current dedicated Cognee credential and tenant contract')",
)
router = router.replace(
    "new Error('Cognee auth is blocked for the current credential and tenant contract')",
    "new Error('Cognee auth is blocked for the current dedicated Cognee credential and tenant contract')",
)
router = router.replace(
    "const apiKey = env.VICTOR_COGNEE_API || env.COGNEE_API_KEY || '';",
    "const apiKey = env.COGNEE_API_KEY || '';",
)
router = router.replace(
    "credential_source: env.VICTOR_COGNEE_API ? 'VICTOR_COGNEE_API' : 'COGNEE_API_KEY',",
    "credential_source: 'COGNEE_API_KEY',",
)
router = router.replace(
    "base: String(env.COGNEE_SERVICE_URL || 'https://api.cognee.ai').replace(/\\/$/, ''),",
    "base: String(env.COGNEE_SERVICE_URL || '').replace(/\\/$/, ''),",
)
router = router.replace(
    "  const base = String(options.base || env.COGNEE_SERVICE_URL || 'https://api.cognee.ai').replace(/\\/$/, '');\n  let response;",
    "  const base = String(options.base || env.COGNEE_SERVICE_URL || '').replace(/\\/$/, '');\n  const tenantId = String(env.COGNEE_TENANT_ID || '').trim();\n  if (!base) {\n    throw Object.assign(new Error('Cognee tenant service URL is not configured'), { code: 'COGNEE_SERVICE_URL_MISSING' });\n  }\n  if (!tenantId) {\n    throw Object.assign(new Error('Cognee tenant ID is not configured'), { code: 'COGNEE_TENANT_ID_MISSING' });\n  }\n  let response;",
)
router = router.replace(
    "        'X-Api-Key': apiKey,\n        Accept: 'application/json',",
    "        'X-Api-Key': apiKey,\n        'X-Tenant-Id': tenantId,\n        Accept: 'application/json',",
)
router_path.write_text(router, encoding='utf-8')

# Keep the bridge on the dedicated Cognee credential only and clean legacy duplicates.
bridge = bridge_path.read_text(encoding='utf-8')
bridge = bridge.replace(
    "    apiKey: env.COGNEE_API_KEY || env.VICTOR_COGNEE_API || '',",
    "    apiKey: env.COGNEE_API_KEY || '',",
)
bridge = bridge.replace(
    "    inferenceApiKey: env.VICTOR_COGNEE_API || '',",
    "    inferenceApiKey: env.COGNEE_API_KEY || '',",
)
bridge = bridge.replace(
    "if (!c.inferenceApiKey) return { status: 'PENDING_CONFIGURATION', reason: 'VICTOR_COGNEE_API_NOT_CONFIGURED' };",
    "if (!c.inferenceApiKey) return { status: 'PENDING_CONFIGURATION', reason: 'COGNEE_API_KEY_NOT_CONFIGURED' };",
)
bridge = bridge.replace(
    "    tenantId: String(env.COGNEE_TENANT_ID || '').trim(),\n    tenantId: String(env.COGNEE_TENANT_ID || '').trim(),",
    "    tenantId: String(env.COGNEE_TENANT_ID || '').trim(),",
)
bridge = bridge.replace(
    "  if (!c.tenantId) return { status: 'PENDING_CONFIGURATION', reason: 'COGNEE_TENANT_ID_NOT_CONFIGURED' };\n  if (!c.tenantId) return { status: 'PENDING_CONFIGURATION', reason: 'COGNEE_TENANT_ID_NOT_CONFIGURED' };",
    "  if (!c.tenantId) return { status: 'PENDING_CONFIGURATION', reason: 'COGNEE_TENANT_ID_NOT_CONFIGURED' };",
)
bridge_path.write_text(bridge, encoding='utf-8')

# ---------------------------------------------------------------------------
# Memory Brain V1 runtime wiring
# KV = active thread state, GitHub = canonical truth, Cognee = semantic LTM,
# structured Cloudflare logs = observability. Semantic failures are fail-open
# for normal conversation, but explicit remember commands never claim success
# unless the requested write path succeeds.
# ---------------------------------------------------------------------------
worker = worker_path.read_text(encoding='utf-8')

# Deploy-safety cleanup. Older generated patches left duplicate health keys and a
# second legacy Cognee diagnostic block in the same scope. Make this cleanup
# deterministic and idempotent so future generator runs cannot reintroduce the
# Cloudflare/esbuild redeclaration failure.
health_pattern = re.compile(
    r"(        cognee_inference_credential_configured: Boolean\(env\.COGNEE_API_KEY\),\n)"
    r"(?:        cognee_inference_runtime: '[^']+',\n)+"
)
worker, health_cleanup_count = health_pattern.subn(
    r"\1        cognee_inference_runtime: 'COGNEE_CLOUD_MEMORY_API_V2',\n",
    worker,
    count=1,
)
worker = worker.replace(
    "        cognee_auth_circuit_breaker: 'COGNEE_CLOUD_AUTH_401_403_HOLD_V2',",
    "        cognee_auth_circuit_breaker: 'COGNEE_CLOUD_AUTH_401_403_HOLD_V3',",
)
worker = worker.replace(
    "        if (!env.VICTOR_COGNEE_API && !env.COGNEE_API_KEY) {",
    "        if (!env.COGNEE_API_KEY) {",
    1,
)

legacy_marker = "      const explicitCogneeInferenceDiagnostic = /\\b(cognee inference|cognee smoke|victor_cognee_api|cognee api|test cognee)\\b/i.test(text);"
legacy_positions = [m.start() for m in re.finditer(re.escape(legacy_marker), worker)]
if len(legacy_positions) > 1:
    legacy_start = legacy_positions[1]
    legacy_end_marker = "\n      if (!memoryDirective && shouldUseFactGateway(founderRequest, factRequest)) {"
    legacy_end = worker.find(legacy_end_marker, legacy_start)
    if legacy_end == -1:
        raise RuntimeError('WORKER_LEGACY_COGNEE_BLOCK_END_NOT_FOUND')
    worker = worker[:legacy_start] + worker[legacy_end + 1:]
elif len(legacy_positions) == 0:
    raise RuntimeError('WORKER_COGNEE_DIAGNOSTIC_ANCHOR_NOT_FOUND')

memory_import = "import { memoryBrainStatus, writeVictorMemory, recallVictorMemory } from './memory_brain.mjs';"
if memory_import not in worker:
    anchor = "import { callVictorModel, callCogneeInference } from './model_router.mjs';"
    if anchor not in worker:
        raise RuntimeError('WORKER_MODEL_ROUTER_IMPORT_ANCHOR_NOT_FOUND')
    worker = worker.replace(anchor, f"{anchor}\n{memory_import}", 1)

worker = worker.replace(
    "cognee_inference_credential_configured: Boolean(env.VICTOR_COGNEE_API),",
    "cognee_inference_credential_configured: Boolean(env.COGNEE_API_KEY),",
)
if "memory_brain: memoryBrainStatus(env)," not in worker:
    anchor = "memory_write_configured: Boolean(env.GITHUB_MEMORY_TOKEN),"
    if anchor not in worker:
        raise RuntimeError('WORKER_HEALTH_MEMORY_ANCHOR_NOT_FOUND')
    worker = worker.replace(anchor, f"{anchor}\n        memory_brain: memoryBrainStatus(env),", 1)

old_memory_write = """          memoryWrite = await persistExplicitFounderMemory(env, text, {
            chatId,
            messageId: message.message_id,
          });"""
new_memory_write = """          memoryWrite = await writeVictorMemory(env, text, {
            chatId,
            messageId: message.message_id,
            source: 'telegram',
          }, () => persistExplicitFounderMemory(env, text, {
            chatId,
            messageId: message.message_id,
          }));"""
if old_memory_write in worker:
    worker = worker.replace(old_memory_write, new_memory_write, 1)
elif new_memory_write not in worker:
    raise RuntimeError('WORKER_MEMORY_WRITE_ANCHOR_NOT_FOUND')

old_memory_recall = "  const memory = buildMemoryContext(userMessage, core.sourceRecords, 6);"
new_memory_recall = """  let memory = buildMemoryContext(userMessage, core.sourceRecords, 6);
  memory = await recallVictorMemory(env, userMessage, memory, { topK: 5 });"""
if old_memory_recall in worker:
    worker = worker.replace(old_memory_recall, new_memory_recall, 1)
elif new_memory_recall not in worker:
    # The current worker may have evolved from the original two-line patch into
    # an inline semantic-memory flow. Treat that as converged when the same
    # governed recall call is already wired to canonical memory context.
    evolved_memory_recall_markers = (
        "const semanticMemory = await recallVictorMemory(",
        "buildMemoryContext(userMessage, core.sourceRecords, 6)",
        "{ topK: 5 },",
    )
    if not all(marker in worker for marker in evolved_memory_recall_markers):
        raise RuntimeError('WORKER_MEMORY_RECALL_ANCHOR_NOT_FOUND')

# Hard guards: generator success must imply a deployable single diagnostic path.
if worker.count(legacy_marker) != 1:
    raise RuntimeError('WORKER_COGNEE_DIAGNOSTIC_NOT_UNIQUE')
if worker.count("cognee_inference_runtime:") != 1:
    raise RuntimeError('WORKER_COGNEE_RUNTIME_HEALTH_KEY_NOT_UNIQUE')

worker_path.write_text(worker, encoding='utf-8')

# Regression guards for dedicated Cognee credentials.
router_test = router_test_path.read_text(encoding='utf-8')
router_test = router_test.replace("VICTOR_COGNEE_API: 'test-key'", "COGNEE_API_KEY: 'test-key'")
router_test = router_test.replace("VICTOR_COGNEE_API: 'cognee-key'", "COGNEE_API_KEY: 'cognee-key'")
router_test = router_test.replace("VICTOR_COGNEE_API: 'bad-key'", "COGNEE_API_KEY: 'bad-key'")
router_test = router_test.replace("VICTOR_COGNEE_API: 'old-key'", "COGNEE_API_KEY: 'old-key'")
router_test = router_test.replace("VICTOR_COGNEE_API: 'new-key'", "COGNEE_API_KEY: 'new-key'")
if "ignores legacy VICTOR_COGNEE_API" not in router_test:
    router_test += "\n\ntest('Cognee ignores legacy VICTOR_COGNEE_API and uses dedicated COGNEE_API_KEY', async () => {\n  const originalFetch = globalThis.fetch;\n  let seenKey = '';\n  globalThis.fetch = async (_url, init = {}) => {\n    seenKey = init?.headers?.['X-Api-Key'] || '';\n    return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });\n  };\n  try {\n    const result = await callCogneeInference({\n      COGNEE_API_KEY: 'dedicated-cognee-key',\n      VICTOR_COGNEE_API: 'legacy-backbone-key',\n      COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai',\n      COGNEE_TENANT_ID: 'tenant-test',\n    });\n    assert.equal(result.credential_source, 'COGNEE_API_KEY');\n    assert.equal(seenKey, 'dedicated-cognee-key');\n  } finally {\n    globalThis.fetch = originalFetch;\n  }\n});\n"
router_test_path.write_text(router_test, encoding='utf-8')

bridge_test = bridge_test_path.read_text(encoding='utf-8')
if "tenant id" not in bridge_test.lower():
    bridge_test += "\n\ntest('enabled bridge requires tenant id after URL and API key', () => {\n  const status = cogneeMemoryStatus({\n    COGNEE_MEMORY_ENABLED: 'true',\n    COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai',\n    COGNEE_API_KEY: 'test-key',\n  });\n  assert.equal(status.reason, 'COGNEE_TENANT_ID_NOT_CONFIGURED');\n});\n"
bridge_test_path.write_text(bridge_test, encoding='utf-8')

print('COGNEE_MEMORY_BRAIN_CONTRACT_APPLIED')
