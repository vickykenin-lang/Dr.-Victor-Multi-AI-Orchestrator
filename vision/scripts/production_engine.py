#!/usr/bin/env python3
"""Vision Production House Engine. Unattended after Topic OK."""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))
ROOT = os.path.join(os.path.dirname(__file__), "..", "engine", "jobs")
GAPS_PATH = os.path.join(os.path.dirname(__file__), "..", "engine", "gaps.json")
STAGES = [
    "inbox", "intake", "development", "screenplay", "look_lock",
    "keyframes", "picture", "sound", "assembly", "delivery", "done",
]
NEXT = {STAGES[i]: STAGES[i + 1] for i in range(len(STAGES) - 1)}
GATE_MAP = {"topic_ok": "topic_ok", "look_ok": "look_ok", "master_ok": "master_ok"}


def now() -> str:
    return datetime.now(IST).isoformat()


def safe_id(raw: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", (raw or "").strip())[:40] or "JOB"


def job_dir(job_id: str) -> str:
    return os.path.join(ROOT, job_id)


def load_json(path: str, default):
    if not os.path.isfile(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str, data) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def write(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text if text.endswith("\n") else text + "\n")


def gap_for(stage: str) -> int:
    g = load_json(GAPS_PATH, {"default_sec": 60})
    return int(g.get(stage, g.get("default_sec", 60)))


def signal(job_id: str, cont: bool, stage: str, reason: str) -> None:
    save_json(
        os.path.join(job_dir(job_id), "run_signal.json"),
        {"continue": bool(cont), "gap_sec": gap_for(stage) if cont else 0, "stage": stage, "reason": reason, "updated": now()},
    )


def list_jobs() -> list[str]:
    if not os.path.isdir(ROOT):
        return []
    out = []
    for name in sorted(os.listdir(ROOT)):
        if os.path.isfile(os.path.join(ROOT, name, "state.json")):
            out.append(name)
    return out


def create_job(job_id: str, topic: str, length: str, language: str, platform: str) -> int:
    jd = job_dir(job_id)
    os.makedirs(os.path.join(jd, "qc"), exist_ok=True)
    os.makedirs(os.path.join(jd, "artifacts"), exist_ok=True)
    write(
        os.path.join(jd, "brief.md"),
        "\n".join([
            "# Brief",
            f"topic: {topic or '(empty)'}",
            f"length: {length}",
            f"language: {language}",
            f"platform: {platform}",
            "status: waiting Topic OK",
        ]),
    )
    save_json(os.path.join(jd, "state.json"), {
        "job_id": job_id,
        "stage": "inbox",
        "owner_gates": {"topic_ok": False, "look_ok": False, "master_ok": False},
        "retries": {},
        "last_director": None,
        "updated": now(),
    })
    signal(job_id, False, "inbox", "waiting Topic OK")
    print("created", job_id)
    return 0


def set_gate(job_id: str, gate: str) -> int:
    path = os.path.join(job_dir(job_id), "state.json")
    if not os.path.isfile(path):
        print("missing job", job_id)
        return 1
    state = load_json(path, {})
    state.setdefault("owner_gates", {})[gate] = True
    state["updated"] = now()
    save_json(path, state)
    signal(job_id, True, state.get("stage", "inbox"), f"gate {gate} set")
    print("gate", gate, "true")
    return 0


def director(stage: str, jd: str) -> dict:
    need = {
        "intake": ["brief.md"],
        "development": ["artifacts/development.md"],
        "screenplay": ["artifacts/screenplay.md", "artifacts/shot_plan.md"],
        "look_lock": ["artifacts/look_lock.md"],
        "keyframes": ["artifacts/keyframes.md"],
        "picture": ["artifacts/picture.md"],
        "sound": ["artifacts/sound.md"],
        "assembly": ["artifacts/assembly.md"],
        "delivery": ["artifacts/delivery.md"],
    }
    missing = [p for p in need.get(stage, []) if not os.path.isfile(os.path.join(jd, p))]
    if missing:
        return {"pass": False, "reason": "missing " + ",".join(missing), "must_fix": missing}
    if stage == "intake":
        brief = open(os.path.join(jd, "brief.md"), encoding="utf-8").read()
        if "topic: (empty)" in brief:
            return {"pass": False, "reason": "topic empty", "must_fix": ["brief.md"]}
    return {"pass": True, "reason": f"{stage} artifacts present", "must_fix": []}


def run_stage(job_id: str) -> int:
    jd = job_dir(job_id)
    state_path = os.path.join(jd, "state.json")
    if not os.path.isfile(state_path):
        print("missing job", job_id)
        return 1
    state = load_json(state_path, {})
    stage = state.get("stage", "inbox")
    gates = state.setdefault("owner_gates", {})
    print("job", job_id, "stage", stage)

    if stage == "done":
        signal(job_id, False, "done", "complete")
        return 0

    if stage == "inbox":
        if not gates.get("topic_ok"):
            signal(job_id, False, "inbox", "waiting Topic OK")
            state["last_director"] = {"pass": False, "reason": "inbox waits Topic OK"}
            state["updated"] = now()
            save_json(state_path, state)
            return 0
        state["stage"] = "intake"
        stage = "intake"

    templates = {
        "development": ("artifacts/development.md", "# Development\n\nlogline:\ntreatment:\ntone:\n"),
        "look_lock": ("artifacts/look_lock.md", "# Look lock\n\nsheets: pending\nwardrobe_lock: pending\n"),
        "keyframes": ("artifacts/keyframes.md", "# Keyframes\n\nshots: pending\nidentity_source: look_lock\n"),
        "picture": ("artifacts/picture.md", "# Picture\n\nspec: 16:9\nprompt_rule: using reference images; max 1000 chars\nstatus: pending worker\n"),
        "sound": ("artifacts/sound.md", "# Sound\n\nlines_source: screenplay\nstatus: pending worker\n"),
        "assembly": ("artifacts/assembly.md", "# Assembly\n\ncut: pending\nsubs: pending\nmaster: pending\n"),
        "delivery": ("artifacts/delivery.md", "# Delivery\n\nplatform_from_brief: yes\npackage: pending\n"),
    }
    if stage == "screenplay":
        write(os.path.join(jd, "artifacts/screenplay.md"), "# Screenplay\n\nscenes: pending\n")
        write(os.path.join(jd, "artifacts/shot_plan.md"), "# Shot plan\n\nshots: pending\n")
    elif stage in templates:
        rel, body = templates[stage]
        path = os.path.join(jd, rel)
        if not os.path.isfile(path):
            write(path, body)
    if stage == "look_lock":
        write(os.path.join(jd, "artifacts/identity_lock.json"), json.dumps({
            "frozen": True,
            "rule": "later stages cannot add a new face",
            "updated": now(),
        }, indent=2))
        gates["look_ok"] = True

    verdict = director(stage, jd)
    write(os.path.join(jd, "qc", f"{stage}.json"), json.dumps({"stage": stage, "checked_at": now(), **verdict}, indent=2))
    state["last_director"] = verdict
    retries = state.setdefault("retries", {})
    print("director", verdict)

    if verdict.get("pass"):
        nxt = NEXT.get(stage)
        if nxt:
            state["stage"] = nxt
            retries[stage] = 0
            print("advance to", nxt)
            signal(job_id, nxt != "done", stage, f"advanced to {nxt}")
        else:
            signal(job_id, False, stage, "no next")
        state["updated"] = now()
        save_json(state_path, state)
        return 0

    retries[stage] = int(retries.get(stage, 0)) + 1
    state["updated"] = now()
    save_json(state_path, state)
    if retries[stage] >= 2:
        signal(job_id, False, stage, "director failed twice")
        return 1
    signal(job_id, True, stage, "director fail retry")
    return 0


def scan_auto() -> int:
    codes = 0
    jobs = list_jobs()
    if not jobs:
        print("no jobs")
        return 0
    for job_id in jobs:
        print("scan", job_id)
        codes |= run_stage(job_id)
    return 0 if codes == 0 else 1


def main() -> int:
    action = (os.environ.get("ENGINE_ACTION") or "scan_auto").strip() or "scan_auto"
    job_id = safe_id(os.environ.get("JOB_ID") or "")
    os.makedirs(ROOT, exist_ok=True)
    if action == "create_job":
        if not job_id:
            print("JOB_ID required")
            return 1
        return create_job(
            job_id,
            (os.environ.get("TOPIC") or "").strip(),
            (os.environ.get("LENGTH") or "10min").strip(),
            (os.environ.get("LANGUAGE") or "Hinglish").strip(),
            (os.environ.get("PLATFORM") or "youtube").strip(),
        )
    if action in GATE_MAP:
        if not job_id:
            print("JOB_ID required")
            return 1
        return set_gate(job_id, GATE_MAP[action])
    if action == "scan_auto":
        return scan_auto()
    if action in ("run_stage", "auto"):
        if not job_id:
            return scan_auto()
        return run_stage(job_id)
    print("unknown action", action)
    return 1


if __name__ == "__main__":
    sys.exit(main())
