from pathlib import Path

router_path = Path('victor-telegram-worker/model_router.mjs')
bridge_path = Path('victor-telegram-worker/cognee_memory_bridge.mjs')
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
    "    dataset: env.COGNEE_DATASET || 'victor_long_term_memory',",
    "    dataset: env.COGNEE_DATASET || 'victor_long_term_memory',\n    tenantId: String(env.COGNEE_TENANT_ID || '').trim(),",
)
bridge = bridge.replace(
    "function headers(apiKey) {\n  return {\n    'Content-Type': 'application/json',\n    Accept: 'application/json',\n    ...(apiKey ? { 'X-Api-Key': apiKey } : {}),\n  };\n}",
    "function headers(apiKey, tenantId) {\n  return {\n    'Content-Type': 'application/json',\n    Accept: 'application/json',\n    ...(apiKey ? { 'X-Api-Key': apiKey } : {}),\n    ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),\n  };\n}",
)
bridge = bridge.replace(
    "  if (!c.apiKey) return { status: 'PENDING_CONFIGURATION', reason: 'COGNEE_API_KEY_NOT_CONFIGURED' };",
    "  if (!c.apiKey) return { status: 'PENDING_CONFIGURATION', reason: 'COGNEE_API_KEY_NOT_CONFIGURED' };\n  if (!c.tenantId) return { status: 'PENDING_CONFIGURATION', reason: 'COGNEE_TENANT_ID_NOT_CONFIGURED' };",
)
bridge = bridge.replace(
    "      'X-Api-Key': c.apiKey,\n    },",
    "      'X-Api-Key': c.apiKey,\n      'X-Tenant-Id': c.tenantId,\n    },",
)
bridge = bridge.replace("headers: headers(c.apiKey),", "headers: headers(c.apiKey, c.tenantId),")
# Clean duplicate tenant lines created by earlier idempotent migrations.
bridge = bridge.replace(
    "    tenantId: String(env.COGNEE_TENANT_ID || '').trim(),\n    tenantId: String(env.COGNEE_TENANT_ID || '').trim(),",
    "    tenantId: String(env.COGNEE_TENANT_ID || '').trim(),",
)
bridge = bridge.replace(
    "  if (!c.tenantId) return { status: 'PENDING_CONFIGURATION', reason: 'COGNEE_TENANT_ID_NOT_CONFIGURED' };\n  if (!c.tenantId) return { status: 'PENDING_CONFIGURATION', reason: 'COGNEE_TENANT_ID_NOT_CONFIGURED' };",
    "  if (!c.tenantId) return { status: 'PENDING_CONFIGURATION', reason: 'COGNEE_TENANT_ID_NOT_CONFIGURED' };",
)
bridge_path.write_text(bridge, encoding='utf-8')

router_test = router_test_path.read_text(encoding='utf-8')
router_test = router_test.replace("VICTOR_COGNEE_API: 'test-key'", "COGNEE_API_KEY: 'test-key'")
router_test = router_test.replace("VICTOR_COGNEE_API: 'cognee-key'", "COGNEE_API_KEY: 'cognee-key'")
router_test = router_test.replace("VICTOR_COGNEE_API: 'bad-key'", "COGNEE_API_KEY: 'bad-key'")
router_test = router_test.replace("VICTOR_COGNEE_API: 'old-key'", "COGNEE_API_KEY: 'old-key'")
router_test = router_test.replace("VICTOR_COGNEE_API: 'new-key'", "COGNEE_API_KEY: 'new-key'")
# Explicit regression guard: legacy/AWS-like VICTOR_COGNEE_API must never win over dedicated Cognee key.
if "ignores legacy VICTOR_COGNEE_API" not in router_test:
    router_test += "\n\ntest('Cognee ignores legacy VICTOR_COGNEE_API and uses dedicated COGNEE_API_KEY', async () => {\n  const originalFetch = globalThis.fetch;\n  let seenKey = '';\n  globalThis.fetch = async (_url, init = {}) => {\n    seenKey = init?.headers?.['X-Api-Key'] || '';\n    return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });\n  };\n  try {\n    const result = await callCogneeInference({\n      COGNEE_API_KEY: 'dedicated-cognee-key',\n      VICTOR_COGNEE_API: 'legacy-backbone-key',\n      COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai',\n      COGNEE_TENANT_ID: 'tenant-test',\n    });\n    assert.equal(result.credential_source, 'COGNEE_API_KEY');\n    assert.equal(seenKey, 'dedicated-cognee-key');\n  } finally {\n    globalThis.fetch = originalFetch;\n  }\n});\n"
router_test_path.write_text(router_test, encoding='utf-8')

bridge_test = bridge_test_path.read_text(encoding='utf-8')
if "tenant id" not in bridge_test.lower():
    bridge_test += "\n\ntest('enabled bridge requires tenant id after URL and API key', () => {\n  const status = cogneeMemoryStatus({\n    COGNEE_MEMORY_ENABLED: 'true',\n    COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai',\n    COGNEE_API_KEY: 'test-key',\n  });\n  assert.equal(status.reason, 'COGNEE_TENANT_ID_NOT_CONFIGURED');\n});\n"
bridge_test_path.write_text(bridge_test, encoding='utf-8')

print('COGNEE_TENANT_CONTRACT_APPLIED')
