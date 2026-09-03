#!/usr/bin/env python3
"""Stills: Gemini T2I / ref-edit. Picture: Kie.ai I2V only."""
from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

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


def kie_key() -> str:
    return _env("KEI_I2V_KEY", "KIE_I2V_KEY", "KIE_API_KEY")


def _http_json(method: str, url: str, headers: dict, body=None, timeout=180):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        return json.loads(raw.decode("utf-8")) if raw else {}


def _gemini_image(parts: list) -> bytes:
    key = gemini_key()
    if not key:
        raise RuntimeError("GEMINI_API_KEY missing")
    headers = {"Content-Type": "application/json", "x-goog-api-key": key}
    last = "gemini still failed"
    body_base = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {"aspectRatio": "16:9", "imageSize": "1K"},
        },
    }
    for model in GEMINI_STILL_MODELS:
        url = f"{GEMINI}/models/{model}:generateContent"
        try:
            out = _http_json("POST", url, headers, body_base, timeout=90)
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


def gemini_still(prompt: str) -> bytes:
    return _gemini_image([{"text": prompt[:900]}])


def gemini_still_from_ref(prompt: str, png_path: str) -> bytes:
    if not os.path.isfile(png_path):
        raise RuntimeError(f"missing ref {png_path}")
    b64 = base64.b64encode(open(png_path, "rb").read()).decode("ascii")
    return _gemini_image([
        {"inline_data": {"mime_type": "image/png", "data": b64}},
        {"text": prompt[:900]},
    ])


def make_still(prompt: str, ref_png: str | None = None) -> bytes:
    if ref_png:
        return gemini_still_from_ref(prompt, ref_png)
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
        raise RuntimeError("KEI_I2V_KEY missing")
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
            last = f"{model} HTTP {e.code} {e.read().decode('utf-8', 'ignore')[:180]}"
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


def make_clip(prompt: str, png_path: str) -> bytes:
    return kie_i2v(prompt, png_path)
