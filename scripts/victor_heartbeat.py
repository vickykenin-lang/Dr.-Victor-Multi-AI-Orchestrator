#!/usr/bin/env python3
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOUL = ROOT / "VICTOR_SOUL.md"
CHARTER = ROOT / "VICTOR_EXECUTIVE_CHARTER.md"
RULES = ROOT / "VICTOR_MASTER_RULE_BOOK.md"
REGISTRY = ROOT / "data" / "department_registry.json"
SYSTEM_STATE = ROOT / "data" / "system_state.json"
RECONCILER = ROOT / "scripts" / "reconcile_system_state.py"
OUT = ROOT / "data" / "victor_heartbeat_status.json"

checks = {
    "soul_present": SOUL.exists() and SOUL.stat().st_size > 0,
    "executive_charter_present": CHARTER.exists() and CHARTER.stat().st_size > 0,
    "master_rules_present": RULES.exists() and RULES.stat().st_size > 0,
    "department_registry_present": REGISTRY.exists() and REGISTRY.stat().st_size > 0,
    "system_state_reconciler_present": RECONCILER.exists() and RECONCILER.stat().st_size > 0,
}

registry = {}
if checks["department_registry_present"]:
    try:
        registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
        checks["department_credentials_isolated"] = (
            registry.get("credential_policy") == "department_scoped_only"
            and registry.get("shared_secret_pool") is False
        )
    except Exception:
        checks["department_credentials_isolated"] = False
else:
    checks["department_credentials_isolated"] = False

reconcile_rc = None
if checks["system_state_reconciler_present"]:
    reconcile_rc = subprocess.run(
        [sys.executable, str(RECONCILER)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    ).returncode
checks["system_state_reconciled"] = reconcile_rc == 0 and SYSTEM_STATE.exists()

system_state = {}
if SYSTEM_STATE.exists():
    try:
        system_state = json.loads(SYSTEM_STATE.read_text(encoding="utf-8"))
    except Exception:
        system_state = {}

checks["victor_ai_ready"] = bool(system_state.get("victor", {}).get("ai_ready", False))
checks["telegram_verified"] = bool(
    system_state.get("communications", {}).get("telegram", {}).get("configured", False)
)
checks["canonical_state_declared"] = system_state.get("canonical") is True

ready = all(checks.values())
conflicts = system_state.get("conflicts", []) if isinstance(system_state.get("conflicts", []), list) else []
status = {
    "timestamp_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    "state": "READY_WITH_CONFLICTS" if ready and conflicts else ("READY" if ready else "SAFE_STOP"),
    "scheduled_interval_minutes": None,
    "role": "MANUAL_BACKUP_READINESS_RECONCILIATION",
    "checks": checks,
    "canonical_system_state": "data/system_state.json",
    "system_state_overall": system_state.get("overall_state", "UNKNOWN"),
    "telegram_configured": checks["telegram_verified"],
    "conflict_count": len(conflicts),
    "management_model": "Founder Vicky -> Dr. Victor -> all department AIs / department heads",
    "daily_report_required": True,
    "founder_meeting_local_time": "22:00",
    "reliability_supervision_owner": ".github/workflows/victor_package6_reliability_supervision.yml",
    "reliability_supervision_interval_minutes": 15,
    "consequential_execution_trigger": "founder-command",
    "production_autonomy_enabled": False,
    "note": "This script is manual backup readiness reconciliation only. Package 6 GitHub Actions owns the read-only 15-minute reliability supervision signal. The Cloudflare Worker remains event-driven for consequential execution and does not gain general production autonomy."
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")
print(json.dumps(status))
raise SystemExit(0 if ready else 1)
