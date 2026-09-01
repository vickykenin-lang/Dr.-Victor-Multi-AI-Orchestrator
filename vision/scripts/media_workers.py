#!/usr/bin/env python3
"""Shared still + Sora helpers. Try multiple still endpoints."""
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
FLUX_URLS = [
    "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell",
    "https://integrate.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell",
    "https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-xl",
]
GEMINI_STILL_MODELS = [
    "gemini-2.5-flash-image",
    "gemini-2.0-flash-preview-image-generation",
    "imagen-3.0-generate-002",
]


def _env(*names: str) -> str:
    for n in names:
        v = (os.environ.get(n) or "").strip()
        if v:
            return v
    return ""


def nvidia_key() -> str:
    return _env("NVIDIA_VICTOR_VISION_KEY", "NVIDIA_API_KEY")


def gemini_key() -> str:
    return _env("GEMINI_VIO_API_KEY", "GEMINI_API_KEY", "GEMINI_VEO_API_KEY")


def sora_key() -> str:
    return _env("SORA2_API", "SORA2_API_KEY", "OPENAI_API_KEY")


def _http_json(method: str, url: str, headers: dict, body=None, timeout=180):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        return json.loads(raw.decode("utf-8")) if raw else {}


def _b64_to_bytes(val: str) -> bytes:
    if "," in val and val.strip().startswith("data:"):
        val = val.split(",", 1)[1]
    return base64.b64decode(val)


def flux_still(prompt: str) -> bytes:
    key = nvidia_key()
    if not key:
        raise RuntimeError("no nvidia key")
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json", "Accept": "application/json"}
    last = "flux failed"
    for url in FLUX_URLS:
        try:
            out = _http_json("POST", url, headers, {"prompt": prompt[:800], "height": 1024, "width": 1024}, timeout=120)
        except urllib.error.HTTPError as e:
            last = f"{url} HTTP {e.code}"
            print(last)
            continue
        except Exception as e:
            last = f"{url} {e}"
            continue
        b64 = out.get("image")
        if not b64:
            arts = out.get("artifacts") or out.get("data") or []
            if arts and isinstance(arts, list):
                b64 = arts[0].get("base64") or arts[0].get("b64_json") or arts[0].get("url")
        if isinstance(b64, str) and len(b64) > 80:
            return _b64_to_bytes(b64)
        last = f"{url} empty {json.dumps(out)[:160]}"
    raise RuntimeError(last)


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
            "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]},
        }
        try:
            out = _http_json("POST", url, headers, body, timeout=120)
        except urllib.error.HTTPError as e:
            last = f"{model} HTTP {e.code}"
            print(last)
            continue
        except Exception as e:
            last = f"{model} {e}"
            continue
        for cand in out.get("candidates") or []:
            for part in (cand.get("content") or {}).get("parts") or []:
                inline = part.get("inlineData") or part.get("inline_data") or {}
                data = inline.get("data")
                if data:
                    return base64.b64decode(data)
        last = f"{model} empty"
    raise RuntimeError(last)


def make_still(prompt: str) -> bytes:
    last = None
    if nvidia_key():
        try:
            return flux_still(prompt)
        except Exception as e:
            last = e
            print("flux fail", e)
    if gemini_key():
        try:
            return gemini_still(prompt)
        except Exception as e:
            last = e
            print("gemini still fail", e)
    raise RuntimeError(str(last) if last else "no still provider")


def resize_png(src: str, w: int, h: int) -> str:
    out = os.path.join(tempfile.gettempdir(), f"sz_{w}x{h}.png")
    subprocess.check_call(
        ["ffmpeg", "-y", "-i", src, "-vf", f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}", out],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return out


def sora_i2v(prompt: str, png_path: str) -> bytes:
    key = sora_key()
    if not key:
        raise RuntimeError("no sora key")
    sized = resize_png(png_path, 1280, 720)
    cmd = [
        "curl", "-sS", "-X", "POST", f"{OPENAI}/videos",
        "-H", f"Authorization: Bearer {key}",
        "-F", "model=sora-2",
        "-F", f"prompt={prompt[:1000]}",
        "-F", "seconds=4",
        "-F", "size=1280x720",
        "-F", f"input_reference=@{sized};type=image/png",
    ]
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
