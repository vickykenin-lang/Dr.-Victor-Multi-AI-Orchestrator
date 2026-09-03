#!/usr/bin/env python3
"""Picture: Kie I2V only. Hindi. Skip clips that already exist."""
from __future__ import annotations

import os
import sys

from media_workers import make_clip

PROMPTS = {
    "K1": "Hindi short film. Attached still is first frame. Same face. 5s, list ki taraf dekhta hai, halka head turn. Agar bole to sirf Hindi. Naya chehra nahi.",
    "K2": "Hindi short film. Attached still is first frame. Same face. 5s, printer par haath, chhota ishara. Agar bole to sirf Hindi. Naya chehra nahi.",
    "K3": "Hindi short film. Attached still is first frame. Same face. 5s, type karta hai, printer ki taraf dekhta hai. Agar bole to sirf Hindi. Naya chehra nahi.",
    "K4": "Hindi short film. Attached still is first frame. Same face. 5s, CCTV screen dekhta hai, chhoti reaction. Agar bole to sirf Hindi. Naya chehra nahi.",
}


def run(job_dir: str, topic: str) -> list:
    src = os.path.join(job_dir, "artifacts", "keyframes")
    dst = os.path.join(job_dir, "artifacts", "picture")
    os.makedirs(dst, exist_ok=True)
    done = []
    for kid, prompt in PROMPTS.items():
        png = os.path.join(src, f"{kid}.png")
        outp = os.path.join(dst, f"{kid}.mp4")
        if os.path.isfile(outp) and os.path.getsize(outp) > 1000:
            print("have", kid)
            done.append(kid)
            continue
        if not os.path.isfile(png):
            print("skip missing still", kid)
            continue
        print("picture", kid)
        mp4 = make_clip(prompt, png)
        with open(outp, "wb") as f:
            f.write(mp4)
        done.append(kid)
    with open(os.path.join(job_dir, "artifacts", "picture.md"), "w", encoding="utf-8") as f:
        f.write("# Picture\n\nlanguage: Hindi\nprovider: kie.ai\nclips: " + ",".join(done) + "\n")
    if not done:
        raise RuntimeError("no picture clips")
    return done


if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "")
