#!/usr/bin/env python3
"""Stills via Gemini, fallback Sora T2V first-frame. Picture via Sora I2V."""
from __future__ import annotations

import base64
import json
import os
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

OPENAI = "https://api.openai.com/v1"
GEMINI = "https://generativelanguage.googleapis.com/v1beta"
GEMINI_STILL_MODELS = ["gemini-3.1-flash-lite-image", "gemini-2.5-flash-image"]


def _env(*names: str) -> str:
    for n in names:
        v = (os.environ.get(n) or "").strip()
        if v:
            return v
    return ""


def gemini_key() -> str:
    return _env("GEMINI_API_KEY", "GEMINI_VIO_API_KEY", "GEMINI_VEO_API_KEY")


def sora_key() -> str:
    return _env("SORA2_API", "SORA2_API_KEY", "OPENAI_API_KEY")


def _http_json(method: str, url: str, headers: dict, body=None, timeout=180):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        return json.loads(raw.decode("utf-8")) if raw else {}


def gemini_still(prompt: str) -> bytes:
    key = gemini_key()
    if not key:
        raise RuntimeError("no gemini key")
    headers = {"Content-Type": "application/json", "x-goog-api-key": key}
    last = "gemini still failed"
    for model in GEMINI_STILL_MODELS:
        url = f"{GEMINI}/models/{model}:generateContent"
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt[:900]}]}],
            "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "1:1", "imageSize": "1K"}},
        }
        try:
            out = _http_json("POST", url, headers, body, timeout=90)
        except urllib.error.HTTPError as e:
            last = f"{model} HTTP {e.code}"
            print(last)
            if e.code == 429:
                raise RuntimeError("gemini 429")
            continue
        except Exception as e:
            last = str(e)
            continue
        for cand in out.get("candidates") or []:
            for part in (cand.get("content") or {}).get("parts") or []:
                inline = part.get("inlineData") or part.get("inline_data") or {}
                if inline.get("data"):
                    return base64.b64decode(inline["data"])
        last = f"{model} empty"
    raise RuntimeError(last)


def _sora_create(fields: list) -> bytes:
    key = sora_key()
    if not key:
        raise RuntimeError("no sora key")
    cmd = ["curl", "-sS", "-X", "POST", f"{OPENAI}/videos", "-H", f"Authorization: Bearer {key}"] + fields
    raw = subprocess.check_output(cmd, timeout=120)
    created = json.loads(raw.decode("utf-8"))
    if created.get("error"):
        raise RuntimeError(json.dumps(created["error"])[:400])
    vid = created.get("id")
    if not vid:
        raise RuntimeError(f"sora no id {raw[:300]!r}")
    headers = {"Authorization": f"Bearer {key}"}
    deadline = time.time() + 600
    while time.time() < deadline:
        time.sleep(8)
        req = urllib.request.Request(f"{OPENAI}/videos/{vid}", headers=headers)
        with urllib.request.urlopen(req, timeout=60) as resp:
            st = json.load(resp)
        print("sora", st.get("status"), st.get("progress"))
        if st.get("status") == "failed":
            raise RuntimeError(json.dumps(st)[:400])
        if st.get("status") == "completed":
            req = urllib.request.Request(f"{OPENAI}/videos/{vid}/content", headers=headers)
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = resp.read()
            if not data or len(data) < 1000:
                raise RuntimeError("sora empty mp4")
            return data
    raise RuntimeError("sora timeout")


def sora_t2v(prompt: str) -> bytes:
    return _sora_create([
        "-F", "model=sora-2",
        "-F", f"prompt={prompt[:1000]}",
        "-F", "seconds=4",
        "-F", "size=1280x720",
    ])


def resize_png(src: str, w: int, h: int) -> str:
    out = os.path.join(tempfile.gettempdir(), f"sz_{w}x{h}.png")
    subprocess.check_call(
        ["ffmpeg", "-y", "-i", src, "-vf", f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}", out],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return out


def sora_i2v(prompt: str, png_path: str) -> bytes:
    sized = resize_png(png_path, 1280, 720)
    return _sora_create([
        "-F", "model=sora-2",
        "-F", f"prompt={prompt[:1000]}",
        "-F", "seconds=4",
        "-F", "size=1280x720",
        "-F", f"input_reference=@{sized};type=image/png",
    ])


def first_frame_png(mp4: bytes) -> bytes:
    tmp = tempfile.mkdtemp()
    src = os.path.join(tmp, "in.mp4")
    dst = os.path.join(tmp, "out.png")
    open(src, "wb").write(mp4)
    subprocess.check_call(
        ["ffmpeg", "-y", "-i", src, "-frames:v", "1", dst],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return open(dst, "rb").read()


def make_still(prompt: str) -> bytes:
    try:
        if gemini_key():
            return gemini_still(prompt)
    except Exception as e:
        print("gemini skip", e)
    if not sora_key():
        raise RuntimeError("no still provider")
    print("still via sora t2v frame")
    mp4 = sora_t2v("Locked character sheet, almost still camera. " + prompt[:800])
    return first_frame_png(mp4)
