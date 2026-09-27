#!/usr/bin/env python3
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
MEMORY = ROOT / "memory"
BRAIN = ROOT / "brain"
OUT = DATA / "control_room_snapshot.json"


def read_json(path: Path, fallback=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {} if fallback is None else fallback


def file_present(path: Path) -> bool:
    try:
        return path.is_file() and path.stat().st_size > 0
    except Exception:
        return False


def freshness(ts):
    if not ts:
        return {"timestamp": None, "state": "UNKNOWN"}
    try:
        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        age = max(0, (datetime.now(timezone.utc) - dt.astimezone(timezone.utc)).total_seconds())
        return {"timestamp": ts, "age_seconds": int(age), "state": "FRESH" if age <= 3600 else "STALE"}
    except Exception:
        return {"timestamp": ts, "state": "INVALID"}


def status_from_freshness(value):
    state = (value or {}).get("state", "UNKNOWN")
    return "CURRENT" if state == "FRESH" else ("HISTORICAL" if state == "STALE" else "UNKNOWN")


def main() -> int:
    canonical = read_json(DATA / "canonical_status_index.json")
    autonomy = read_json(DATA / "autonomy_state.json")
    goals = read_json(DATA / "goal_runtime_state.json")
    departments = read_json(DATA / "department_registry.json")
    revenue = read_json(DATA / "revenue_outcomes.json")
    commercial = read_json(DATA / "package8_commercial_status.json")
    pause = read_json(DATA / "emergency_pause_state.json")
    package6 = read_json(DATA / "package6_reliability_state.json")
    memory_index = read_json(MEMORY / "memory_index.json")

    active_goal_id = goals.get("active_goal_id")
    active_goal = (goals.get("goals") or {}).get(active_goal_id, {}) if active_goal_id else {}
    rev = revenue.get("verified_totals") or commercial.get("verified_totals") or {}
    goal_attempt_freshness = freshness(active_goal.get("last_attempt_at_utc"))
    progress_freshness = freshness(active_goal.get("last_verified_progress_at_utc"))
    autonomy_freshness = freshness(autonomy.get("updated_at_utc") or (autonomy.get("current_live_evidence") or {}).get("verified_at_utc"))
    reliability_freshness = freshness(package6.get("started_at_utc"))
    commercial_freshness = freshness(commercial.get("verified_at_utc"))

    department_records = departments.get("departments", departments.get("registry", departments))
    registry_available = isinstance(department_records, list) and len(department_records) > 0

    current_dispatch_status = status_from_freshness(goal_attempt_freshness)
    current_result_status = status_from_freshness(progress_freshness)
    action_contract_source_present = file_present(BRAIN / "action_contract.mjs")
    procedure_registry_present = file_present(BRAIN / "procedure_registry.mjs")
    operational_memory_present = file_present(MEMORY / "operational_memory.jsonl")

    blocker = active_goal.get("last_root_cause") or (
        "STRATEGY_CHANGE_REQUIRED" if active_goal.get("must_change_strategy") is True else None
    )
    retry_count = active_goal.get("no_progress_count")
    if retry_count is None:
        retry_count = active_goal.get("same_recommendation_count")

    unresolved = []
    if current_dispatch_status != "CURRENT":
        unresolved.append("CURRENT_DEPARTMENT_DISPATCH_NOT_VERIFIED")
    if current_result_status != "CURRENT":
        unresolved.append("CURRENT_DEPARTMENT_RESULT_NOT_VERIFIED")
    if not action_contract_source_present:
        unresolved.append("ACTION_CONTRACT_SCHEMA_SOURCE_MISSING")
    unresolved.append("CURRENT_ACTION_CONTRACT_INSTANCE_NOT_PERSISTED")
    unresolved.append("CURRENT_WATCHDOG_RUNTIME_STATE_NOT_PERSISTED")
    unresolved.append("CURRENT_PROCEDURE_USE_NOT_PERSISTED")
    if not operational_memory_present:
        unresolved.append("OPERATIONAL_MEMORY_LEDGER_NOT_PRESENT")
    if autonomy_freshness.get("state") != "FRESH":
        unresolved.append("AUTONOMY_STATE_NOT_FRESH")
    if reliability_freshness.get("state") != "FRESH":
        unresolved.append("RELIABILITY_FILE_NOT_FRESH_LIVE_HEARTBEAT_EXTERNAL")

    snapshot = {
        "schema_version": 2,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "truth_policy": "Missing evidence is UNKNOWN/NOT_VERIFIED. Stale evidence is historical only. Engineering readiness is not business success. No control-room field may upgrade authority or outcome state.",
        "canonical": {
            "status": canonical.get("status") or ("INDEX_AVAILABLE" if canonical.get("schema_version") is not None else "UNKNOWN"),
            "source": "data/canonical_status_index.json",
            "updated_at_utc": canonical.get("updated_at_utc"),
            "freshness": freshness(canonical.get("updated_at_utc")),
        },
        "objective": {
            "active_goal_id": active_goal_id,
            "runtime_status": goals.get("runtime_status", "UNKNOWN"),
            "state": active_goal.get("state", "UNKNOWN"),
            "attempts": active_goal.get("attempts"),
            "last_verified_progress": progress_freshness,
        },
        "task": {
            "target": active_goal.get("last_target"),
            "recommended_department": active_goal.get("recommended_department"),
            "last_status": active_goal.get("last_status", "UNKNOWN"),
            "next_action": active_goal.get("last_next_action"),
            "last_attempt": goal_attempt_freshness,
            "currentness": current_dispatch_status,
        },
        "blocker": {
            "status": "PRESENT" if blocker else "NOT_VERIFIED",
            "code": blocker,
            "must_change_strategy": active_goal.get("must_change_strategy"),
            "last_progress_delta": active_goal.get("last_progress_delta"),
            "source": "data/goal_runtime_state.json",
            "freshness": goal_attempt_freshness,
        },
        "action_contract": {
            "schema_source": "brain/action_contract.mjs",
            "schema_source_present": action_contract_source_present,
            "current_instance_status": "NOT_VERIFIED",
            "current_instance": None,
            "truth_note": "The Action Contract schema exists, but no fresh persisted contract instance is available in the current control-room input set. Do not infer one from a target or phase.",
        },
        "department_execution": {
            "dispatch": {
                "status": current_dispatch_status,
                "target": active_goal.get("last_target"),
                "observed_at_utc": active_goal.get("last_attempt_at_utc"),
                "freshness": goal_attempt_freshness,
            },
            "result": {
                "status": current_result_status,
                "last_status": active_goal.get("last_status"),
                "observed_at_utc": active_goal.get("last_verified_progress_at_utc"),
                "freshness": progress_freshness,
            },
            "registry_source": "data/department_registry.json",
            "registry_status": departments.get("status") or departments.get("overall_status") or ("REGISTRY_AVAILABLE" if registry_available else "UNKNOWN"),
            "registry_records": department_records,
        },
        "evidence_freshness": {
            "goal_attempt": goal_attempt_freshness,
            "goal_progress": progress_freshness,
            "autonomy": autonomy_freshness,
            "reliability_file": reliability_freshness,
            "commercial": commercial_freshness,
            "live_step13_heartbeat": {
                "status": "EXTERNAL_RUNTIME_EVIDENCE_NOT_INGESTED_BY_THIS_BUILDER",
                "source": "Cloudflare KV step13:cloudflare-heartbeat:*",
            },
        },
        "watchdog_retry": {
            "watchdog": {
                "current_runtime_state": "NOT_VERIFIED",
                "fail_closed_action": package6.get("stale_or_failed_signal_action", "UNKNOWN"),
                "supervision_scope": package6.get("supervision_scope", "UNKNOWN"),
                "source": "data/package6_reliability_state.json",
            },
            "retry": {
                "no_progress_count": active_goal.get("no_progress_count"),
                "same_recommendation_count": active_goal.get("same_recommendation_count"),
                "same_failure_count": active_goal.get("same_failure_count"),
                "observed_retry_or_no_progress_count": retry_count,
                "must_change_strategy": active_goal.get("must_change_strategy"),
                "source": "data/goal_runtime_state.json",
                "freshness": goal_attempt_freshness,
            },
        },
        "procedure_use": {
            "registry_source": "brain/procedure_registry.mjs",
            "registry_source_present": procedure_registry_present,
            "current_procedure_status": "NOT_VERIFIED",
            "current_procedure_id": None,
            "truth_note": "Verified procedures exist in source, but current runtime procedure use is not persisted in the control-room input set.",
        },
        "memory_state": {
            "engine": memory_index.get("engine", "UNKNOWN"),
            "storage_mode": memory_index.get("storage_mode", "UNKNOWN"),
            "operational_ledger_present": operational_memory_present,
            "memory_is_business_evidence": (memory_index.get("semantic_rules") or {}).get("memory_is_business_evidence"),
            "fresh_evidence_required_for_external_claims": (memory_index.get("semantic_rules") or {}).get("fresh_evidence_required_for_external_claims"),
            "current_runtime_read_or_write": "NOT_VERIFIED",
            "source": "memory/memory_index.json",
        },
        "autonomy_authority": {
            "runtime_status": autonomy.get("runtime_status", "UNKNOWN"),
            "production_autonomy_enabled": autonomy.get("production_autonomy_enabled", False),
            "scheduler_bound": autonomy.get("scheduler_bound", False),
            "allowed_trigger": autonomy.get("allowed_trigger", "UNKNOWN"),
            "green": (autonomy.get("autonomy_rollout_state") or {}).get("green", "UNKNOWN"),
            "amber": (autonomy.get("autonomy_rollout_state") or {}).get("amber", "UNKNOWN"),
            "red": (autonomy.get("autonomy_rollout_state") or {}).get("red", "FOUNDER_GATED"),
            "freshness": autonomy_freshness,
            "truth_note": "This file is historical if stale; fresh runtime evidence controls current authority.",
        },
        "commercial_outcome": {
            "source": "data/package8_commercial_status.json",
            "status": commercial.get("status", revenue.get("status", "UNKNOWN")),
            "verified_business_outcome": commercial.get("verified_business_outcome", False),
            "qualified_leads": rev.get("qualified_leads", 0),
            "closed_won": rev.get("closed_won", 0),
            "payments_received": rev.get("payments_received", 0),
            "collected_revenue_inr": rev.get("collected_revenue_inr", 0.0),
            "current_external_evidence_state": commercial.get("current_external_evidence_state", "UNKNOWN"),
            "freshness": commercial_freshness,
        },
        "safety": {
            "emergency_pause_state": pause.get("state") or pause.get("status") or pause.get("system_state") or "UNKNOWN",
            "global_pause_active": pause.get("global_pause_active"),
            "package6_certification": package6.get("status", "UNKNOWN"),
            "package6_final_certification": package6.get("final_certification", "UNKNOWN"),
            "consequential_execution_trigger": package6.get("consequential_execution_trigger", "UNKNOWN"),
        },
        "truthfulness": {
            "step14_pre_audit_only": True,
            "step13_final_certification_required_before_step14_closure": True,
            "unresolved_surfaces": unresolved,
            "stale_data_present": any(x.get("state") == "STALE" for x in [goal_attempt_freshness, progress_freshness, autonomy_freshness, reliability_freshness, commercial_freshness]),
            "unknown_is_not_pass": True,
        },
        "acceptance": {
            "step14_ready_for_final_acceptance": len(unresolved) == 0,
            "business_success_must_be_independently_verified": True,
            "unknown_when_missing": True,
            "closure_claimed": False,
        },
    }
    OUT.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(snapshot, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
