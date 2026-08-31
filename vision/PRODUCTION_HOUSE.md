# Vision — Production House Process Only

No story. No characters. No episode names.
This file is the studio operating process.

Grok may only amend this process. Workers (GitHub Actions) execute the current stage. Director must pass before the next stage starts.

## 1. Job
Every film is one job.
A job has: brief, state, artifacts, qc.
state = which stage is allowed to run.
Nothing runs outside the current stage.

## 2. Stages (fixed order)
1. Intake — receive topic + length + language + platform
2. Development — logline, treatment, tone. No picture.
3. Screenplay — script + shot plan. No picture.
4. Look lock — character/location still sheets only. No motion.
5. Keyframes — one still per shot, must match look lock.
6. Picture — image-to-video from the approved still + shot prompt
7. Sound — voice + bed from locked lines
8. Assembly — cut, mix, subs, master file
9. Delivery — publish package

Skip a stage = process broken.

## 3. Director gate (every stage)
After a stage writes artifacts, Director reviews those artifacts against the previous lock.
PASS → state advances one stage.
FAIL → same stage, one retry.
FAIL again → job stops. Human owner decides.
Director never invents story. Director only accepts or rejects.

What Director checks, by stage:
- Development: topic followed, length possible, platform fit
- Screenplay: scenes cover the treatment, no missing beats
- Look lock: faces/wardrobe usable and distinct
- Keyframes: same people as look lock, correct scene, no extra text
- Picture: same people as keyframe, motion matches shot prompt, aspect correct
- Sound: right speaker, line matches screenplay
- Assembly: order matches shot plan, sync, no placeholder
- Delivery: file spec + metadata complete

## 4. Owner gates (only three)
- Topic OK — Intake may leave inbox
- Look OK — Look lock accepted, keyframes allowed
- Master OK — Delivery allowed

Owner does not sit on every shot if Director passed.

## 5. Run rule
One job. One stage. One Action run.
No full-film button.
No generating picture to repair a failed look lock.
If picture identity fails, go back to keyframes, not to more video.

## 6. Prompt rule
Shot prompts come from the shot plan, not from chat.
Every picture prompt starts with: using reference images.
Every picture prompt stays under 1000 characters.

## 7. Picture spec
Master aspect is 16:9 unless the brief says otherwise.
Workers may change models. Process does not change.
Slideshow / zoom-on-still is not picture finish.

## 8. Isolation
This house publishes only to the briefed platform.
Other products stay out.
