#!/usr/bin/env python3
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SNAPSHOT = DATA / "control_room_snapshot.json"
LIVE = DATA / "control_room_live_evidence.json"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def freshness(ts):
    if not ts:
        return {"timestamp": None, "state": "UNKNOWN"}
    try:
        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        age = max(0, (datetime.now(timezone.utc) - dt.astimezone(timezone.utc)).total_seconds())
        return {"timestamp": ts, "age_seconds": int(age), "state": "FRESH" if age <= 3600 else "STALE"}
    except Exception:
        return {"timestamp": ts, "state": "INVALID"}


def remove_unresolved(items, *codes):
    blocked = set(codes)
    return [x for x in items if x not in blocked]


def main() -> int:
    snapshot = read_json(SNAPSHOT)
    live = read_json(LIVE)
    conversation = live.get("conversation_state") or {}
    heartbeat = live.get("heartbeat") or {}
    runtime_truth = live.get("runtime_truth_probe") or {}
    live_memory = live.get("live_memory_state") or {}

    conversation_freshness = freshness(conversation.get("updated_at_utc"))
    heartbeat_freshness = freshness(heartbeat.get("observed_at_utc"))
    runtime_truth_freshness = freshness(runtime_truth.get("observed_at_utc"))
    memory_freshness = freshness(live_memory.get("observed_at_utc"))

    unresolved = list((snapshot.get("truthfulness") or {}).get("unresolved_surfaces") or [])

    snapshot.setdefault("live_evidence", {})
    snapshot["live_evidence"].update({
        "source": live.get("source", "UNKNOWN"),
        "captured_at_utc": live.get("captured_at_utc"),
        "conversation_state_freshness": conversation_freshness,
        "heartbeat_freshness": heartbeat_freshness,
        "runtime_truth_freshness": runtime_truth_freshness,
        "memory_freshness": memory_freshness,
        "evidence_boundary": live.get("evidence_boundary") or {},
    })

    if conversation_freshness.get("state") == "FRESH":
        snapshot["task"] = {
            **(snapshot.get("task") or {}),
            "target": conversation.get("active_target"),
            "last_status": conversation.get("task_state", "UNKNOWN"),
            "last_task_id": conversation.get("last_task_id"),
            "last_task_type": conversation.get("last_task_type"),
            "active_topic": conversation.get("active_topic"),
            "active_issue": conversation.get("active_issue"),
            "last_attempt": conversation_freshness,
            "currentness": "CURRENT",
            "source": "Cloudflare KV conversation state",
        }
        execution = snapshot.setdefault("department_execution", {})
        execution["dispatch"] = {
            "status": "CURRENT",
            "target": conversation.get("active_target"),
            "task_id": conversation.get("last_task_id"),
            "task_type": conversation.get("last_task_type"),
            "task_state": conversation.get("task_state"),
            "observed_at_utc": conversation.get("updated_at_utc"),
            "freshness": conversation_freshness,
            "source": "Cloudflare KV conversation state",
        }
        if conversation.get("current_result_verified") is True:
            execution["result"] = {
                "status": "CURRENT",
                "verified": True,
                "result": conversation.get("current_result"),
                "observed_at_utc": conversation.get("updated_at_utc"),
                "freshness": conversation_freshness,
                "source": "Verified department result direct read",
            }
            unresolved = remove_unresolved(unresolved, "CURRENT_DEPARTMENT_RESULT_NOT_VERIFIED")
        else:
            execution["result"] = {
                "status": "NOT_VERIFIED",
                "verified": False,
                "result": None,
                "observed_at_utc": conversation.get("updated_at_utc"),
                "freshness": conversation_freshness,
                "source": "Cloudflare KV conversation state",
                "truth_note": "A current dispatch exists, but a current verified department result is not present in this live evidence receipt.",
            }
            if "CURRENT_DEPARTMENT_RESULT_NOT_VERIFIED" not in unresolved:
                unresolved.append("CURRENT_DEPARTMENT_RESULT_NOT_VERIFIED")
        unresolved = remove_unresolved(unresolved, "CURRENT_DEPARTMENT_DISPATCH_NOT_VERIFIED")

    if heartbeat_freshness.get("state") == "FRESH":
        watchdog = snapshot.setdefault("watchdog_retry", {}).setdefault("watchdog", {})
        watchdog.update({
            "current_runtime_state": heartbeat.get("status", "UNKNOWN"),
            "runtime_ready": heartbeat.get("runtime_ready"),
            "required_http_ok": heartbeat.get("required_http_ok"),
            "founder_command_boundary_intact": heartbeat.get("founder_command_boundary_intact"),
            "observed_at_utc": heartbeat.get("observed_at_utc"),
            "freshness": heartbeat_freshness,
            "source": "Cloudflare Step-13 heartbeat KV",
        })
        evidence = snapshot.setdefault("evidence_freshness", {})
        evidence["live_step13_heartbeat"] = {
            "status": heartbeat.get("status", "UNKNOWN"),
            "freshness": heartbeat_freshness,
            "runtime_ready": heartbeat.get("runtime_ready"),
            "required_http_ok": heartbeat.get("required_http_ok"),
            "source": "Cloudflare Step-13 heartbeat KV",
        }
        authority = snapshot.setdefault("autonomy_authority", {})
        authority.update({
            "production_autonomy_enabled": heartbeat.get("production_autonomy_enabled"),
            "allowed_trigger": heartbeat.get("consequential_execution_trigger", "UNKNOWN"),
            "live_boundary_verified": heartbeat.get("founder_command_boundary_intact"),
            "freshness": heartbeat_freshness,
            "source": "Cloudflare Step-13 heartbeat KV",
        })
        unresolved = remove_unresolved(
            unresolved,
            "CURRENT_WATCHDOG_RUNTIME_STATE_NOT_PERSISTED",
            "AUTONOMY_STATE_NOT_FRESH",
            "RELIABILITY_FILE_NOT_FRESH_LIVE_HEARTBEAT_EXTERNAL",
        )

    action_contract = runtime_truth.get("action_contract") or {}
    procedure_use = runtime_truth.get("procedure_use") or {}
    if runtime_truth_freshness.get("state") == "FRESH" and runtime_truth.get("status") == "PASS":
        if action_contract.get("instance_verified") is True:
            snapshot["action_contract"] = {
                **(snapshot.get("action_contract") or {}),
                "current_instance_status": "CURRENT_VERIFIED_DIAGNOSTIC",
                "current_instance": action_contract,
                "observed_at_utc": runtime_truth.get("observed_at_utc"),
                "freshness": runtime_truth_freshness,
                "source": f"GitHub Actions run {runtime_truth.get('github_run_id')}",
                "truth_note": "Fresh bounded diagnostic Action Contract verified. It is not evidence of a production/public/commercial action.",
            }
            unresolved = remove_unresolved(unresolved, "CURRENT_ACTION_CONTRACT_INSTANCE_NOT_PERSISTED")
        if procedure_use.get("verified") is True:
            snapshot["procedure_use"] = {
                **(snapshot.get("procedure_use") or {}),
                "current_procedure_status": "CURRENT_VERIFIED_DIAGNOSTIC",
                "current_procedure_id": procedure_use.get("procedure_id"),
                "current_procedure_version": procedure_use.get("procedure_version"),
                "execution_reason": procedure_use.get("reason"),
                "steps": procedure_use.get("steps") or [],
                "observed_at_utc": runtime_truth.get("observed_at_utc"),
                "freshness": runtime_truth_freshness,
                "source": f"GitHub Actions run {runtime_truth.get('github_run_id')}",
                "truth_note": "Fresh verified procedure-use diagnostic. It does not claim production autonomy or business execution.",
            }
            unresolved = remove_unresolved(unresolved, "CURRENT_PROCEDURE_USE_NOT_PERSISTED")

    if memory_freshness.get("state") == "FRESH" and live_memory.get("status") == "PASS" and live_memory.get("memory_read_verified") is True:
        memory_state = snapshot.setdefault("memory_state", {})
        memory_state.update({
            "current_runtime_read_or_write": "READ_VERIFIED_WRITE_NOT_VERIFIED",
            "durable_binding_verified": live_memory.get("durable_binding_verified"),
            "binding": live_memory.get("binding"),
            "memory_read_verified": True,
            "memory_write_verified": live_memory.get("memory_write_verified") is True,
            "found": live_memory.get("found"),
            "state_updated_at_utc": live_memory.get("state_updated_at_utc"),
            "observed_at_utc": live_memory.get("observed_at_utc"),
            "freshness": memory_freshness,
            "source": f"Cloudflare KV direct read via GitHub Actions run {live_memory.get('github_run_id')}",
            "truth_note": "Durable memory read is freshly verified. Memory write remains explicitly unverified by this read-only probe.",
        })

    truth = snapshot.setdefault("truthfulness", {})
    step13_required = truth.get("step13_final_certification_required_before_step14_closure", True)
    if step13_required and "STEP13_FINAL_CERTIFICATION_REQUIRED" not in unresolved:
        unresolved.append("STEP13_FINAL_CERTIFICATION_REQUIRED")
    truth["unresolved_surfaces"] = unresolved
    truth["live_evidence_ingested"] = True
    truth["live_evidence_current"] = any(
        x.get("state") == "FRESH"
        for x in [conversation_freshness, heartbeat_freshness, runtime_truth_freshness, memory_freshness]
    )

    acceptance = snapshot.setdefault("acceptance", {})
    acceptance["step14_ready_for_final_acceptance"] = len(unresolved) == 0 and not step13_required
    acceptance["closure_claimed"] = False

    SNAPSHOT.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "STEP14_LIVE_EVIDENCE_APPLIED",
        "conversation_freshness": conversation_freshness,
        "heartbeat_freshness": heartbeat_freshness,
        "runtime_truth_freshness": runtime_truth_freshness,
        "memory_freshness": memory_freshness,
        "unresolved_surfaces": unresolved,
        "step13_final_certification_required": step13_required,
        "closure_claimed": False,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
