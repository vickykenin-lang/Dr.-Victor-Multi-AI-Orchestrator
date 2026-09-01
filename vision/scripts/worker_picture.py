#!/usr/bin/env python3
"""Picture worker: Sora I2V from each keyframe. Identity from still."""
from __future__ import annotations

import os
import sys

from media_workers import sora_i2v

PROMPTS = {
    "K1": "Using reference images. The attached still is the first frame. Same face and shirt. 4s, lead walks to the bonus list, stops, checks the missing name. No new person.",
    "K2": "Using reference images. The attached still is the first frame. Same guard. 4s, guard points at the printer, speaks one beat, no new face.",
    "K3": "Using reference images. The attached still is the first frame. Same intern. 4s, intern glances at the door then hits print. No new face.",
    "K4": "Using reference images. The attached still is the first frame. Same lead. 4s, lead watches the CCTV playback, freeze on intern. No new face.",
}


def run(job_dir: str, topic: str) -> list:
    src = os.path.join(job_dir, "artifacts", "keyframes")
    dst = os.path.join(job_dir, "artifacts", "picture")
    os.makedirs(dst, exist_ok=True)
    done = []
    for kid, prompt in PROMPTS.items():
        png = os.path.join(src, f"{kid}.png")
        if not os.path.isfile(png):
            print("skip missing still", kid)
            continue
        print("picture", kid)
        mp4 = sora_i2v(prompt, png)
        path = os.path.join(dst, f"{kid}.mp4")
        with open(path, "wb") as f:
            f.write(mp4)
        done.append(kid)
    with open(os.path.join(job_dir, "artifacts", "picture.md"), "w", encoding="utf-8") as f:
        f.write("# Picture\n\nspec: 16:9 1280x720\nclips: " + ",".join(done) + "\n")
    if not done:
        raise RuntimeError("no picture clips")
    return done


if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "")
