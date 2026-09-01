#!/usr/bin/env python3
"""Keyframe worker: scene stills that must reuse look-lock identities."""
from __future__ import annotations

import json
import os
import sys

from media_workers import make_still

SHOTS = [
    ("K1", "L1", "office corridor night, printed bonus list on wall, lead from reference, name missing on list"),
    ("K2", "L3", "lobby desk night, security guard from reference pointing at printer"),
    ("K3", "L2", "open office, intern from reference at a computer before a printer"),
    ("K4", "L1", "CCTV monitor room, screen shows intern at printer, lead from reference watching"),
]


def run(job_dir: str, topic: str) -> list:
    lock_path = os.path.join(job_dir, "artifacts", "identity_lock.json")
    if not os.path.isfile(lock_path):
        raise RuntimeError("no identity_lock.json")
    out_dir = os.path.join(job_dir, "artifacts", "keyframes")
    os.makedirs(out_dir, exist_ok=True)
    made = []
    for kid, lid, scene in SHOTS:
        prompt = (
            "Using reference images. Photorealistic still. 16:9 feel. "
            f"Keep identity {lid} locked from character sheet. {scene}. "
            "No new face, no watermark, no unreadable text banners."
        )
        print("keyframe", kid, lid)
        img = make_still(prompt)
        path = os.path.join(out_dir, f"{kid}.png")
        with open(path, "wb") as f:
            f.write(img)
        made.append(kid)
    with open(os.path.join(job_dir, "artifacts", "keyframes.md"), "w", encoding="utf-8") as f:
        f.write("# Keyframes\n\nshots: " + ",".join(made) + "\nidentity_source: look_lock\n")
    return made


if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "")
