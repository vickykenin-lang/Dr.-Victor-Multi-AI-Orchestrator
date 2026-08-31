# EP001 — step by step (no batch until Founder: Process OK)

Grok does not generate media. Actions only. Stop at every Founder gate.

## STEP 0 — already done (do not redo unless Founder says)
Script, shot list, characters written. Prompt Manager exists. Sora 16:9 works. Veo quota dead. Old B1–B7 clips exist but faces are NOT locked. Treat those clips as tests, not final.

## STEP 1 — freeze
No new Sora. No new stills. Until Founder replies Process OK on this document.

## STEP 2 — lock three faces only
System generates only A1 Rahul, A2 Mrs Sharma, A3 Vikram (waist-up sheets).
Founder looks at three images.
If any face wrong: Changes: A1/A2/A3 + note. System regenerates that ID only.
If all three OK: Faces OK.
Nothing else generates in this step. No road, no box, no door.

## STEP 3 — lock scene stills from those faces
Only after Faces OK.
Order one still at a time: B1 then B2 then B3 then B4 then B5 then B6 then B7.
Each still must use the approved A-sheet as identity (same jacket/bag/box).
Director QC compares still to A-sheet.
Then Founder: B1 OK or Changes: B1.
Do not start B2 until B1 still is OK. Same for every letter.

## STEP 4 — write the clip prompt
After that still is OK, Prompt Manager builds one prompt:
- starts with Using reference images
- under 1000 characters
- action from SCRIPT + SHOT_LIST
- 4 seconds, 1280x720
Founder can replace the prompt text. No generate yet.

## STEP 5 — one clip I2V
System sends THAT still + THAT prompt to Sora (16:9).
Director extracts a frame, compares to A-sheet + still.
Fail: one retry only. Fail again: stop that shot, ask Founder.
Pass: show Founder the mp4.
Founder: B1 clip OK or redo B1 clip.
Do not start B2 clip until B1 clip OK.

## STEP 6 — repeat 3–5 for B2–B7
Same gates. No full-batch auto.

## STEP 7 — voice
Only after all seven clips Founder-OK.
Rahul / Ammi / Vikram / Mrs Sharma lines from SCRIPT.
Founder hears samples first.

## STEP 8 — edit
Concat clips in story order. Subs. Light score. Silent gaps if voice missing.
Founder watches master.

## STEP 9 — YouTube file
Only after Master OK.

## What we will NOT do
- Generate video to fix a wrong face. Fix the still first.
- Run B2–B7 together while faces drift.
- Use JSON2Video or ffmpeg zoom as the movie.
- Use Veo until quota is real.
- Invent new characters mid-shot.
