#!/usr/bin/env python3
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = DATA / "control_room_snapshot.json"


def read_json(name: str, fallback=None):
    path = DATA / name
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {} if fallback is None else fallback


def freshness(ts):
    if not ts:
        return {"timestamp": None, "state": "UNKNOWN"}
    try:
        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        age = max(0, (datetime.now(timezone.utc) - dt.astimezone(timezone.utc)).total_seconds())
        return {"timestamp": ts, "age_seconds": int(age), "state": "FRESH" if age <= 3600 else "STALE"}
    except Exception:
        return {"timestamp": ts, "state": "INVALID"}


def main() -> int:
    canonical = read_json("canonical_status_index.json")
    autonomy = read_json("autonomy_state.json")
    goals = read_json("goal_runtime_state.json")
    departments = read_json("department_registry.json")
    revenue = read_json("revenue_outcomes.json")
    pause = read_json("emergency_pause_state.json")
    package6 = read_json("package6_reliability_state.json")

    active_goal_id = goals.get("active_goal_id")
    active_goal = (goals.get("goals") or {}).get(active_goal_id, {}) if active_goal_id else {}
    rev = revenue.get("verified_totals") or {}
    canonical_available = bool(canonical.get("precedence")) and canonical.get("schema_version") is not None
    department_records = departments.get("departments", departments.get("registry", departments))
    registry_available = isinstance(department_records, list) and len(department_records) > 0

    snapshot = {
        "schema_version": 1,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "truth_policy": "Missing evidence is UNKNOWN. Historical evidence cannot be presented as current live state. Engineering readiness is not business success.",
        "canonical": {
            "status": canonical.get("status") or ("INDEX_AVAILABLE" if canonical_available else "UNKNOWN"),
            "source": "data/canonical_status_index.json",
            "updated_at_utc": canonical.get("updated_at_utc"),
        },
        "objective": {
            "active_goal_id": active_goal_id,
            "runtime_status": goals.get("runtime_status", "UNKNOWN"),
            "state": active_goal.get("state", "UNKNOWN"),
            "attempts": active_goal.get("attempts"),
            "last_target": active_goal.get("last_target"),
            "recommended_department": active_goal.get("recommended_department"),
            "last_status": active_goal.get("last_status"),
            "last_next_action": active_goal.get("last_next_action"),
            "must_change_strategy": active_goal.get("must_change_strategy"),
            "last_progress_delta": active_goal.get("last_progress_delta"),
            "freshness": freshness(active_goal.get("last_attempt_at_utc")),
            "last_verified_progress": freshness(active_goal.get("last_verified_progress_at_utc")),
        },
        "autonomy": {
            "runtime_status": autonomy.get("runtime_status", "UNKNOWN"),
            "production_autonomy_enabled": autonomy.get("production_autonomy_enabled", False),
            "scheduler_bound": autonomy.get("scheduler_bound", False),
            "allowed_trigger": autonomy.get("allowed_trigger", "UNKNOWN"),
            "green_unattended_scope": ["repo.read", "evidence.read", "sandbox.execute"],
            "amber_mode": "GOVERNED_REVERSIBLE_ONLY",
            "red_mode": "FOUNDER_GATED",
        },
        "safety": {
            "emergency_pause_state": pause.get("state") or pause.get("status") or pause.get("system_state") or "UNKNOWN",
            "global_pause_active": pause.get("global_pause_active"),
            "package6_certification": package6.get("status", "UNKNOWN"),
            "package6_started_at_utc": package6.get("started_at_utc"),
            "package6_minimum_signals": package6.get("minimum_required_signals"),
            "package6_consequential_execution_trigger": package6.get("consequential_execution_trigger", "UNKNOWN"),
        },
        "departments": {
            "source": "data/department_registry.json",
            "registry_status": departments.get("status") or departments.get("overall_status") or ("REGISTRY_AVAILABLE" if registry_available else "UNKNOWN"),
            "records": department_records,
        },
        "business_outcome": {
            "source": "data/revenue_outcomes.json",
            "status": revenue.get("status", "UNKNOWN"),
            "qualified_leads": rev.get("qualified_leads", 0),
            "closed_won": rev.get("closed_won", 0),
            "payments_received": rev.get("payments_received", 0),
            "collected_revenue_inr": rev.get("collected_revenue_inr", 0.0),
            "event_count": len(revenue.get("events") or []),
            "verified": revenue.get("status") != "NO_VERIFIED_REVENUE_EVENT" and (rev.get("payments_received", 0) or 0) > 0,
        },
        "acceptance": {
            "control_room_truthful": True,
            "business_success_must_be_independently_verified": True,
            "unknown_when_missing": True,
        },
    }
    OUT.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(snapshot, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
