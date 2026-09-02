#!/usr/bin/env python3
"""Assembly: Remotion Master from existing picture clips. ffmpeg fallback."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys

REMOTION = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "remotion"))


def _clips(job_dir: str) -> list[str]:
    pic = os.path.join(job_dir, "artifacts", "picture")
    return [f"K{i}.mp4" for i in range(1, 5) if os.path.isfile(os.path.join(pic, f"K{i}.mp4"))]


def _ffmpeg_concat(job_dir: str, names: list[str], master: str) -> None:
    pic = os.path.join(job_dir, "artifacts", "picture")
    lst = os.path.join(os.path.dirname(master), "list.txt")
    with open(lst, "w", encoding="utf-8") as f:
        for n in names:
            f.write(f"file '{os.path.abspath(os.path.join(pic, n))}'\n")
    subprocess.check_call(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", master],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _remotion(job_dir: str, names: list[str], title: str, master: str) -> None:
    pub = os.path.join(REMOTION, "public")
    out_dir = os.path.join(REMOTION, "out")
    os.makedirs(pub, exist_ok=True)
    os.makedirs(out_dir, exist_ok=True)
    pic = os.path.join(job_dir, "artifacts", "picture")
    for n in names:
        shutil.copy2(os.path.join(pic, n), os.path.join(pub, n))
    if not os.path.isdir(os.path.join(REMOTION, "node_modules")):
        subprocess.check_call(["npm", "install", "--omit=dev"], cwd=REMOTION)
    props = os.path.join(out_dir, "props.json")
    with open(props, "w", encoding="utf-8") as f:
        json.dump({"clips": names, "title": title or "JOB"}, f)
    dest = os.path.join(out_dir, "master.mp4")
    subprocess.check_call(
        ["npx", "remotion", "render", "Master", dest, f"--props={props}"],
        cwd=REMOTION,
    )
    if not os.path.isfile(dest) or os.path.getsize(dest) < 1000:
        raise RuntimeError("remotion master empty")
    shutil.copy2(dest, master)


def run(job_dir: str, topic: str) -> str:
    names = _clips(job_dir)
    if not names:
        raise RuntimeError("no clips to assemble")
    out_dir = os.path.join(job_dir, "artifacts", "assembly")
    os.makedirs(out_dir, exist_ok=True)
    master = os.path.join(out_dir, "master.mp4")
    title = topic or "Festival Bonus"
    try:
        _remotion(job_dir, names, title, master)
        how = "remotion"
    except Exception as e:
        print("remotion fail, ffmpeg", e)
        _ffmpeg_concat(job_dir, names, master)
        how = "ffmpeg-fallback"
    if not os.path.isfile(master) or os.path.getsize(master) < 1000:
        raise RuntimeError("master empty")
    with open(os.path.join(job_dir, "artifacts", "assembly.md"), "w", encoding="utf-8") as f:
        f.write(f"# Assembly\n\nengine: {how}\nclips: {','.join(names)}\nmaster: artifacts/assembly/master.mp4\n")
    print("master", how, os.path.getsize(master))
    return master


if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "")
