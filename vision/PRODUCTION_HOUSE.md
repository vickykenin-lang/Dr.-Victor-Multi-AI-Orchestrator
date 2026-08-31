# Vision Production House Engine

This is the studio. EP001 is one job inside the studio. Topic can be anything later (including salary story). Engine does not change when topic changes.

Grok amends the engine. GitHub Actions + Director run the job. AURA2 stays out.

## What the engine is
A job folder goes from `inbox` to `published`.
Every department writes artifacts.
Director must PASS before the next department starts.
Founder only at 3 places: Topic OK, Faces OK, Publish OK.

## Job
`vision/jobs/<JOB_ID>/`
- brief.md        topic + length + language + channel
- state.json      current department + last director verdict
- script.md
- characters.md
- shot_list.md
- prompts/
- stills/
- clips/
- audio/
- masters/
- qc/

state.json department values, in order:
inbox → research → script → casting → stills → clips → sound → edit → publish → done

## Departments
1. Research — turn topic into logline + audience + tone
2. Writer — script + shot list from brief
3. Casting — A-sheets only (faces, wardrobe lock)
4. Camera stills — one scene keyframe per shot, identity from A-sheets
5. Picture clips — I2V from approved still + Prompt Manager (ref images, ≤1000, 16:9)
6. Sound — dialogue + bed from locked script lines
7. Edit — concat, subs, mix
8. Publish — YouTube file + metadata

## Director (every level)
After each department Director reads the artifact + previous lock files and writes `qc/<dept>.json`:
{ "pass": true|false, "reason": "...", "must_fix": ["..."] }
PASS → next department.
FAIL → same department retry once, then stop and ping Founder.
Director checks continuity: same face, jacket, bag, box, no new actor, no burned text, correct aspect.

## Founder gates (only 3)
- Topic OK — brief locked, production may start
- Faces OK — A-sheets locked, stills may start
- Publish OK — master may upload

Founder does not approve every B-still and every clip unless Director failed twice.

## Trigger
Founder drops a topic into inbox (or `Topic: ...`).
Action `vision_engine.yml` runs the current department only, then Director, then stops or advances.
No full-movie one-click until Director has passed every stage.

## Providers (workers, not the studio)
Stills: Gemini / NVIDIA FLUX
Clips: Sora 2 I2V 1280x720, Veo if quota exists
Sound: existing TTS secret when present
Never JSON2Video / Ken Burns as picture finish.

## Isolation
YouTube Vision channel only. Not AURA2. Not Design Infra.
