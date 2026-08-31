# Vision — Production House Process Only

No manual media edits. If identity drifts, change this process and rerun the stage. Do not patch frames by hand.

Grok amends process only. Actions execute the current stage. Director must pass before the next stage.

## 1. Job
Every film is one job: brief, state, artifacts, qc.
state = current stage. Nothing runs outside it.

## 2. Stages
1. Intake
2. Development
3. Screenplay
4. Look lock — freeze faces/wardrobe. After Look OK those identities never change.
5. Keyframes — stills only from locked identities. New face = fail.
6. Picture — I2V from that keyframe + prompt. New face mid-clip = fail, go back to keyframes.
7. Sound
8. Assembly
9. Delivery

Skip a stage = broken.

## 3. Identity rule
Look lock writes identity_lock.json (sheet ids + wardrobe).
Keyframes and Picture must use only those ids.
If a later stage needs a new person, stop and return to Look lock. Do not invent a face in picture.

## 4. Director every stage
PASS → advance. FAIL → one retry. FAIL again → stop.
Picture fail because face changed → do not retry video first; retry keyframe.

## 5. Owner gates
Topic OK, Look OK, Master OK.

## 6. Auto
After PASS wait gaps.json then trigger next stage.
Stop on owner gate or double Director fail.

## 7. Prompts
From shot plan. Start with: using reference images. Max 1000 characters.

## 8. Picture spec
16:9 unless brief says otherwise. Still-zoom is not finish.
