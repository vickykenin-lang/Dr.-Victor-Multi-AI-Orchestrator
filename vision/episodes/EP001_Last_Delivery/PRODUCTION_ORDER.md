# EP001 — Last Delivery · PRODUCTION (AUTOMATED)

**Founder role:** **ONLY review results** — no prompt paste.
**Generator:** GitHub Action — Gemini primary, NVIDIA fallback
**QC:** DeepSeek (after stills land)
**OmniRoute / SUPER_HERO:** OFF

---

## How you get 1st face (zero manual gen)

1. Open: https://github.com/vickykenin-lang/Dr.-Victor-Multi-AI-Orchestrator/actions/workflows/vision_stills.yml
2. **Run workflow**
3. Input `only_ids`: `A1` (first face only)
4. Wait 2–5 min
5. Check:
   - Actions → Artifacts → `ep001-stills`
   - Or folder: `vision/episodes/EP001_Last_Delivery/stills/A1.png`
6. Reply: **A1 OK** / **A1 redo**

Then run `A2`, `A3`, or `A1,A2,A3,B1,B2,B3,B4,B5,B6,B7`.

## Provider order (locked 30 Aug 2026)
1. Gemini (`GEMINI_API_KEY`) — primary stills
2. NVIDIA FLUX (`NVIDIA_API_KEY`) — fallback if Gemini job fails
3. If both empty → `BLOCKED_NO_CREDENTIAL` (no fake success)

## If Action fails (quota / billing)
Log will show 429 / billing / missing key. Then:
- Confirm Secrets on **this** hub repo (not AURA2)
- Enable Gemini image access on the key
- Re-run same workflow — still **no** manual paste required

## Order
A1 → A2 → A3 → B1…B7 → DeepSeek QC → Founder OK → video

## Secrets (this repo only)
`GEMINI_API_KEY`  
`NVIDIA_API_KEY` (optional fallback)  
`DEEPSEEK_API_KEY` (QC phase)  
`SUPER_HERO` unused while OmniRoute is off
