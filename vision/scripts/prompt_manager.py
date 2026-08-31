#!/usr/bin/env python3
"""EP001 Prompt Manager — SCRIPT.md + SHOT_LIST.md + CHARACTERS.md.

Stills = locked look. Clips = complete action in 4–8 seconds.
"""
from __future__ import annotations

RAHUL = (
    "same locked hero Rahul, Indian man 24, thin tired eyes, short styled black hair, "
    "full beard, blue zip-up collared delivery jacket over grey t-shirt, black backpack, "
    "NO hoodie NO helmet NO logos"
)
AMMI_VOICE = "soft older Indian mother voice on phone only, not on camera"
VIKRAM = (
    "Vikram, Indian man 32, neat hair, smart casual shirt, calm polite face with hidden threat"
)
MRS = (
    "Mrs Sharma, Indian woman 58, simple muted cotton saree, grey-black hair in a bun, "
    "worried kind face"
)
BOX = "closed brown cardboard parcel with red tape and FRAGILE label MRS SHARMA"
NEG = (
    "no watermark, no subtitles burned in, no extra logos, no gore, photorealistic cinematic, "
    "35mm Indian urban drama, natural skin"
)

# Still keyframes currently in production (A/B ids)
STILL_PROMPTS = {
    "A1": f"Photorealistic waist-up character sheet of {RAHUL}, studio light, front three-quarter, {NEG}",
    "A2": f"Photorealistic waist-up character sheet of {MRS}, soft indoor light, {NEG}",
    "A3": f"Photorealistic waist-up character sheet of {VIKRAM}, neutral light, {NEG}",
    "B1": (
        f"Night Indian city arterial road, neon shop signs bokeh, {RAHUL} riding a motorcycle, "
        f"both hands on handlebars, backpack on, rear three-quarter, traffic lights streaking, {NEG}"
    ),
    "B2": (
        f"Macro of {BOX} on a motorcycle delivery bag at night, only the word FRAGILE spelled correctly, {NEG}"
    ),
    "B3": (
        f"Night Indian society gate, TWO people: {RAHUL} standing with {BOX} in both hands, "
        f"and {VIKRAM} leaning from a parked car window holding cash toward him, {NEG}"
    ),
    "B4": (
        f"Dim Indian apartment corridor, {MRS} opening the door cautiously, {RAHUL} outside holding {BOX}, "
        f"warm indoor light vs cool hall, {NEG}"
    ),
    "B5": (
        f"Simple Indian living room night, {BOX} on a small table, blurred photo of a young man on the wall, {NEG}"
    ),
    "B6": (
        f"Narrow wet Indian chawl back lane at night, {RAHUL} holding {BOX} and a phone, one street lamp, {NEG}"
    ),
    "B7": (
        f"Soft early morning Indian road, {RAHUL} sitting on motorcycle riding toward camera, "
        f"hands on handlebars, headlight on, hopeful tired face, {NEG}"
    ),
}

# I2V / action prompts — what the 4–8s clip MUST perform
VIDEO_PROMPTS = {
    "B1": (
        f"4 second continuous night action shot. {RAHUL} rides a motorcycle toward then past camera "
        f"on a wet Indian city road with neon. He glances at a phone mounted near the handlebar, "
        f"mouth moves as if talking on an earphone to his mother, bag shifts with the ride. "
        f"Camera: slow tracking from three-quarter rear to side. Do not freeze. Wheels must rotate. {NEG}"
    ),
    "B2": (
        f"4 second insert. Hands of {RAHUL} pull {BOX} from the backpack on a parked bike at night, "
        f"tilt down to the FRAGILE tape. Camera slow push. Fingers move. {NEG}"
    ),
    "B3": (
        f"6 second two-shot action. {RAHUL} stands at an Indian society gate holding {BOX}. "
        f"A car window rolls, {VIKRAM} leans out and extends a wad of cash. Rahul shakes his head no, "
        f"steps back, turns toward the gate. Vikram's smile tightens. Camera handheld medium. {NEG}"
    ),
    "B4": (
        f"5 second action. Dim corridor. {RAHUL} rings a doorbell holding {BOX}. Door opens. "
        f"{MRS} looks at the box, breath catches, she gestures him inside. Camera over Rahul shoulder then push. {NEG}"
    ),
    "B5": (
        f"4 second quiet action. {RAHUL} sets {BOX} on a small table. {MRS} rests her hand near the tape "
        f"but does not open it. Camera slow push from box to her face to a blurred son photo on the wall. {NEG}"
    ),
    "B6": (
        f"6 second action. {RAHUL} walks fast down a narrow wet back lane carrying {BOX}, stops under a lamp, "
        f"looks at an incoming call, then lifts the phone to his ear and speaks a short urgent line. "
        f"Breathing visible. Camera follows then holds CU on phone. {NEG}"
    ),
    "B7": (
        f"5 second morning action. {RAHUL} rides toward camera on an empty-ish Indian road, "
        f"softer light, slight smile while speaking into earphone, bike moving, wheels turning. {NEG}"
    ),
    "1.1": f"Wide night: motorcycle with {RAHUL} enters frame on neon Indian road, traffic bed, wheels turning. {NEG}",
    "1.2": f"Medium: {RAHUL} on moving bike, bag visible, tired face, talking on earphone to Ammi. {NEG}",
    "1.3": "CU phone screen animation showing text MRS SHARMA FRAGILE Priority, thumb scrolls. no extra brands",
    "1.4": f"CU {RAHUL} lips: he mutters Fragile seedha drop seedha ghar, night wind, {NEG}",
    "2.1": f"Wide: {RAHUL} parks bike at lit society gate, kills engine, swings off. {NEG}",
    "2.2": f"Medium: {RAHUL} pulls {BOX} from bag, turns label to camera. {NEG}",
    "2.3": f"Medium: {VIKRAM} at car window, polite smile, speaks to {RAHUL} holding {BOX}. {NEG}",
    "2.4": f"CU wallet opens, notes offered toward {RAHUL}. {NEG}",
    "2.5": f"Medium: {RAHUL} refuses cash, walks toward gate with {BOX}, {VIKRAM} watches. {NEG}",
    "2.6": f"CU {VIKRAM} watching, smile fades to calm threat. {NEG}",
    "3.1": f"Medium: doorbell, {MRS} opens door cautiously, {RAHUL} with {BOX}. {NEG}",
    "3.2": f"Wide: simple flat, photo of young man on wall, {RAHUL} steps in. {NEG}",
    "3.3": f"CU {BOX} placed on table, red tape, hands withdraw. {NEG}",
    "3.4": f"Two-shot: {MRS} asks if anyone outside, {RAHUL} answers, uneasy. {NEG}",
    "3.5": f"CU {MRS} face changes when Vikram is named. {NEG}",
    "3.6": "CU wall photo of a young Indian man, camera drift, soft score mood, no text",
    "3.7": f"Medium: {MRS} whispers the box holds will and proof, {RAHUL} shakes head I am only delivery. {NEG}",
    "3.8": f"Door from inside: knock, {VIKRAM} voice off-camera Aunty main hoon. {NEG}",
    "3.9": f"CU {MRS} whisper Back door. Jaldi. to {RAHUL}. {NEG}",
    "4.1": f"Wide: {RAHUL} hurries down narrow lane with {BOX}, looking back. {NEG}",
    "4.2": f"CU phone unknown call, {RAHUL} hesitates to answer. {NEG}",
    "4.3": "Quick flash insert: medicine strip and rent cash worry, 1 second, then snap back",
    "4.4": f"Medium: {RAHUL} stops under lamp with {BOX}, decides, jaw sets. {NEG}",
    "4.5": f"CU {RAHUL} dials, says Police ek delivery hai mujhe lagta hai isme saboot hai. {NEG}",
    "5.1": f"Wide morning road softer light, motorcycle approaches. {NEG}",
    "5.2": f"Medium {RAHUL} rides, bag feels lighter, quiet relief. {NEG}",
    "5.3": f"CU {RAHUL} on earphone Medicine ka paisa aa jayega Ammi. {NEG}",
    "5.4": f"Wide bike leaves frame, empty morning road. {NEG}",
}


def still_prompt(shot_id: str) -> str:
    sid = shot_id.strip()
    if sid in STILL_PROMPTS:
        return STILL_PROMPTS[sid]
    if sid in VIDEO_PROMPTS:
        return VIDEO_PROMPTS[sid] + " still frame, not a collage"
    raise KeyError(sid)


def video_prompt(shot_id: str) -> str:
    sid = shot_id.strip()
    if sid in VIDEO_PROMPTS:
        return VIDEO_PROMPTS[sid]
    if sid in STILL_PROMPTS:
        return (
            "4 second cinematic motion from this locked still. Subject must move. "
            + STILL_PROMPTS[sid]
        )
    raise KeyError(sid)


def all_video_ids() -> list[str]:
    return list(VIDEO_PROMPTS.keys())
