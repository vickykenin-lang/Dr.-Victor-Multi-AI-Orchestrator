#!/usr/bin/env python3
"""EP001 Prompt Manager. Identity lock first. Cap 1000."""
from __future__ import annotations

MAX_CHARS = 1000
REF = (
    "Using reference images. The attached still is the first frame. "
    "Do not change the actor. Same face, same beard, same blue zip jacket, same black backpack. "
    "No new person mid-shot. "
)

RAHUL = (
    "LOCKED identity Rahul from reference: Indian 24, thin, tired eyes, short black hair, full beard, "
    "blue zip delivery jacket, grey tee, black backpack, NO hoodie NO helmet"
)
VIKRAM = "LOCKED Vikram from reference: Indian 32, neat hair, shirt, polite threat"
MRS = "LOCKED Mrs Sharma from reference: Indian 58, muted saree, bun, worried"
BOX = "same brown FRAGILE carton MRS SHARMA from reference still"
NEG = "do not swap faces, do not age-shift, photorealistic, no watermark"

STILL_PROMPTS = {
    "A1": f"Photorealistic waist-up of {RAHUL}, studio light, {NEG}",
    "A2": f"Photorealistic waist-up of {MRS}, soft indoor light, {NEG}",
    "A3": f"Photorealistic waist-up of {VIKRAM}, neutral light, {NEG}",
    "B1": f"Night Indian city road neon, {RAHUL} riding motorcycle, bag on, rear three-quarter, {NEG}",
    "B2": f"Macro of {BOX}, FRAGILE spelled correctly only, night, {NEG}",
    "B3": f"Night society gate, {RAHUL} with {BOX}, {VIKRAM} at car window offering cash, {NEG}",
    "B4": f"Corridor, {MRS} opens door, {RAHUL} outside with {BOX}, {NEG}",
    "B5": f"Living room night, {BOX} on table, son photo on wall, {NEG}",
    "B6": f"Wet chawl lane night, {RAHUL} with {BOX} and phone under lamp, {NEG}",
    "B7": f"Morning road, {RAHUL} on motorcycle toward camera, wheels turning, {NEG}",
}

VIDEO_PROMPTS = {
    "B1": (
        f"4s night. {RAHUL} rides past camera on wet neon Indian road. Wheels rotate. "
        f"Glance at handlebar phone, earphone talk. Track rear three-quarter to side. {NEG}"
    ),
    "B2": f"4s. Hands of {RAHUL} pull {BOX} from backpack on parked night bike. Push to FRAGILE tape. {NEG}",
    "B3": f"4s. {RAHUL} at gate with {BOX}. {VIKRAM} offers cash from car. Rahul shakes head, walks to gate. {NEG}",
    "B4": f"4s. {RAHUL} rings doorbell with {BOX}. {MRS} opens, sees box, gestures inside. {NEG}",
    "B5": f"4s. {RAHUL} sets {BOX} on table. {MRS} hand near tape, does not open. {NEG}",
    "B6": f"4s. {RAHUL} hurries wet lane with {BOX}, stops, phone to ear. Same face whole shot. {NEG}",
    "B7": f"4s morning. {RAHUL} rides toward camera, wheels turn, same face as reference. {NEG}",
}


def _clip(text: str) -> str:
    text = text.strip()
    if len(text) <= MAX_CHARS:
        return text
    return text[: MAX_CHARS - 1].rsplit(" ", 1)[0] + "."


def still_prompt(shot_id: str) -> str:
    sid = shot_id.strip()
    if sid in STILL_PROMPTS:
        return _clip(STILL_PROMPTS[sid])
    raise KeyError(sid)


def video_prompt(shot_id: str) -> str:
    sid = shot_id.strip()
    body = VIDEO_PROMPTS.get(sid)
    if not body:
        raise KeyError(sid)
    return _clip(REF + body)


def all_video_ids():
    return list(VIDEO_PROMPTS.keys())
