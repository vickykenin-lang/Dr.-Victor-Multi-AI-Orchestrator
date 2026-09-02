#!/usr/bin/env python3
"""Picture worker: Kie I2V first clip only (K1 test), then more."""
from __future__ import annotations

import os
import sys

from media_workers import make_clip

PROMPTS = {
    "K1": "Using reference images. The attached still is the first frame. Same face. 5s, person looks at the bonus list, slight head turn. No new person.",
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
        outp = os.path.join(dst, f"{kid}.mp4")
        if os.path.isfile(outp) and os.path.getsize(outp) > 1000:
            print("have", kid)
            done.append(kid)
            continue
        print("picture", kid)
        mp4 = make_clip(prompt, png)
        with open(outp, "wb") as f:
            f.write(mp4)
        done.append(kid)
    with open(os.path.join(job_dir, "artifacts", "picture.md"), "w", encoding="utf-8") as f:
        f.write("# Picture\n\nspec: 16:9 test K1 via KEI_I2V_KEY\nclips: " + ",".join(done) + "\n")
    if not done:
        raise RuntimeError("no picture clips")
    return done


if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "")
