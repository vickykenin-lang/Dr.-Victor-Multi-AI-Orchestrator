#!/usr/bin/env python3
"""EP001 clips. I2V_ONLY=1 sends still + prompt_manager video prompt to Veo only."""
from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta

from prompt_manager import video_prompt

ROOT = os.path.join(os.path.dirname(__file__), "..")
STILLS = os.path.join(ROOT, "episodes", "EP001_Last_Delivery", "stills")
CLIPS = os.path.join(ROOT, "episodes", "EP001_Last_Delivery", "clips")
IST = timezone(timedelta(hours=5, minutes=30))
RAW_STILL = (
    "https://raw.githubusercontent.com/vickykenin-lang/Dr.-Victor-Multi-AI-Orchestrator/"
    "main/vision/episodes/EP001_Last_Delivery/stills/{pid}.png"
)
J2V = "https://api.json2video.com/v2/movies"
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"
VEO_MODELS = ["veo-3.1-generate-preview", "veo-3.1-fast-generate-preview", "veo-3.1-lite-generate-preview"]


def gemini_key() -> str:
    for name in ("GEMINI_VIO_API_KEY", "GEMINI_VEO_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"):
        val = (os.environ.get(name) or "").strip()
        if val:
            print("using", name, "len", len(val))
            return val
    return ""


def j2v_key() -> str:
    for name in ("JASON2VIDEO_API_KEY", "JSON2VIDEO_API_KEY"):
        val = (os.environ.get(name) or "").strip()
        if val:
            return val
    return ""


def http_json(method: str, url: str, headers: dict, body=None, timeout=180):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        return json.loads(raw.decode("utf-8")) if raw else {}


def download_url(url: str, headers=None) -> bytes:
    req = urllib.request.Request(url, headers=headers or {}, method="GET")
    with urllib.request.urlopen(req, timeout=180) as resp:
        return resp.read()


def find_video_uri(obj):
    if isinstance(obj, dict):
        vid = obj.get("video") or {}
        if isinstance(vid, dict) and vid.get("uri"):
            return vid["uri"]
        if isinstance(obj.get("uri"), str) and obj["uri"].startswith("http"):
            return obj["uri"]
        for v in obj.values():
            found = find_video_uri(v)
            if found:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = find_video_uri(v)
            if found:
                return found
    return None


def veo_i2v(api_key: str, prompt: str, png_path: str) -> bytes:
    with open(png_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("ascii")
    headers = {"Content-Type": "application/json", "x-goog-api-key": api_key}
    shapes = [
        {
            "instances": [{
                "prompt": prompt,
                "image": {"bytesBase64Encoded": img_b64, "mimeType": "image/png"},
            }],
            "parameters": {"aspectRatio": "9:16", "durationSeconds": 4},
        },
        {
            "instances": [{
                "prompt": prompt,
                "image": {"bytesBase64Encoded": img_b64, "mimeType": "image/png"},
            }],
        },
    ]
    last = "no veo"
    for model in VEO_MODELS:
        url = f"{GEMINI_BASE}/models/{model}:predictLongRunning"
        for body in shapes:
            print("I2V POST", model, "prompt_chars", len(prompt), "still", png_path)
            try:
                op = http_json("POST", url, headers, body, timeout=90)
            except urllib.error.HTTPError as e:
                last = f"HTTP {e.code} {model} {e.read().decode('utf-8', errors='replace')[:350]}"
                print(last)
                continue
            name = op.get("name")
            if not name:
                last = f"no op {model} {json.dumps(op)[:200]}"
                continue
            deadline = time.time() + 420
            while time.time() < deadline:
                time.sleep(12)
                st = http_json("GET", f"{GEMINI_BASE}/{name}", {"x-goog-api-key": api_key}, timeout=60)
                if st.get("error"):
                    last = json.dumps(st["error"])[:400]
                    print("Veo error", last)
                    break
                if not st.get("done"):
                    print("Veo polling", model)
                    continue
                uri = find_video_uri(st)
                if not uri:
                    last = f"done no uri {json.dumps(st)[:400]}"
                    break
                vid = download_url(uri, {"x-goog-api-key": api_key})
                if vid and len(vid) > 1000:
                    return vid
                last = "empty download"
                break
    raise RuntimeError(last)


def main() -> int:
    only = os.environ.get("ONLY_IDS", "B1").strip()
    ids = [x.strip() for x in only.split(",") if x.strip()] or ["B1"]
    i2v_only = (os.environ.get("I2V_ONLY") or "1").strip() not in ("0", "false", "no")
    os.makedirs(CLIPS, exist_ok=True)
    gkey = gemini_key()
    log = {
        "updated": datetime.now(IST).isoformat(),
        "mode": "i2v_only" if i2v_only else "fallback",
        "gemini_key": bool(gkey),
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
        print(pid, "I2V_PROMPT_CHARS", len(action))
        print(pid, "I2V_PROMPT", action)
        if not gkey:
            log["results"][pid] = {"status": "failed", "error": "no gemini/veo key", "action_prompt": action}
            print(pid, "FAIL no key")
            continue
        try:
            vid = veo_i2v(gkey, action, still)
            with open(out, "wb") as f:
                f.write(vid)
            log["results"][pid] = {
                "status": "ok",
                "provider": "gemini_veo_i2v",
                "bytes": os.path.getsize(out),
                "action_prompt": action,
            }
            print(pid, "OK gemini_veo_i2v", os.path.getsize(out))
            any_ok = True
        except Exception as e:
            err = str(e)[:600]
            log["results"][pid] = {
                "status": "failed",
                "provider": "none",
                "action_prompt": action,
                "error": err,
            }
            print(pid, "I2V FAIL", err)
    with open(os.path.join(CLIPS, "_run_log.json"), "w", encoding="utf-8") as f:
        json.dump(log, f, indent=2)
    if i2v_only:
        return 0 if any_ok else 1
    return 0 if any_ok else 1


if __name__ == "__main__":
    sys.exit(main())
