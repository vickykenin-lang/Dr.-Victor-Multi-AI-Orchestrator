#!/usr/bin/env python3
"""Vision Production House Engine. Process only. No story, no cast."""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))
ROOT = os.path.join(os.path.dirname(__file__), "..", "engine", "jobs")
STAGES = [
    "inbox",
    "intake",
    "development",
    "screenplay",
    "look_lock",
    "keyframes",
    "picture",
    "sound",
    "assembly",
    "delivery",
    "done",
]
NEXT = {STAGES[i]: STAGES[i + 1] for i in range(len(STAGES) - 1)}
GATE_MAP = {"topic_ok": "topic_ok", "look_ok": "look_ok", "master_ok": "master_ok"}


def now() -> str:
    return datetime.now(IST).isoformat()


def safe_id(raw: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", (raw or "").strip())
    return cleaned[:40] or "JOB"


def job_dir(job_id: str) -> str:
    return os.path.join(ROOT, job_id)


def load_state(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_state(path: str, state: dict) -> None:
    state["updated"] = now()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)
        f.write("\n")


def write(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text if text.endswith("\n") else text + "\n")


def qc_write(jd: str, stage: str, payload: dict) -> None:
    write(os.path.join(jd, "qc", f"{stage}.json"), json.dumps(payload, indent=2))


def create_job(job_id: str, topic: str, length: str, language: str, platform: str) -> int:
    jd = job_dir(job_id)
    os.makedirs(os.path.join(jd, "qc"), exist_ok=True)
    os.makedirs(os.path.join(jd, "artifacts"), exist_ok=True)
    write(
        os.path.join(jd, "brief.md"),
        "\n".join(
            [
                "# Brief",
                f"topic: {topic or '(empty)'}",
                f"length: {length}",
                f"language: {language}",
                f"platform: {platform}",
                "status: waiting Topic OK",
            ]
        ),
    )
    save_state(
        os.path.join(jd, "state.json"),
        {
            "job_id": job_id,
            "stage": "inbox",
            "owner_gates": {"topic_ok": False, "look_ok": False, "master_ok": False},
            "retries": {},
            "last_director": None,
        },
    )
    print("created", job_id, "stage=inbox")
    return 0


def set_gate(job_id: str, gate: str) -> int:
    path = os.path.join(job_dir(job_id), "state.json")
    if not os.path.isfile(path):
        print("missing job", job_id)
        return 1
    state = load_state(path)
    state.setdefault("owner_gates", {})[gate] = True
    save_state(path, state)
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
    state = load_state(state_path)
    stage = state.get("stage", "inbox")
    print("job", job_id, "stage", stage)
    gates = state.setdefault("owner_gates", {})

    if stage == "inbox":
        if not gates.get("topic_ok"):
            print("STOP: need Topic OK")
            state["last_director"] = {"pass": False, "reason": "inbox waits Topic OK"}
            save_state(state_path, state)
            return 0
        state["stage"] = "intake"
        save_state(state_path, state)
        stage = "intake"

    if stage == "done":
        print("already done")
        return 0

    if stage == "delivery" and not gates.get("master_ok"):
        print("STOP: need Master OK")
        state["last_director"] = {"pass": False, "reason": "delivery waits Master OK"}
        save_state(state_path, state)
        return 0

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

    verdict = director(stage, jd)
    qc_write(jd, stage, {"stage": stage, "checked_at": now(), **verdict})
    state["last_director"] = verdict
    retries = state.setdefault("retries", {})
    print("director", verdict)

    if verdict.get("pass"):
        if stage == "look_lock" and not gates.get("look_ok"):
            print("STOP: waiting Look OK")
            save_state(state_path, state)
            return 0
        nxt = NEXT.get(stage)
        if nxt:
            state["stage"] = nxt
            retries[stage] = 0
            print("advance to", nxt)
        save_state(state_path, state)
        return 0

    retries[stage] = int(retries.get(stage, 0)) + 1
    save_state(state_path, state)
    if retries[stage] >= 2:
        print("STOP: director failed twice at", stage)
        return 1
    print("retry allowed at", stage)
    return 0


def main() -> int:
    action = (os.environ.get("ENGINE_ACTION") or "run_stage").strip()
    job_id = safe_id(os.environ.get("JOB_ID") or "")
    if not job_id:
        print("JOB_ID required")
        return 1
    os.makedirs(ROOT, exist_ok=True)
    if action == "create_job":
        return create_job(
            job_id,
            (os.environ.get("TOPIC") or "").strip(),
            (os.environ.get("LENGTH") or "10min").strip(),
            (os.environ.get("LANGUAGE") or "Hinglish").strip(),
            (os.environ.get("PLATFORM") or "youtube").strip(),
        )
    if action in GATE_MAP:
        return set_gate(job_id, GATE_MAP[action])
    if action == "run_stage":
        return run_stage(job_id)
    print("unknown action", action)
    return 1


if __name__ == "__main__":
    sys.exit(main())
