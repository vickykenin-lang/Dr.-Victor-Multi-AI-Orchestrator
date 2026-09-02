#!/usr/bin/env python3
"""Vision Production House Engine."""
from __future__ import annotations

import glob
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


def topic_of(jd: str) -> str:
    brief = os.path.join(jd, "brief.md")
    if not os.path.isfile(brief):
        return ""
    for line in open(brief, encoding="utf-8"):
        if line.lower().startswith("topic:"):
            return line.split(":", 1)[1].strip()
    return ""


def list_jobs() -> list[str]:
    if not os.path.isdir(ROOT):
        return []
    return [n for n in sorted(os.listdir(ROOT)) if os.path.isfile(os.path.join(ROOT, n, "state.json"))]


def create_job(job_id: str, topic: str, length: str, language: str, platform: str) -> int:
    jd = job_dir(job_id)
    os.makedirs(os.path.join(jd, "qc"), exist_ok=True)
    os.makedirs(os.path.join(jd, "artifacts"), exist_ok=True)
    write(os.path.join(jd, "brief.md"), "\n".join([
        "# Brief",
        f"topic: {topic or '(empty)'}",
        f"length: {length}",
        f"language: {language}",
        f"platform: {platform}",
        "status: waiting Topic OK",
    ]))
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


def reopen(job_id: str, stage: str = "look_lock") -> int:
    path = os.path.join(job_dir(job_id), "state.json")
    if not os.path.isfile(path):
        print("missing job", job_id)
        return 1
    if stage not in STAGES:
        stage = "look_lock"
    state = load_json(path, {})
    state["stage"] = stage
    state["retries"] = {}
    state["last_director"] = None
    state["updated"] = now()
    save_json(path, state)
    signal(job_id, True, stage, f"reopen at {stage}")
    print("reopened", job_id, stage)
    return 0


def director(stage: str, jd: str) -> dict:
    if stage == "look_lock":
        sheets = glob.glob(os.path.join(jd, "artifacts", "look", "L*.png"))
        lock = os.path.isfile(os.path.join(jd, "artifacts", "identity_lock.json"))
        if len(sheets) < 3 or not lock:
            return {"pass": False, "reason": f"look sheets={len(sheets)} lock={lock}", "must_fix": ["look sheets"]}
    if stage == "keyframes":
        frames = glob.glob(os.path.join(jd, "artifacts", "keyframes", "K*.png"))
        if len(frames) < 3:
            return {"pass": False, "reason": f"keyframes={len(frames)}", "must_fix": ["keyframes"]}
    if stage == "picture":
        clips = glob.glob(os.path.join(jd, "artifacts", "picture", "K*.mp4"))
        if len(clips) < 1:
            return {"pass": False, "reason": "no picture mp4", "must_fix": ["picture"]}
    if stage == "assembly":
        if not os.path.isfile(os.path.join(jd, "artifacts", "assembly", "master.mp4")):
            return {"pass": False, "reason": "no master.mp4", "must_fix": ["assembly"]}
    need = {
        "intake": ["brief.md"],
        "development": ["artifacts/development.md"],
        "screenplay": ["artifacts/screenplay.md", "artifacts/shot_plan.md"],
        "look_lock": ["artifacts/look_lock.md", "artifacts/identity_lock.json"],
        "keyframes": ["artifacts/keyframes.md"],
        "picture": ["artifacts/picture.md"],
        "sound": ["artifacts/sound.md"],
        "assembly": ["artifacts/assembly.md"],
        "delivery": ["artifacts/delivery.md"],
    }
    missing = [p for p in need.get(stage, []) if not os.path.isfile(os.path.join(jd, p))]
    if missing:
        return {"pass": False, "reason": "missing " + ",".join(missing), "must_fix": missing}
    return {"pass": True, "reason": f"{stage} artifacts present", "must_fix": []}


def run_workers(stage: str, jd: str) -> None:
    topic = topic_of(jd)
    if stage == "look_lock":
        from worker_look import run as look_run
        look_run(jd, topic)
    elif stage == "keyframes":
        from worker_keyframes import run as kf_run
        kf_run(jd, topic)
    elif stage == "picture":
        from worker_picture import run as pic_run
        pic_run(jd, topic)
    elif stage == "assembly":
        from worker_assembly import run as asm_run
        asm_run(jd, topic)
    elif stage == "screenplay":
        write(os.path.join(jd, "artifacts/screenplay.md"), "# Screenplay\n\nscenes from brief only\n")
        write(os.path.join(jd, "artifacts/shot_plan.md"), "# Shot plan\n\nK1-K4\n")
    elif stage == "development":
        write(os.path.join(jd, "artifacts/development.md"), f"# Development\n\ntopic: {topic}\n")
    elif stage == "sound":
        write(os.path.join(jd, "artifacts/sound.md"), "# Sound\n\nstatus: pass-through picture audio\n")
    elif stage == "delivery":
        write(os.path.join(jd, "artifacts/delivery.md"), "# Delivery\n\nmaster at artifacts/assembly/master.mp4\n")


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
    try:
        run_workers(stage, jd)
    except Exception as e:
        print("worker fail", stage, e)
        verdict = {"pass": False, "reason": str(e)[:300], "must_fix": [stage]}
        write(os.path.join(jd, "qc", f"{stage}.json"), json.dumps({"stage": stage, "checked_at": now(), **verdict}, indent=2))
        state["last_director"] = verdict
        retries = state.setdefault("retries", {})
        retries[stage] = int(retries.get(stage, 0)) + 1
        state["updated"] = now()
        save_json(state_path, state)
        signal(job_id, retries[stage] < 2, stage, "worker fail")
        return 0 if retries[stage] < 2 else 1
    verdict = director(stage, jd)
    write(os.path.join(jd, "qc", f"{stage}.json"), json.dumps({"stage": stage, "checked_at": now(), **verdict}, indent=2))
    state["last_director"] = verdict
    retries = state.setdefault("retries", {})
    print("director", verdict)
    if verdict.get("pass"):
        if stage == "look_lock":
            gates["look_ok"] = True
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
    signal(job_id, retries[stage] < 2, stage, "director fail retry")
    return 0 if retries[stage] < 2 else 1


def scan_auto() -> int:
    jobs = list_jobs()
    if not jobs:
        print("no jobs")
        return 0
    code = 0
    for job_id in jobs:
        print("scan", job_id)
        code |= run_stage(job_id)
    return 0 if code == 0 else 1


def main() -> int:
    action = (os.environ.get("ENGINE_ACTION") or "scan_auto").strip() or "scan_auto"
    job_id = safe_id(os.environ.get("JOB_ID") or "")
    os.makedirs(ROOT, exist_ok=True)
    if action == "create_job":
        if not job_id:
            print("JOB_ID required")
            return 1
        return create_job(job_id, (os.environ.get("TOPIC") or "").strip(), (os.environ.get("LENGTH") or "10min").strip(), (os.environ.get("LANGUAGE") or "Hinglish").strip(), (os.environ.get("PLATFORM") or "youtube").strip())
    if action == "reopen":
        if not job_id:
            print("JOB_ID required")
            return 1
        return reopen(job_id, (os.environ.get("TOPIC") or os.environ.get("REOPEN_STAGE") or "picture").strip())
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
