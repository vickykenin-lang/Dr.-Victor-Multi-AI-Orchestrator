from pathlib import Path

router_path = Path('victor-telegram-worker/model_router.mjs')
bridge_path = Path('victor-telegram-worker/cognee_memory_bridge.mjs')
router_test_path = Path('victor-telegram-worker/model_router.test.mjs')
bridge_test_path = Path('victor-telegram-worker/cognee_memory_bridge.test.mjs')

# ---------------------------------------------------------------------------
# Cognee Cloud tenant contract
# - tenant-specific base URL from COGNEE_SERVICE_URL
# - X-Api-Key from existing Cognee secret
# - X-Tenant-Id from COGNEE_TENANT_ID
# - never route Cognee through Bedrock/API_VICTOR
# - use a new auth-breaker namespace so stale failures from the old/wrong
#   provider contract cannot suppress the first request on the corrected route
# ---------------------------------------------------------------------------
router = router_path.read_text(encoding='utf-8')

router = router.replace(
    "const COGNEE_AUTH_BREAKER_KEY = 'victor:cognee:auth-breaker:v1';",
    "const COGNEE_AUTH_BREAKER_KEY = 'victor:cognee:auth-breaker:v2';",
)
router = router.replace(
    "new Error('Cognee inference auth is blocked until VICTOR_COGNEE_API changes')",
    "new Error('Cognee auth is blocked for the current credential and tenant contract')",
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
bridge_path.write_text(bridge, encoding='utf-8')

router_test = router_test_path.read_text(encoding='utf-8')
router_test = router_test.replace(
    "const result = await resolveCogneeOpenAIModel({ VICTOR_COGNEE_API: 'test-key' });",
    "const result = await resolveCogneeOpenAIModel({ VICTOR_COGNEE_API: 'test-key', COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai' });",
)
router_test = router_test.replace(
    "const result = await callCogneeInference({ VICTOR_COGNEE_API: 'cognee-key', API_VICTOR: 'main-key' });",
    "const result = await callCogneeInference({ VICTOR_COGNEE_API: 'cognee-key', API_VICTOR: 'main-key', COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai', COGNEE_TENANT_ID: 'tenant-test' });",
)
router_test = router_test.replace(
    "authorization: init?.headers?.Authorization || '',",
    "authorization: init?.headers?.Authorization || '',\n      tenantId: init?.headers?.['X-Tenant-Id'] || '',",
)
router_test = router_test.replace(
    "assert.equal(seen[0].authorization, '');",
    "assert.equal(seen[0].authorization, '');\n    assert.equal(seen[0].tenantId, 'tenant-test');",
)
router_test = router_test.replace(
    "const env = { VICTOR_COGNEE_API: 'bad-key', VICTOR_CONVERSATION_STATE: store };",
    "const env = { VICTOR_COGNEE_API: 'bad-key', VICTOR_CONVERSATION_STATE: store, COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai', COGNEE_TENANT_ID: 'tenant-test' };",
)
router_test = router_test.replace(
    "callCogneeInference({ VICTOR_COGNEE_API: 'old-key', VICTOR_CONVERSATION_STATE: store }",
    "callCogneeInference({ VICTOR_COGNEE_API: 'old-key', VICTOR_CONVERSATION_STATE: store, COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai', COGNEE_TENANT_ID: 'tenant-test' }",
)
router_test = router_test.replace(
    "callCogneeInference({ VICTOR_COGNEE_API: 'new-key', VICTOR_CONVERSATION_STATE: store }",
    "callCogneeInference({ VICTOR_COGNEE_API: 'new-key', VICTOR_CONVERSATION_STATE: store, COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai', COGNEE_TENANT_ID: 'tenant-test' }",
)
router_test_path.write_text(router_test, encoding='utf-8')

bridge_test = bridge_test_path.read_text(encoding='utf-8')
bridge_test = bridge_test.replace(
    "assert.equal(status.reason, 'COGNEE_API_KEY_NOT_CONFIGURED');",
    "assert.equal(status.reason, 'COGNEE_API_KEY_NOT_CONFIGURED');",
)
if "tenant id" not in bridge_test.lower():
    bridge_test += "\n\ntest('enabled bridge requires tenant id after URL and API key', () => {\n  const status = cogneeMemoryStatus({\n    COGNEE_MEMORY_ENABLED: 'true',\n    COGNEE_SERVICE_URL: 'https://tenant-test.aws.cognee.ai',\n    COGNEE_API_KEY: 'test-key',\n  });\n  assert.equal(status.reason, 'COGNEE_TENANT_ID_NOT_CONFIGURED');\n});\n"
bridge_test_path.write_text(bridge_test, encoding='utf-8')

print('COGNEE_TENANT_CONTRACT_APPLIED')
