#!/usr/bin/env python3
"""EP001 I2V Sora 16:9 + Director QC retry."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone, timedelta

from director_qc import judge
from prompt_manager import video_prompt

ROOT = os.path.join(os.path.dirname(__file__), "..")
STILLS = os.path.join(ROOT, "episodes", "EP001_Last_Delivery", "stills")
CLIPS = os.path.join(ROOT, "episodes", "EP001_Last_Delivery", "clips")
IST = timezone(timedelta(hours=5, minutes=30))
OPENAI = "https://api.openai.com/v1"
SORA_W, SORA_H = 1280, 720
SORA_SIZE = f"{SORA_W}x{SORA_H}"


def sora_key() -> str:
    for name in ("SORA2_API", "SORA2_API_KEY", "OPENAI_API_KEY"):
        val = (os.environ.get(name) or "").strip()
        if val:
            print("using", name, "len", len(val))
            return val
    return ""


def http_json(method: str, url: str, headers: dict, body=None, timeout=180):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        return json.loads(raw.decode("utf-8")) if raw else {}


def resize_still(png_path: str, w: int, h: int) -> str:
    out = os.path.join(tempfile.gettempdir(), f"i2v_{w}x{h}.png")
    subprocess.check_call(
        ["ffmpeg", "-y", "-i", png_path, "-vf", f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}", out],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return out


def sora_i2v(api_key: str, prompt: str, png_path: str) -> bytes:
    sized = resize_still(png_path, SORA_W, SORA_H)
    cmd = [
        "curl", "-sS", "-X", "POST", f"{OPENAI}/videos",
        "-H", f"Authorization: Bearer {api_key}",
        "-F", "model=sora-2",
        "-F", f"prompt={prompt}",
        "-F", "seconds=4",
        "-F", f"size={SORA_SIZE}",
        "-F", f"input_reference=@{sized};type=image/png",
    ]
    raw = subprocess.check_output(cmd, timeout=120)
    created = json.loads(raw.decode("utf-8"))
    if created.get("error"):
        raise RuntimeError(json.dumps(created["error"])[:400])
    vid = created.get("id")
    if not vid:
        raise RuntimeError(f"sora no id: {raw[:400]!r}")
    print("Sora job", vid, created.get("status"), SORA_SIZE)
    headers = {"Authorization": f"Bearer {api_key}"}
    deadline = time.time() + 600
    last = created
    while time.time() < deadline:
        time.sleep(8)
        st = http_json("GET", f"{OPENAI}/videos/{vid}", headers, timeout=60)
        last = st
        status = st.get("status")
        print("Sora status", status, st.get("progress"))
        if status == "failed":
            raise RuntimeError(f"sora failed: {json.dumps(st)[:400]}")
        if status == "completed":
            req = urllib.request.Request(f"{OPENAI}/videos/{vid}/content", headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = resp.read()
            if not data or len(data) < 1000:
                raise RuntimeError("sora empty mp4")
            return data
    raise RuntimeError(f"sora timeout: {json.dumps(last)[:400]}")


def main() -> int:
    only = os.environ.get("ONLY_IDS", "B1").strip()
    ids = [x.strip() for x in only.split(",") if x.strip()] or ["B1"]
    os.makedirs(CLIPS, exist_ok=True)
    skey = sora_key()
    log = {
        "updated": datetime.now(IST).isoformat(),
        "mode": "i2v+director",
        "size": SORA_SIZE,
        "sora_key": bool(skey),
        "results": {},
    }
    any_ok = False
    for pid in ids:
        still = os.path.join(STILLS, f"{pid}.png")
        out = os.path.join(CLIPS, f"{pid}.mp4")
        if not os.path.isfile(still):
            log["results"][pid] = {"status": "no_still"}
            continue
        action = video_prompt(pid)
        print(pid, "PROMPT", action)
        if not skey:
            log["results"][pid] = {"status": "failed", "error": "no sora key"}
            continue
        last_err = None
        accepted = False
        qc = {}
        for attempt in (1, 2):
            try:
                vid = sora_i2v(skey, action if attempt == 1 else action + " Keep the exact same face as the reference image.", still)
                with open(out, "wb") as f:
                    f.write(vid)
            except Exception as e:
                last_err = str(e)[:500]
                print(pid, "Sora fail", last_err)
                continue
            qc = judge(pid, out)
            print(pid, "DIRECTOR", qc)
            if qc.get("ok") or qc.get("skipped"):
                accepted = True
                break
            last_err = "director reject: " + str(qc.get("reason", ""))
            print(pid, "retry after director")
        if not accepted:
            log["results"][pid] = {
                "status": "failed",
                "provider": "none",
                "action_prompt": action,
                "director": qc,
                "error": last_err,
            }
            continue
        log["results"][pid] = {
            "status": "ok",
            "provider": "sora2_i2v",
            "bytes": os.path.getsize(out),
            "size": SORA_SIZE,
            "action_prompt": action,
            "director": qc,
            "error": last_err,
        }
        print(pid, "OK", os.path.getsize(out))
        any_ok = True
    with open(os.path.join(CLIPS, "_run_log.json"), "w", encoding="utf-8") as f:
        json.dump(log, f, indent=2)
    return 0 if any_ok else 1


if __name__ == "__main__":
    sys.exit(main())
