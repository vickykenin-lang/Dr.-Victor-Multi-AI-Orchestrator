#!/usr/bin/env python3
"""Keyframes: attach locked L-sheet PNG. Text-only T2I is forbidden."""
from __future__ import annotations

import os
import sys

from media_workers import make_still

SHOTS = [
    ("K1", "L1", "raat ke office corridor, deewar par Hindi bonus list, lead list padh raha hai"),
    ("K2", "L3", "lobby desk raat, guard printer ki taraf ishara kar raha hai"),
    ("K3", "L2", "open office, intern computer ke paas printer se pehle"),
    ("K4", "L1", "CCTV room, screen par intern printer pe, lead dekh raha hai"),
]


def run(job_dir: str, topic: str) -> list:
    lock_path = os.path.join(job_dir, "artifacts", "identity_lock.json")
    if not os.path.isfile(lock_path):
        raise RuntimeError("no identity_lock.json")
    look = os.path.join(job_dir, "artifacts", "look")
    out_dir = os.path.join(job_dir, "artifacts", "keyframes")
    os.makedirs(out_dir, exist_ok=True)
    made = []
    for kid, lid, scene in SHOTS:
        ref = os.path.join(look, f"{lid}.png")
        if not os.path.isfile(ref):
            raise RuntimeError(f"missing look sheet {lid}")
        prompt = (
            "Hindi short film still. Attached photo is the ONLY allowed face. "
            f"Keep that exact face, hair, skin, clothes. Scene: {scene}. "
            "16:9 cinematic. No new person. No English text. No caption. No watermark."
        )
        print("keyframe", kid, "ref", lid)
        img = make_still(prompt, ref_png=ref)
        path = os.path.join(out_dir, f"{kid}.png")
        with open(path, "wb") as f:
            f.write(img)
        made.append(kid)
    with open(os.path.join(job_dir, "artifacts", "keyframes.md"), "w", encoding="utf-8") as f:
        f.write("# Keyframes\n\nlanguage: Hindi\nref_attached: yes\nshots: " + ",".join(made) + "\n")
    return made


if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "")
