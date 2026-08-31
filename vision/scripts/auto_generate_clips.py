#!/usr/bin/env python3
"""EP001 clips: JSON2Video -> Veo -> NVIDIA -> ffmpeg."""
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
NVIDIA_ENDPOINTS = [
    "https://ai.api.nvidia.com/v1/genai/nvidia/cosmos3-nano",
    "https://integrate.api.nvidia.com/v1/genai/nvidia/cosmos3-nano",
]
PROMPTS = {
    "B1": "Cinematic slow push-in, Indian delivery man blue jacket black bag riding motorcycle night city road",
    "B2": "Slow push on brown cardboard box red FRAGILE tape",
    "B3": "Night apartment gate, delivery man with box beside parked car",
    "B4": "Corridor, woman in saree at door, delivery man with box",
    "B5": "Quiet living room, box on table",
    "B6": "Narrow Indian lane night, delivery man with box and phone",
    "B7": "Morning, man riding motorcycle toward camera",
}


def j2v_key() -> str:
    for name in ("JASON2VIDEO_API_KEY", "JSON2VIDEO_API_KEY"):
        val = (os.environ.get(name) or "").strip()
        if val:
            print("using", name, "len", len(val))
            return val
    return ""


def gemini_key() -> str:
    for name in ("GEMINI_VIO_API_KEY", "GEMINI_VEO_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"):
        val = (os.environ.get(name) or "").strip()
        if val:
            print("using", name, "len", len(val))
            return val
    return ""


def nvidia_key() -> str:
    return (os.environ.get("NVIDIA_API_KEY") or os.environ.get("NVIDIA_VICTOR_VISION_KEY") or "").strip()


def http_json(method: str, url: str, headers: dict, body=None, timeout=180):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        return json.loads(raw.decode("utf-8")) if raw else {}


def find_url(obj):
    if isinstance(obj, dict):
        for k in ("url", "movieUrl", "result", "videoUrl", "download_url"):
            v = obj.get(k)
            if isinstance(v, str) and v.startswith("http") and (".mp4" in v or "json2video" in v or "video" in v):
                return v
        for v in obj.values():
            found = find_url(v)
            if found:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = find_url(v)
            if found:
                return found
    return None


def download_url(url: str, headers=None) -> bytes:
    req = urllib.request.Request(url, headers=headers or {}, method="GET")
    with urllib.request.urlopen(req, timeout=180) as resp:
        return resp.read()


def json2video_clip(api_key: str, pid: str) -> bytes:
    src = RAW_STILL.format(pid=pid)
    body = {
        "resolution": "instagram-story",
        "quality": "high",
        "scenes": [{
            "duration": 5,
            "elements": [{
                "type": "image",
                "src": src,
                "duration": 5,
                "zoom": 1.12,
            }],
        }],
    }
    headers = {"Content-Type": "application/json", "x-api-key": api_key}
    print("JSON2Video POST", pid, src)
    try:
        created = http_json("POST", J2V, headers, body, timeout=60)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"J2V HTTP {e.code} {e.read().decode('utf-8', errors='replace')[:400]}")
    project = created.get("project") or created.get("id") or (created.get("movie") or {}).get("project")
    if not project:
        raise RuntimeError(f"J2V no project: {json.dumps(created)[:400]}")
    print("JSON2Video project", project)
    deadline = time.time() + 300
    last = created
    while time.time() < deadline:
        time.sleep(5)
        try:
            st = http_json("GET", f"{J2V}?project={urllib.parse.quote(str(project))}", {"x-api-key": api_key}, timeout=60)
        except urllib.error.HTTPError as e:
            last = {"poll_error": e.read().decode("utf-8", errors="replace")[:300]}
            continue
        last = st
        movie = st.get("movie") or st
        status = (movie.get("status") if isinstance(movie, dict) else None) or st.get("status")
        print("JSON2Video status", status)
        if status in ("error", "failed", "timeout"):
            raise RuntimeError(f"J2V {status}: {json.dumps(st)[:400]}")
        if status in ("done", "success", "finished", "complete", "completed"):
            url = find_url(st)
            if not url:
                raise RuntimeError(f"J2V done no url: {json.dumps(st)[:500]}")
            vid = download_url(url)
            if not vid or len(vid) < 1000:
                raise RuntimeError("J2V empty mp4")
            return vid
    raise RuntimeError(f"J2V timeout: {json.dumps(last)[:400]}")


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
    img = {"bytesBase64Encoded": img_b64, "mimeType": "image/png"}
    body = {"instances": [{"prompt": prompt, "image": img}], "parameters": {"aspectRatio": "9:16"}}
    last = "no veo"
    for model in VEO_MODELS:
        url = f"{GEMINI_BASE}/models/{model}:predictLongRunning"
        try:
            op = http_json("POST", url, headers, body, timeout=60)
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code} {model} {e.read().decode('utf-8', errors='replace')[:250]}"
            print(last)
            continue
        name = op.get("name")
        if not name:
            last = f"no op {model}"
            continue
        deadline = time.time() + 300
        while time.time() < deadline:
            time.sleep(12)
            st = http_json("GET", f"{GEMINI_BASE}/{name}", {"x-goog-api-key": api_key}, timeout=60)
            if st.get("error"):
                last = json.dumps(st["error"])[:300]
                break
            if not st.get("done"):
                continue
            uri = find_video_uri(st)
            if uri:
                return download_url(uri, {"x-goog-api-key": api_key})
            last = "done no uri"
            break
    raise RuntimeError(last)


def nvidia_i2v(api_key: str, prompt: str, png_path: str) -> bytes:
    raise RuntimeError("nvidia skipped cosmos 404")


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
    jkey = j2v_key()
    gkey = gemini_key()
    nkey = nvidia_key()
    log = {
        "updated": datetime.now(IST).isoformat(),
        "j2v_key": bool(jkey),
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
        if jkey:
            try:
                print(pid, "JSON2Video...")
                vid = json2video_clip(jkey, pid)
                with open(out, "wb") as f:
                    f.write(vid)
                used = "json2video"
            except Exception as e:
                err = str(e)[:500]
                print(pid, "J2V fail", err)
        if used is None and gkey:
            try:
                print(pid, "Veo...")
                vid = veo_i2v(gkey, prompt, still)
                with open(out, "wb") as f:
                    f.write(vid)
                used = "gemini_veo"
            except Exception as e:
                err = ((err + " | ") if err else "") + str(e)[:300]
                print(pid, "Veo fail", e)
        if used is None and nkey:
            try:
                vid = nvidia_i2v(nkey, prompt, still)
                with open(out, "wb") as f:
                    f.write(vid)
                used = "nvidia_i2v"
            except Exception as e:
                err = ((err + " | ") if err else "") + str(e)[:150]
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
