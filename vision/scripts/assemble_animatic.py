#!/usr/bin/env python3
"""Concat B1-B7 clips into a silent animatic master. Not the final movie."""
from __future__ import annotations

import os
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "episodes", "EP001_Last_Delivery")
CLIPS = os.path.join(ROOT, "clips")
MASTERS = os.path.join(ROOT, "masters")
ORDER = ["B1", "B2", "B3", "B4", "B5", "B6", "B7"]


def main() -> int:
    os.makedirs(MASTERS, exist_ok=True)
    files = []
    for pid in ORDER:
        p = os.path.join(CLIPS, f"{pid}.mp4")
        if os.path.isfile(p):
            files.append(p)
    if len(files) < 2:
        print("need at least 2 clips to assemble, have", len(files))
        return 0
    list_path = os.path.join(CLIPS, "_concat.txt")
    with open(list_path, "w", encoding="utf-8") as f:
        for p in files:
            f.write(f"file '{os.path.abspath(p)}'\n")
    out = os.path.join(MASTERS, "EP001_animatic_silent.mp4")
    cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_path,
        "-c", "copy", out,
    ]
    try:
        subprocess.check_call(cmd)
    except subprocess.CalledProcessError:
        cmd = [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_path,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out,
        ]
        subprocess.check_call(cmd)
    print("master", out, os.path.getsize(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
