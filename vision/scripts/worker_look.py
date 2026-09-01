#!/usr/bin/env python3
"""Look lock worker: 3 identity sheets from brief. No extra cast."""
from __future__ import annotations

import json
import os
import sys

from media_workers import make_still

ROLES = [
    ("L1", "lead office worker whose name is missing from a bonus list, Indian adult, tired, formal shirt, waist-up, studio light"),
    ("L2", "young office intern, Indian adult, slightly nervous, casual formal, waist-up, studio light"),
    ("L3", "building security guard, Indian adult, uniform, calm, waist-up, studio light"),
]


def run(job_dir: str, topic: str) -> dict:
    look = os.path.join(job_dir, "artifacts", "look")
    os.makedirs(look, exist_ok=True)
    lock = {"frozen": True, "topic": topic, "sheets": []}
    for sid, desc in ROLES:
        prompt = (
            f"Photorealistic character sheet. {desc}. "
            f"Same person if regenerated. No text, no watermark, no extra people."
        )
        print("look", sid)
        img = make_still(prompt)
        path = os.path.join(look, f"{sid}.png")
        with open(path, "wb") as f:
            f.write(img)
        lock["sheets"].append({"id": sid, "file": f"artifacts/look/{sid}.png", "desc": desc})
    with open(os.path.join(job_dir, "artifacts", "identity_lock.json"), "w", encoding="utf-8") as f:
        json.dump(lock, f, indent=2)
        f.write("\n")
    with open(os.path.join(job_dir, "artifacts", "look_lock.md"), "w", encoding="utf-8") as f:
        f.write("# Look lock\n\nfrozen: yes\nsheets: L1 L2 L3\n")
    return lock


if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "")
