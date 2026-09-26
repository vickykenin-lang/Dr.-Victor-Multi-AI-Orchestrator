from pathlib import Path
import runpy

# Canonical compatibility entrypoint.
# The historical Cognee circuit-breaker generator encoded an obsolete provider
# contract. Prefer semantic capability convergence against the evolved runtime;
# only fall back to the legacy tenant-contract migration when a required
# capability is genuinely absent.

router = Path('victor-telegram-worker/model_router.mjs').read_text(encoding='utf-8')
bridge = Path('victor-telegram-worker/cognee_memory_bridge.mjs').read_text(encoding='utf-8')
worker = Path('victor-telegram-worker/worker.js').read_text(encoding='utf-8')

CAPABILITY_MARKERS = {
    'router_dedicated_key': "const apiKey = env.COGNEE_API_KEY || '';",
    'router_tenant_id': "const tenantId = String(env.COGNEE_TENANT_ID || '').trim();",
    'router_tenant_header': "'X-Tenant-Id': tenantId,",
    'router_no_generic_fallback': "String(env.COGNEE_SERVICE_URL || '').replace(/\\/$/, '')",
    'router_breaker_v3': "const COGNEE_AUTH_BREAKER_KEY = 'victor:cognee:auth-breaker:v3';",
    'bridge_dedicated_key': "apiKey: env.COGNEE_API_KEY || '',",
    'bridge_tenant_id': "tenantId: String(env.COGNEE_TENANT_ID || '').trim(),",
    'bridge_tenant_header': "'X-Tenant-Id': tenantId",
    'worker_memory_brain_import': "import { memoryBrainStatus, writeVictorMemory, recallVictorMemory } from './memory_brain.mjs';",
    'worker_memory_brain_health': "memory_brain: memoryBrainStatus(env),",
    'worker_dedicated_cognee_key': "cognee_inference_credential_configured: Boolean(env.COGNEE_API_KEY),",
    'worker_cognee_breaker_v3': "cognee_auth_circuit_breaker: 'COGNEE_CLOUD_AUTH_401_403_HOLD_V3',",
    'worker_semantic_recall': "const semanticMemory = await recallVictorMemory(",
    'worker_direct_fact_gate': "selectDirectRememberedFact(userMessage, semanticMemory.cogneeMemory, core.sourceRecords)",
}

sources = {
    'router': router,
    'bridge': bridge,
    'worker': worker,
}
marker_source = {
    'router_dedicated_key': 'router',
    'router_tenant_id': 'router',
    'router_tenant_header': 'router',
    'router_no_generic_fallback': 'router',
    'router_breaker_v3': 'router',
    'bridge_dedicated_key': 'bridge',
    'bridge_tenant_id': 'bridge',
    'bridge_tenant_header': 'bridge',
    'worker_memory_brain_import': 'worker',
    'worker_memory_brain_health': 'worker',
    'worker_dedicated_cognee_key': 'worker',
    'worker_cognee_breaker_v3': 'worker',
    'worker_semantic_recall': 'worker',
    'worker_direct_fact_gate': 'worker',
}
missing = [name for name, marker in CAPABILITY_MARKERS.items() if marker not in sources[marker_source[name]]]

if not missing:
    print('NO_CHANGES_ALREADY_APPLIED:COGNEE_TENANT_MEMORY_CONVERGED')
    raise SystemExit(0)

print('COGNEE_CONVERGENCE_GUARD_MISSING=' + ','.join(missing))
contract = Path('scripts/apply_cognee_tenant_contract.py')
if not contract.exists():
    raise SystemExit('COGNEE_TENANT_CONTRACT_SCRIPT_MISSING')

runpy.run_path(str(contract), run_name='__main__')
