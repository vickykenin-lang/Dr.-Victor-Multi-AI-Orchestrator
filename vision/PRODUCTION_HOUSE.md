# Vision — Production House Process

Language lock: Hindi. Dialogue, on-screen paper, and prompts are Hindi.
No English title overlay. No burned captions unless a later sound/caption stage is added.

Owner gate: Topic OK only.
Director QC at every stage. Face drift = FAIL, retry the stage that broke identity. No manual frame edits.

## Pipeline

inbox → Topic OK → intake → development → screenplay → look_lock → keyframes → picture → sound → assembly → delivery → done

Gaps live in `vision/engine/gaps.json`. After PASS the engine waits then self-triggers.
15-minute scanner restarts any job that is not done.

## Stage rules

### look_lock
Exactly 3 sheets: L1 lead, L2 intern, L3 guard.
Write `identity_lock.json`. After this, no new face.
Stills: Gemini T2I (`GEMINI_API_KEY`).

### keyframes
K1–K4 stills. Each shot names one locked id (L1/L2/L3).
Worker MUST attach that `L*.png` as image input, not only the words "using reference images".
Text-only T2I is a process fail.

### picture
Image-to-video from the keyframe PNG.
Provider order: `KEI_I2V_KEY` / kie.ai only.
Do not fall back to Sora. If Kie fails, Director FAIL picture and retry.
Prompts ≤ 1000 characters. Hindi speech if anyone talks. No new person.

### sound
Pass-through picture audio until a Hindi VO worker exists.
Do not burn English captions.

### assembly
Remotion Master or ffmpeg concat.
No title card, no lower-third, no watermark.
16:9 1280x720.

### delivery
Point to `artifacts/assembly/master.mp4`.

## Identity
Look freeze is the only cast list.
If picture faces do not match look sheets, fail picture and return to keyframes.
