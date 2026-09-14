from pathlib import Path
import runpy

# Canonical compatibility entrypoint.
# The historical Cognee circuit-breaker generator encoded an obsolete provider
# contract (legacy VICTOR_COGNEE_API, generic api.cognee.ai fallback, and no
# tenant header on memory writes). Keep this filename because the Victor Brain
# workflow invokes it, but delegate to the single governed Cognee/Memory Brain
# contract so concurrent workflows cannot revert the corrected runtime.

contract = Path('scripts/apply_cognee_tenant_contract.py')
if not contract.exists():
    raise SystemExit('COGNEE_TENANT_CONTRACT_SCRIPT_MISSING')

runpy.run_path(str(contract), run_name='__main__')
