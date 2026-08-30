#!/usr/bin/env python3
"""VISION EP001 stills via NVIDIA FLUX (ai.api.nvidia.com).

Env: NVIDIA_API_KEY or NVIDIA_VICTOR_VISION_KEY
     ONLY_IDS=A1 (optional)
"""
from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone, timedelta

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "episodes", "EP001_Last_Delivery", "stills")
IST = timezone(timedelta(hours=5, minutes=30))

ENDPOINTS = [
    "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell",
    "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev",
]

PROMPTS = {
    "A1": "Photorealistic character reference, Indian man age 24, thin build, tired gentle eyes, short black hair, light stubble, blue delivery jacket, black shoulder delivery bag, waist-up, studio light, cinematic, natural skin, 35mm, no text no watermark",
    "A2": "Photorealistic character reference, Indian woman age 58, kind worried face, simple cotton saree muted colour, grey-black hair in bun, waist-up, soft indoor light, cinematic, natural skin, no text no watermark",
    "A3": "Photorealistic character reference, Indian man age 32, calm polite slightly threatening face, smart casual shirt, neat hair, waist-up, neutral light, cinematic, natural skin, no text no watermark",
    "B1": "Cinematic night, Indian delivery man 24 blue jacket black bag on motorcycle city road neon bokeh, photorealistic 35mm, no text",
    "B2": "Close-up brown cardboard delivery box red tape FRAGILE on delivery bag night light, photorealistic, no brand logo no watermark",
    "B3": "Night Indian apartment society gate, young delivery man blue jacket brown box, 32 year man car window offering money calm smile, cinematic tension, no text",
    "B4": "Indian apartment corridor, 58 woman saree opening door, young delivery man blue jacket brown box outside, warm vs cool light, cinematic, no text",
    "B5": "Indian middle-class living room night, brown box red tape on table, blurred family photo wall, quiet mood, cinematic, no text",
    "B6": "Narrow back lane night, delivery man blue jacket brown box under street light phone in hand conflicted, cinematic, no text",
    "B7": "Early morning, same delivery man blue jacket on motorcycle quieter road calmer face, hopeful, cinematic 35mm, no text",
}


def extract_b64(data: dict):
    if isinstance(data.get("image"), str):
        return base64.b64decode(data["image"])
    arts = data.get("artifacts") or data.get("data") or []
    if isinstance(arts, list):
        for a in arts:
            if not isinstance(a, dict):
                continue
            for k in ("base64", "b64_json", "image"):
                if a.get(k):
                    return base64.b64decode(a[k])
    for k, v in data.items():
        if k in ("base64", "b64_json") and isinstance(v, str):
            return base64.b64decode(v)
    return None


def nvidia_generate(api_key: str, prompt: str) -> bytes:
    last = ""
    bodies = [
        {"prompt": prompt, "cfg_scale": 5, "mode": "base", "seed": 42, "steps": 20, "width": 768, "height": 1024},
        {"prompt": prompt, "seed": 42, "steps": 4, "width": 768, "height": 1024},
        {"prompt": prompt},
    ]
    for url in ENDPOINTS:
        for body in bodies:
            req = urllib.request.Request(
                url,
                data=json.dumps(body).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=180) as resp:
                    data = json.load(resp)
                img = extract_b64(data)
                if img:
                    return img
                last = f"no_b64: {json.dumps(data)[:400]}"
            except urllib.error.HTTPError as e:
                last = f"HTTP {e.code} {e.read().decode('utf-8', errors='replace')[:400]}"
            except Exception as e:
                last = str(e)
    raise RuntimeError(last)


def main() -> int:
    key = (
        os.environ.get("NVIDIA_API_KEY")
        or os.environ.get("NVIDIA_VICTOR_VISION_KEY")
        or ""
    ).strip()
    if not key:
        print("ERROR: NVIDIA key missing (NVIDIA_API_KEY or NVIDIA_VICTOR_VISION_KEY)")
        return 1
    print("NVIDIA key length:", len(key), "(value not printed)")

    only = os.environ.get("ONLY_IDS", "A1").strip()
    ids = [x.strip() for x in only.split(",") if x.strip()] or ["A1"]

    os.makedirs(OUT, exist_ok=True)
    log = {"updated": datetime.now(IST).isoformat(), "provider": "NVIDIA", "results": {}}

    any_ok = False
    for pid in ids:
        prompt = PROMPTS.get(pid)
        if not prompt:
            continue
        try:
            print(f"{pid}: NVIDIA FLUX...")
            img = nvidia_generate(key, prompt)
            path = os.path.join(OUT, f"{pid}.png")
            with open(path, "wb") as f:
                f.write(img)
            log["results"][pid] = {"status": "ok", "bytes": len(img), "file": f"stills/{pid}.png"}
            print(f"{pid}: OK {len(img)} bytes")
            any_ok = True
        except Exception as e:
            log["results"][pid] = {"status": "failed", "error": str(e)[:600]}
            print(f"{pid}: FAIL {e}")

    with open(os.path.join(OUT, "_run_log.json"), "w", encoding="utf-8") as f:
        json.dump(log, f, indent=2)

    print("DONE any_ok=", any_ok)
    return 0 if any_ok else 1


if __name__ == "__main__":
    sys.exit(main())
