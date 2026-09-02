#!/usr/bin/env python3
"""Stills Gemini. Picture: Kie.ai I2V first, Sora fallback."""
from __future__ import annotations

import base64
import json
import os
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

OPENAI = "https://api.openai.com/v1"
GEMINI = "https://generativelanguage.googleapis.com/v1beta"
KIE = "https://api.kie.ai"
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


def kie_key() -> str:
    return _env("KEI_I2V_KEY", "KIE_I2V_KEY", "KIE_API_KEY")


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


def make_still(prompt: str) -> bytes:
    if not gemini_key():
        raise RuntimeError("GEMINI_API_KEY missing")
    return gemini_still(prompt)


def public_still_url(png_path: str) -> str:
    rel = png_path.replace("\\", "/")
    marker = "vision/engine/jobs/"
    if marker in rel:
        rel = marker + rel.split(marker, 1)[1]
    sha = _env("GITHUB_SHA") or "main"
    return (
        "https://raw.githubusercontent.com/vickykenin-lang/Dr.-Victor-Multi-AI-Orchestrator/"
        + sha + "/" + rel
    )


def kie_i2v(prompt: str, png_path: str) -> bytes:
    key = kie_key()
    if not key:
        raise RuntimeError("no KEI_I2V_KEY")
    img = public_still_url(png_path)
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    models = ["grok-imagine/image-to-video", "kling-2.6/image-to-video"]
    last = "kie create failed"
    task = None
    used = None
    for model in models:
        body = {
            "model": model,
            "input": {
                "prompt": prompt[:1000],
                "image_urls": [img],
                "mode": "normal",
                "duration": "5",
                "resolution": "720p",
            },
        }
        try:
            out = _http_json("POST", f"{KIE}/api/v1/jobs/createTask", headers, body, timeout=60)
        except urllib.error.HTTPError as e:
            last = f"{model} HTTP {e.code} {e.read().decode('utf-8','ignore')[:180]}"
            print(last)
            continue
        print("kie create", model, json.dumps(out)[:300])
        data = out.get("data") or {}
        task = data.get("taskId") or data.get("task_id") or out.get("taskId")
        if task:
            used = model
            break
        last = json.dumps(out)[:240]
    if not task:
        raise RuntimeError(last)
    deadline = time.time() + 480
    while time.time() < deadline:
        time.sleep(10)
        q = urllib.parse.urlencode({"taskId": task})
        try:
            st = _http_json("GET", f"{KIE}/api/v1/jobs/recordInfo?{q}", headers, timeout=60)
        except Exception as e:
            print("kie poll", e)
            continue
        data = st.get("data") or {}
        state = (data.get("state") or "").lower()
        print("kie", used, state, data.get("failMsg"))
        if state == "fail":
            raise RuntimeError(data.get("failMsg") or json.dumps(st)[:300])
        if state == "success":
            rawj = data.get("resultJson") or "{}"
            parsed = json.loads(rawj) if isinstance(rawj, str) else rawj
            urls = parsed.get("resultUrls") or parsed.get("result_urls") or []
            if not urls:
                raise RuntimeError("kie no url " + str(parsed)[:200])
            req = urllib.request.Request(urls[0], headers={"User-Agent": "vision-engine"})
            with urllib.request.urlopen(req, timeout=180) as resp:
                mp4 = resp.read()
            if not mp4 or len(mp4) < 1000:
                raise RuntimeError("kie empty mp4")
            return mp4
    raise RuntimeError("kie timeout")


def resize_png(src: str, w: int, h: int) -> str:
    out = os.path.join(tempfile.gettempdir(), f"sz_{w}x{h}.png")
    subprocess.check_call(
        ["ffmpeg", "-y", "-i", src, "-vf", f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}", out],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return out


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


def sora_i2v(prompt: str, png_path: str) -> bytes:
    sized = resize_png(png_path, 1280, 720)
    return _sora_create([
        "-F", "model=sora-2",
        "-F", f"prompt={prompt[:1000]}",
        "-F", "seconds=4",
        "-F", "size=1280x720",
        "-F", f"input_reference=@{sized};type=image/png",
    ])


def make_clip(prompt: str, png_path: str) -> bytes:
    last = None
    if kie_key():
        try:
            return kie_i2v(prompt, png_path)
        except Exception as e:
            last = e
            print("kie fail", e)
    if sora_key():
        try:
            return sora_i2v(prompt, png_path)
        except Exception as e:
            last = e
            print("sora fail", e)
    raise RuntimeError(str(last) if last else "no i2v key")
