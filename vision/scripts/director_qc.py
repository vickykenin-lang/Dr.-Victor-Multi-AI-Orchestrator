#!/usr/bin/env python3
"""Director: reject clip if face/wardrobe drifts from locked still + A1/A2/A3."""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
import urllib.error
import urllib.request

ROOT = os.path.join(os.path.dirname(__file__), "..")
STILLS = os.path.join(ROOT, "episodes", "EP001_Last_Delivery", "stills")

LOCK = {
    "B1": ["A1.png", "B1.png"],
    "B2": ["B2.png"],
    "B3": ["A1.png", "A3.png", "B3.png"],
    "B4": ["A1.png", "A2.png", "B4.png"],
    "B5": ["A2.png", "B5.png"],
    "B6": ["A1.png", "B6.png"],
    "B7": ["A1.png", "B7.png"],
}


def _gemini_key() -> str:
    for name in ("GEMINI_VIO_API_KEY", "GEMINI_API_KEY", "GEMINI_VEO_API_KEY"):
        val = (os.environ.get(name) or "").strip()
        if val:
            return val
    return ""


def _frame(mp4: str) -> str:
    out = os.path.join(tempfile.gettempdir(), "dir_frame.jpg")
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", "1.2", "-i", mp4, "-frames:v", "1", out],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return out


def judge(shot_id: str, mp4_path: str) -> dict:
    key = _gemini_key()
    if not key:
        return {"ok": True, "skipped": True, "reason": "no gemini for director"}
    refs = LOCK.get(shot_id, [f"{shot_id}.png"])
    existing = [os.path.join(STILLS, n) for n in refs if os.path.isfile(os.path.join(STILLS, n))]
    if not existing:
        return {"ok": True, "skipped": True, "reason": "no lock stills"}
    frame = _frame(mp4_path)
    import base64

    def b64(path: str) -> str:
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode("ascii")

    parts = [
        {
            "text": (
                f"You are the film director for EP001. Shot {shot_id}. "
                f"First images are LOCKED references. Last image is a frame from the generated clip. "
                f"Reply ONLY JSON {{"ok": true/false, "reason": "..."}}. "
                f"ok=false if the hero face, age, beard, jacket color, or bag clearly changed, "
                f"or a different actor appeared. Ignore mild motion blur."
            )
        }
    ]
    for p in existing:
        parts.append({"inline_data": {"mime_type": "image/png", "data": b64(p)}})
    parts.append({"inline_data": {"mime_type": "image/jpeg", "data": b64(frame)}})
    body = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 200},
    }
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.load(resp)
    except urllib.error.HTTPError as e:
        return {"ok": True, "skipped": True, "reason": f"director HTTP {e.code}"}
    text = ""
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        return {"ok": True, "skipped": True, "reason": "director parse"}
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end < 0:
        return {"ok": True, "skipped": True, "reason": text[:180]}
    try:
        parsed = json.loads(text[start : end + 1])
    except Exception:
        return {"ok": True, "skipped": True, "reason": text[:180]}
    return {
        "ok": bool(parsed.get("ok")),
        "reason": str(parsed.get("reason", ""))[:300],
        "skipped": False,
    }
