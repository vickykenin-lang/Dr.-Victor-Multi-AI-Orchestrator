# VISION — Storage (locked 30 Aug 2026)

**Working storage:** Google Drive  
**Publish:** YouTube only  
**Git:** scripts, prompts, status, logs — **no** 30-min masters, no raw clips

OmniRoute OFF. AURA2 / interiors Drive folders **not** used.

## Bound folder (Founder 30 Aug 2026)

- URL: https://drive.google.com/drive/folders/1aGyG0KCS_4q9aaGIFDO615R-47JUOE5U
- Folder ID: `1aGyG0KCS_4q9aaGIFDO615R-47JUOE5U`
- Visibility: private (login required). Do not make public.
- Treat this folder as `Vision/EP001_Last_Delivery` root.

## Why Drive
Founder-provided. Fits zero-cost start for EP001 (~10 min now, ~30 min later).
GitHub Actions artifacts = temporary preview only (90 days).

## Folder layout (create inside the bound folder)

```text
01_stills/
02_clips/
03_audio/
04_edit/
05_masters/
06_qc/
```

| Folder | What |
|---|---|
| `01_stills` | A1–A3, B1–B7 PNGs |
| `02_clips` | 3–8s motion clips |
| `03_audio` | VO + score stems |
| `04_edit` | timeline / project |
| `05_masters` | 1080p YouTube export (30-min cap later) |
| `06_qc` | DeepSeek notes + founder OK/redo |

## Size guide
- 1080p ~30 min master: 1.5–4 GB
- Working pack one episode: ~8–25 GB
- Free Drive = 15 GB. Agar fill ho: Google One, ya baad mein R2/S3 migrate.

## System contract
1. Action generates stills → upload `01_stills/A1.png` (when Drive credential exists)
2. Founder reviews Drive file → `A1 OK` / `A1 redo`
3. Final master stays in `05_masters/` then YouTube
4. Repo keeps only path references in `status.json`

## Secrets (Victor hub repo only)
Add when upload automation is enabled:

| Secret | Purpose |
|---|---|
| `GOOGLE_DRIVE_FOLDER_ID` | `1aGyG0KCS_4q9aaGIFDO615R-47JUOE5U` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Drive-limited service account |

Do **not** put these in AURA2. Do not commit JSON. Do not paste keys in chat.

Until those two secrets exist, Founder can drop files into the same folders manually. Pipeline still generates via `vision_stills.yml`.
