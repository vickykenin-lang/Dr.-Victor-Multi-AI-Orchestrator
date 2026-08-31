#!/usr/bin/env python3
"""EP001 Prompt Manager. Video prompts must stay under MAX_CHARS after B1 lock."""
from __future__ import annotations

MAX_CHARS = 1000

RAHUL = (
    "same locked hero Rahul, Indian man 24, thin tired eyes, short styled black hair, "
    "full beard, blue zip-up collared delivery jacket over grey t-shirt, black backpack, "
    "NO hoodie NO helmet NO logos"
)
VIKRAM = (
    "Vikram, Indian man 32, neat hair, smart casual shirt, calm polite face with hidden threat"
)
MRS = (
    "Mrs Sharma, Indian woman 58, simple muted cotton saree, grey-black hair in a bun, "
    "worried kind face"
)
BOX = "closed brown cardboard parcel with red tape and FRAGILE label MRS SHARMA"
NEG = "photorealistic cinematic, no watermark no logos no gore"

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
        "4-second continuous cinematic night action shot. Same locked hero Rahul, with exact face, "
        "outfit, bag and motorcycle continuity. Rahul rides naturally toward and then past the camera "
        "on a wet Indian city road glowing with neon signs, headlights and colorful reflections. "
        "The motorcycle stays in continuous forward motion; both wheels visibly rotate with realistic "
        "motion blur, suspension movement and slight water spray. Rahul briefly glances at a phone "
        "securely mounted near the handlebar, then looks back at the road. His mouth moves subtly as if "
        "speaking to his mother through an earphone. His bag and clothes shift naturally with speed, "
        "wind and road vibration. Camera smoothly tracks from a three-quarter rear angle into a dynamic "
        "side profile as he passes. Strong background parallax, moving traffic and changing wet-road "
        "reflections create real speed. Photorealistic cinematic lighting. No freeze, static frames, "
        "sliding bike, frozen wheels, face drift, morphing, cuts or sudden camera jumps."
    ),
    "B2": f"4s insert. {RAHUL} pulls {BOX} from backpack on parked night bike. Hands move. Push to FRAGILE tape. Wheels still. {NEG}",
    "B3": f"6s. {RAHUL} at gate with {BOX}. {VIKRAM} leans from car, offers cash. Rahul shakes head, walks to gate. Smile tightens. {NEG}",
    "B4": f"5s. {RAHUL} rings doorbell with {BOX}. {MRS} opens, sees box, gestures him in. Over-shoulder then push. {NEG}",
    "B5": f"4s. {RAHUL} sets {BOX} on table. {MRS} hand near tape, does not open. Push box to face to wall photo. {NEG}",
    "B6": f"6s. {RAHUL} hurries wet lane with {BOX}, stops under lamp, checks call, phone to ear, urgent line. Follow then CU. {NEG}",
    "B7": f"5s morning. {RAHUL} rides toward camera, wheels turn, earphone talk, slight relief. {NEG}",
    "1.1": f"Wide night: {RAHUL} bike enters neon road, wheels turning. {NEG}",
    "1.2": f"Medium: {RAHUL} on moving bike, bag visible, earphone to Ammi. {NEG}",
    "1.3": "CU phone screen MRS SHARMA FRAGILE Priority, thumb scrolls.",
    "1.4": f"CU {RAHUL} mutters Fragile seedha drop. {NEG}",
    "2.1": f"Wide: {RAHUL} parks at gate, engine off, swings off bike. {NEG}",
    "2.2": f"Medium: {RAHUL} pulls {BOX}, turns label to camera. {NEG}",
    "2.3": f"Medium: {VIKRAM} car window talks to {RAHUL} with {BOX}. {NEG}",
    "2.4": "CU wallet opens, notes offered.",
    "2.5": f"Medium: {RAHUL} refuses cash, walks to gate with {BOX}. {NEG}",
    "2.6": f"CU {VIKRAM} smile fades to threat. {NEG}",
    "3.1": f"Medium: doorbell, {MRS} opens, {RAHUL} with {BOX}. {NEG}",
    "3.2": f"Wide: flat, son photo wall, {RAHUL} steps in. {NEG}",
    "3.3": f"CU {BOX} on table, hands withdraw. {NEG}",
    "3.4": f"Two-shot: {MRS} asks who was outside, {RAHUL} answers. {NEG}",
    "3.5": f"CU {MRS} face changes at Vikram name. {NEG}",
    "3.6": "CU wall photo young man, slow drift.",
    "3.7": f"Medium: {MRS} whispers will and proof, {RAHUL} I am only delivery. {NEG}",
    "3.8": f"Knock, {VIKRAM} off-camera Aunty main hoon. {NEG}",
    "3.9": f"CU {MRS} Back door. Jaldi. {NEG}",
    "4.1": f"Wide: {RAHUL} hurries lane with {BOX}, looks back. {NEG}",
    "4.2": f"CU unknown call, {RAHUL} hesitates. {NEG}",
    "4.3": "Flash: medicine strip and rent cash, 1s.",
    "4.4": f"Medium: {RAHUL} stops under lamp with {BOX}, decides. {NEG}",
    "4.5": f"CU {RAHUL} dials Police, saboot hai. {NEG}",
    "5.1": f"Wide morning road, bike approaches. {NEG}",
    "5.2": f"Medium {RAHUL} rides, quieter bag. {NEG}",
    "5.3": f"CU {RAHUL} Ammi, medicine paisa aa jayega. {NEG}",
    "5.4": f"Wide bike leaves morning road. {NEG}",
}


def _clip(text: str, shot_id: str) -> str:
    text = text.strip()
    if shot_id == "B1":
        return text
    if len(text) <= MAX_CHARS:
        return text
    return text[: MAX_CHARS - 1].rsplit(" ", 1)[0] + “.”


def still_prompt(shot_id: str) -> str:
    sid = shot_id.strip()
    if sid in STILL_PROMPTS:
        return _clip(STILL_PROMPTS[sid], sid)
    if sid in VIDEO_PROMPTS:
        return _clip(VIDEO_PROMPTS[sid] + " still frame", sid)
    raise KeyError(sid)


def video_prompt(shot_id: str) -> str:
    sid = shot_id.strip()
    if sid in VIDEO_PROMPTS:
        return _clip(VIDEO_PROMPTS[sid], sid)
    if sid in STILL_PROMPTS:
        return _clip("4s motion. Subject moves. " + STILL_PROMPTS[sid], sid)
    raise KeyError(sid)


def all_video_ids() -> list[str]:
    return list(VIDEO_PROMPTS.keys())
