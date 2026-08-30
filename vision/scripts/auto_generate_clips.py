#!/usr/bin/env python3
"""EP001 clips: NVIDIA I2V primary, ffmpeg motion-still fallback.

Env: NVIDIA_API_KEY or NVIDIA_VICTOR_VISION_KEY
     ONLY_IDS=B1
"""
from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone, timedelta

ROOT = os.path.join(os.path.dirname(__file__), "..")
STILLS = os.path.join(ROOT, "episodes", "EP001_Last_Delivery", "stills")
CLIPS = os.path.join(ROOT, "episodes", "EP001_Last_Delivery", "clips")
IST = timezone(timedelta(hours=5, minutes=30))

ENDPOINTS = [
    "https://ai.api.nvidia.com/v1/genai/nvidia/cosmos3-nano",
    "https://integrate.api.nvidia.com/v1/genai/nvidia/cosmos3-nano",
]

PROMPTS = {
    "B1": "Cinematic slow push-in, Indian delivery man 24 blue jacket black bag riding motorcycle on night city road, neon bokeh, photorealistic, gentle camera motion, no text",
    "B2": "Close-up brown cardboard box red FRAGILE tape on delivery bag, slight handheld night light, photorealistic, no logo",
    "B3": "Night apartment society gate, young delivery man blue jacket brown box, man at car window offering money, tense slow motion, cinematic",
    "B4": "Apartment corridor, 58 woman in saree opening door, delivery man blue jacket brown box outside, warm indoor vs cool hall light, slow dolly",
    "B5": "Indian living room night, brown box red tape on table, quiet still camera, cinematic",
    "B6": "Narrow back lane night, delivery man blue jacket brown box under street light looking at phone, conflicted, slow push",
    "B7": "Early morning, same delivery man blue jacket on motorcycle quieter road, hopeful, soft camera follow",
}


def nvidia_key() -> str:
    return (
        os.environ.get("NVIDIA_API_KEY")
        or os.environ.get("NVIDIA_VICTOR_VISION_KEY")
        or ""
    ).strip()


def extract_video(data: dict):
    for k in ("b64_video", "video", "mp4"):
        v = data.get(k)
        if isinstance(v, str) and len(v) > 100:
            raw = v.split(",", 1)[-1] if v.startswith("data:") else v
            try:
                return base64.b64decode(raw)
            except Exception:
                pass
    arts = data.get("artifacts") or data.get("data") or []
    if isinstance(arts, list):
        for a in arts:
            if not isinstance(a, dict):
                continue
            for k in ("base64", "b64_video", "video"):
                if a.get(k):
                    try:
                        return base64.b64decode(a[k])
                    except Exception:
                        pass
    return None


def nvidia_i2v(api_key: str, prompt: str, png_path: str) -> bytes:
    with open(png_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("ascii")
    bodies = [
        {
            "prompt": prompt,
            "image": f"data:image/png;base64,{img_b64}",
            "seed": 42,
            "resolution": "480_16_9",
            "num_output_frames": 49,
            "fps": 16.0,
        },
        {"prompt": prompt, "image": img_b64, "seed": 42},
        {"prompt": prompt, "seed": 42, "resolution": "480_16_9"},
    ]
    last = "no attempt"
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
                with urllib.request.urlopen(req, timeout=240) as resp:
                    data = json.load(resp)
                vid = extract_video(data)
                if vid:
                    return vid
                last = f"no_video {url}: {json.dumps(data)[:300]}"
            except urllib.error.HTTPError as e:
                last = f"HTTP {e.code} {url} {e.read().decode('utf-8', errors='replace')[:300]}"
            except Exception as e:
                last = f"{url} {e}"
    raise RuntimeError(last)


def ffmpeg_motion(png_path: str, out_path: str) -> None:
    cmd = [
        "ffmpeg", "-y", "-loop", "1", "-i", png_path,
        "-vf", "scale=768:1024,zoompan=z='min(zoom+0.0012,1.12)':d=125:s=768x1024:fps=25",
        "-t", "5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        out_path,
    ]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main() -> int:
    only = os.environ.get("ONLY_IDS", "B1").strip()
    ids = [x.strip() for x in only.split(",") if x.strip()] or ["B1"]
    os.makedirs(CLIPS, exist_ok=True)
    key = nvidia_key()
    log = {
        "updated": datetime.now(IST).isoformat(),
        "results": {},
        "nvidia_key": bool(key),
    }
    any_ok = False
    for pid in ids:
        still = os.path.join(STILLS, f"{pid}.png")
        out = os.path.join(CLIPS, f"{pid}.mp4")
        if not os.path.isfile(still):
            log["results"][pid] = {"status": "no_still"}
            print(pid, "no still")
            continue
        used = None
        err = None
        if key:
            try:
                print(pid, "NVIDIA I2V...")
                vid = nvidia_i2v(key, PROMPTS.get(pid, PROMPTS["B1"]), still)
                with open(out, "wb") as f:
                    f.write(vid)
                used = "nvidia_i2v"
            except Exception as e:
                err = str(e)[:500]
                print(pid, "NVIDIA fail", err)
        if used is None:
            print(pid, "ffmpeg motion-still fallback")
            ffmpeg_motion(still, out)
            used = "ffmpeg_motion_still"
        size = os.path.getsize(out)
        log["results"][pid] = {
            "status": "ok",
            "provider": used,
            "bytes": size,
            "nvidia_error": err,
        }
        print(pid, "OK", used, size)
        any_ok = True
    with open(os.path.join(CLIPS, "_run_log.json"), "w", encoding="utf-8") as f:
        json.dump(log, f, indent=2)
    print("DONE any_ok", any_ok)
    return 0 if any_ok else 1


if __name__ == "__main__":
    sys.exit(main())
