from pathlib import Path
import runpy

# Canonical compatibility entrypoint.
# Historical Cognee generators encoded earlier worker shapes. The runtime has
# since evolved to a tenant-scoped Cognee Cloud contract and Memory Brain V1.
# Treat the complete evolved capability set as converged so deployment remains
# idempotent; otherwise delegate to the governed tenant-contract migration.

worker_path = Path('victor-telegram-worker/worker.js')
router_path = Path('victor-telegram-worker/model_router.mjs')
bridge_path = Path('victor-telegram-worker/cognee_memory_bridge.mjs')
memory_brain_path = Path('victor-telegram-worker/memory_brain.mjs')

required_paths = [worker_path, router_path, bridge_path, memory_brain_path]
if not all(path.exists() for path in required_paths):
    raise SystemExit('COGNEE_RUNTIME_SOURCE_MISSING')

worker = worker_path.read_text(encoding='utf-8')
router = router_path.read_text(encoding='utf-8')
bridge = bridge_path.read_text(encoding='utf-8')
memory_brain = memory_brain_path.read_text(encoding='utf-8')

converged_markers = [
    "cognee_inference_credential_configured: Boolean(env.COGNEE_API_KEY)",
    "cognee_inference_runtime: 'COGNEE_CLOUD_MEMORY_API_V2'",
    "cognee_auth_circuit_breaker: 'COGNEE_CLOUD_AUTH_401_403_HOLD_V3'",
    "memory_brain: memoryBrainStatus(env)",
    "memoryBrainStatus, writeVictorMemory, recallVictorMemory",
    "const semanticMemory = await recallVictorMemory(",
    "COGNEE_AUTH_BREAKER_KEY = 'victor:cognee:auth-breaker:v3'",
    "const apiKey = env.COGNEE_API_KEY || ''",
    "const tenantId = String(env.COGNEE_TENANT_ID || '').trim()",
    "'X-Tenant-Id': tenantId",
    "apiKey: env.COGNEE_API_KEY || ''",
    "tenantId: String(env.COGNEE_TENANT_ID || '').trim()",
    "export async function recallVictorMemory(",
    "export async function writeVictorMemory(",
]

combined = '\n'.join([worker, router, bridge, memory_brain])
if all(marker in combined for marker in converged_markers):
    print('NO_CHANGES_ALREADY_APPLIED:COGNEE_TENANT_MEMORY_BRAIN_CONVERGED')
    raise SystemExit(0)

contract = Path('scripts/apply_cognee_tenant_contract.py')
if not contract.exists():
    raise SystemExit('COGNEE_TENANT_CONTRACT_SCRIPT_MISSING')

runpy.run_path(str(contract), run_name='__main__')
