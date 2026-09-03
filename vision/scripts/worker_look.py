#!/usr/bin/env python3
"""Look lock: 3 Hindi-production identity sheets. No extra cast."""
from __future__ import annotations

import json
import os
import sys

from media_workers import make_still

ROLES = [
    ("L1", "Hindi film lead, Indian adult office worker, tired face, light blue formal shirt, waist-up studio sheet, no text"),
    ("L2", "Hindi film intern, Indian young adult, nervous, casual formal shirt, waist-up studio sheet, no text"),
    ("L3", "Hindi film security guard, Indian adult, uniform, calm, waist-up studio sheet, no text"),
]


def run(job_dir: str, topic: str) -> dict:
    look = os.path.join(job_dir, "artifacts", "look")
    os.makedirs(look, exist_ok=True)
    lock = {"frozen": True, "topic": topic, "language": "Hindi", "sheets": []}
    for sid, desc in ROLES:
        prompt = (
            f"Photorealistic character sheet for a Hindi short film. {desc}. "
            "No English text, no watermark, no extra people, no caption."
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
        f.write("# Look lock\n\nlanguage: Hindi\nfrozen: yes\nsheets: L1 L2 L3\n")
    return lock


if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "")
