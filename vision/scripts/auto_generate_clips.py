#!/usr/bin/env python3
"""EP001 clips: Gemini Veo I2V primary, NVIDIA I2V secondary, ffmpeg last."""
from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone, timedelta

ROOT = os.path.join(os.path.dirname(__file__), "..")
STILLS = os.path.join(ROOT, "episodes", "EP001_Last_Delivery", "stills")
CLIPS = os.path.join(ROOT, "episodes", "EP001_Last_Delivery", "clips")
IST = timezone(timedelta(hours=5, minutes=30))
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"
VEO_MODELS = [
    "veo-3.1-generate-preview",
    "veo-3.1-fast-generate-preview",
    "veo-3.1-lite-generate-preview",
]
NVIDIA_ENDPOINTS = [
    "https://ai.api.nvidia.com/v1/genai/nvidia/cosmos3-nano",
    "https://integrate.api.nvidia.com/v1/genai/nvidia/cosmos3-nano",
]
PROMPTS = {
    "B1": "Cinematic slow push-in, Indian delivery man blue jacket black bag riding motorcycle night city road, gentle camera motion, photorealistic, no text",
    "B2": "Slow push on brown cardboard box red FRAGILE tape, night light, photorealistic, no extra text",
    "B3": "Night apartment gate, delivery man blue jacket holding box beside a parked car, slight handheld, cinematic",
    "B4": "Corridor, woman in saree at open door, delivery man with box, slow dolly, cinematic",
    "B5": "Quiet living room, box on table, still camera, cinematic",
    "B6": "Narrow Indian lane night, delivery man with box and phone, slow push, cinematic",
    "B7": "Morning, same man riding motorcycle toward camera, soft follow, cinematic",
}


def gemini_key() -> str:
    return (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "").strip()


def nvidia_key() -> str:
    return (os.environ.get("NVIDIA_API_KEY") or os.environ.get("NVIDIA_VICTOR_VISION_KEY") or "").strip()


def http_json(method: str, url: str, headers: dict, body=None, timeout=180):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))


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


def download_url(url: str, headers: dict) -> bytes:
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=180) as resp:
        return resp.read()


def veo_bodies(prompt: str, img_b64: str):
    img_a = {"bytesBase64Encoded": img_b64, "mimeType": "image/png"}
    img_b = {"inlineData": {"mimeType": "image/png", "data": img_b64}}
    return [
        {"instances": [{"prompt": prompt, "image": img_a}], "parameters": {"aspectRatio": "9:16", "resolution": "720p"}},
        {"instances": [{"prompt": prompt, "image": img_a}]},
        {"instances": [{"prompt": prompt, "image": img_b}], "parameters": {"aspectRatio": "9:16"}},
        {"instances": [{"prompt": prompt}]},
    ]


def veo_i2v(api_key: str, prompt: str, png_path: str) -> bytes:
    with open(png_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("ascii")
    headers = {"Content-Type": "application/json", "x-goog-api-key": api_key}
    last = "no veo attempt"
    for model in VEO_MODELS:
        url = f"{GEMINI_BASE}/models/{model}:predictLongRunning"
        for body in veo_bodies(prompt, img_b64):
            try:
                print("Veo start", model, list((body.get("instances") or [{}])[0].keys()))
                op = http_json("POST", url, headers, body, timeout=120)
            except urllib.error.HTTPError as e:
                last = f"HTTP {e.code} {model} {e.read().decode('utf-8', errors='replace')[:350]}"
                print(last)
                continue
            except Exception as e:
                last = f"{model} {e}"
                print(last)
                continue
            name = op.get("name")
            if not name:
                last = f"no op name {model}: {json.dumps(op)[:300]}"
                continue
            deadline = time.time() + 420
            while time.time() < deadline:
                time.sleep(12)
                try:
                    st = http_json("GET", f"{GEMINI_BASE}/{name}", {"x-goog-api-key": api_key}, timeout=60)
                except urllib.error.HTTPError as e:
                    last = f"poll HTTP {e.code} {e.read().decode('utf-8', errors='replace')[:300]}"
                    continue
                if st.get("error"):
                    last = f"veo error {model}: {json.dumps(st['error'])[:400]}"
                    print(last)
                    break
                if not st.get("done"):
                    print("Veo polling", model)
                    continue
                uri = find_video_uri(st)
                if not uri:
                    last = f"done no uri {model}: {json.dumps(st)[:400]}"
                    break
                vid = download_url(uri, {"x-goog-api-key": api_key})
                if vid and len(vid) > 1000:
                    return vid
                last = f"empty download {model}"
                break
            else:
                last = f"timeout {model}"
    raise RuntimeError(last)


def nvidia_i2v(api_key: str, prompt: str, png_path: str) -> bytes:
    with open(png_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("ascii")
    last = "nvidia none"
    body = {"prompt": prompt, "image": f"data:image/png;base64,{img_b64}", "seed": 42}
    for url in NVIDIA_ENDPOINTS:
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
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.load(resp)
            raw = data.get("b64_video")
            if raw:
                return base64.b64decode(raw.split(",", 1)[-1] if raw.startswith("data:") else raw)
            last = f"no_video {url}"
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code} {url}"
        except Exception as e:
            last = str(e)
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
    gkey = gemini_key()
    nkey = nvidia_key()
    log = {
        "updated": datetime.now(IST).isoformat(),
        "gemini_key": bool(gkey),
        "nvidia_key": bool(nkey),
        "results": {},
    }
    any_ok = False
    for pid in ids:
        still = os.path.join(STILLS, f"{pid}.png")
        out = os.path.join(CLIPS, f"{pid}.mp4")
        if not os.path.isfile(still):
            log["results"][pid] = {"status": "no_still"}
            continue
        used = None
        err = None
        prompt = PROMPTS.get(pid, PROMPTS["B1"])
        if gkey:
            try:
                print(pid, "Gemini Veo I2V...")
                vid = veo_i2v(gkey, prompt, still)
                with open(out, "wb") as f:
                    f.write(vid)
                used = "gemini_veo"
            except Exception as e:
                err = str(e)[:600]
                print(pid, "Veo fail", err)
        if used is None and nkey:
            try:
                vid = nvidia_i2v(nkey, prompt, still)
                with open(out, "wb") as f:
                    f.write(vid)
                used = "nvidia_i2v"
            except Exception as e:
                err = ((err + " | ") if err else "") + str(e)[:200]
        if used is None:
            ffmpeg_motion(still, out)
            used = "ffmpeg_motion_still"
        log["results"][pid] = {
            "status": "ok",
            "provider": used,
            "bytes": os.path.getsize(out),
            "error": err,
        }
        print(pid, "OK", used, os.path.getsize(out))
        any_ok = True
    with open(os.path.join(CLIPS, "_run_log.json"), "w", encoding="utf-8") as f:
        json.dump(log, f, indent=2)
    return 0 if any_ok else 1


if __name__ == "__main__":
    sys.exit(main())
