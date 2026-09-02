#!/usr/bin/env python3
"""Concat picture clips to master 16:9."""
from __future__ import annotations

import os
import subprocess
import sys


def run(job_dir: str, topic: str) -> str:
    pic = os.path.join(job_dir, "artifacts", "picture")
    out_dir = os.path.join(job_dir, "artifacts", "assembly")
    os.makedirs(out_dir, exist_ok=True)
    clips = [os.path.join(pic, f"K{i}.mp4") for i in range(1, 5) if os.path.isfile(os.path.join(pic, f"K{i}.mp4"))]
    if not clips:
        raise RuntimeError("no clips to assemble")
    lst = os.path.join(out_dir, "list.txt")
    with open(lst, "w", encoding="utf-8") as f:
        for c in clips:
            f.write(f"file '{os.path.abspath(c)}'\n")
    master = os.path.join(out_dir, "master.mp4")
    subprocess.check_call(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", master],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if not os.path.isfile(master) or os.path.getsize(master) < 1000:
        raise RuntimeError("master empty")
    with open(os.path.join(job_dir, "artifacts", "assembly.md"), "w", encoding="utf-8") as f:
        f.write(f"# Assembly\n\nmaster: artifacts/assembly/master.mp4\nclips: {len(clips)}\n")
    print("master", master, os.path.getsize(master))
    return master


if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "")
