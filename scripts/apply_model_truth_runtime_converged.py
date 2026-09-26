from pathlib import Path
import subprocess
import sys

WORKER = Path('victor-telegram-worker/worker.js')
text = WORKER.read_text(encoding='utf-8')

# Current V2/evolved equivalents for the legacy model-truth migration.
# If all are present, rerunning the historical patch must be a safe no-op.
CURRENT_MARKERS = [
    "import { callVictorModel, callCogneeInference } from './model_router.mjs';",
    "import { detectDeadEndLoop, buildDeadEndRecoveryPrompt, buildNonRepetitionDirective } from '../brain/anti_bogus_runtime.mjs';",
    "model_router: 'BEDROCK_DISCOVERY_SPECIALIST_V1'",
    "anti_bogus_runtime: 'DEAD_END_RECOVERY_V1'",
    "response_integrity: 'INDEPENDENT_EVIDENCE_LOCK_V1'",
    "cognee_inference_credential_configured: Boolean(env.COGNEE_API_KEY)",
    "cognee_inference_runtime: 'COGNEE_CLOUD_MEMORY_API_V2'",
    "${buildNonRepetitionDirective(activeSession)}",
    "INDEPENDENT RESPONSE INTEGRITY LOCK — MANDATORY:",
]

missing = [marker for marker in CURRENT_MARKERS if marker not in text]
if not missing:
    print('NO_CHANGES_ALREADY_APPLIED:MODEL_TRUTH_RUNTIME_CONVERGED')
    raise SystemExit(0)

print('MODEL_TRUTH_RUNTIME_LEGACY_FALLBACK_MISSING:' + ','.join(str(i) for i in range(len(missing))))
result = subprocess.run([sys.executable, 'scripts/apply_model_truth_runtime.py'])
raise SystemExit(result.returncode)
