# VISION — Storage (locked 30 Aug 2026)

**Working storage:** Google Drive  
**Publish:** YouTube only  
**Git:** scripts + stills PNGs when Action can push  
**Artifacts:** backup if git push races

## Bound folder
https://drive.google.com/drive/folders/1aGyG0KCS_4q9aaGIFDO615R-47JUOE5U  
ID: `1aGyG0KCS_4q9aaGIFDO615R-47JUOE5U`

## Auto path (intended)
Action generates PNG → commit repo `stills/` → upload Drive `01_stills/`

## Why A1 did not appear in Drive (30 Aug run #7)
1. PNG **did** generate (NVIDIA FLUX, 78924 bytes).
2. GitHub Artifact `ep001-stills` has `A1.png`.
3. Git push **rejected** (main moved). Fixed: pull --rebase then push.
4. Drive upload **not wired** until hub secret `GOOGLE_SERVICE_ACCOUNT_JSON` exists.

## Drive auto-upload (Founder once)
1. Google Cloud → service account → JSON key
2. Share the bound Drive folder with that SA email (Editor)
3. Victor hub secrets:
   - `GOOGLE_DRIVE_FOLDER_ID` = `1aGyG0KCS_4q9aaGIFDO615R-47JUOE5U`
   - `GOOGLE_SERVICE_ACCOUNT_JSON` = full JSON
4. Next Action run uploads `01_stills/A1.png` automatically

Until then: download Artifact and drop into Drive manually — one-time only.
