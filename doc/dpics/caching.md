# DPICS Coding — Gemini Context Caching

## Why

The DPICS Manual PDF (~266 KB, thousands of tokens) is the authoritative reference for coding parent verbalizations. Previously, the coding rules were summarized in `dpicsCoding.txt` and sent inline with every request — paying the full input token cost on every session analysis.

Gemini's context caching API lets us upload the PDF once and reference it by a cache ID on subsequent calls. The cached tokens are billed at a reduced rate and not re-processed per call.

---

## What is cached

| Layer | Content |
|---|---|
| `systemInstruction` | Role declaration + bilingual context rule + LP sub-classification (LP1–LP4) (from `dpicsCoding.txt`) + PDI override (PDI cache only) |
| `contents` | DPICS Manual PDF + Appendix A (sufficiently positive words JSON) |

Two cache variants are maintained in memory:
- `dpics-cdi` — CDI sessions
- `dpics-pdi` — CDI rules + PDI command override (DC is target skill, IC → coach to DC)

---

## Where the cache is used

The same cache is reused for **two passes** within each session analysis:

### Pass 1 — PCIT coding
Assigns a DPICS code to every adult utterance. The manual is the authority for boundary decisions (LP vs UP, BD vs LP2, Q vs RQ, etc.).

**User message:**
```
Code every utterance where role is "adult". Skip all "child" entries.

[transcript JSON array: {id, role, text}]

Return a minified JSON array for adult utterances only:
[{"id": <int>, "code": <string>}, ...]
- Return ONLY the JSON array — no text, no markdown, no code fences
- First character MUST be [, last character MUST be ]
- Every adult entry MUST have "id" and "code"
```

**Supplemental pass** (when the model stops early and misses some utterances):
```
These adult utterances were missed in the prior pass. Code each one and return ONLY a valid JSON array:

[missed utterances JSON]
```

### Pass 2 — Review feedback
Writes per-utterance coaching feedback for all coded parent utterances. The manual is used to ensure suggested PRIDE alternatives are accurate (correct BD/LP/RF form, no IC/Q/NTA slipping into suggestions). Appendix A is used for LP word choices.

**User message:** Full session transcript with DPICS tags + session metrics + feedback instructions (see `generateReviewFeedbackPrompt` in `pcitAnalysisService.cjs`).

---

## Request structure

With cache active:
```json
{
  "cachedContent": "cachedContents/abc123",
  "contents": [{ "role": "user", "parts": [{ "text": "<user message>" }] }],
  "generationConfig": { "temperature": 0, "maxOutputTokens": 32768 }
}
```

Without cache (fallback):
```json
{
  "contents": [{ "role": "user", "parts": [{ "text": "<dpicsCoding.txt + PDI override + user message>" }] }],
  "generationConfig": { "temperature": 0, "maxOutputTokens": 32768 }
}
```

---

## Lifecycle

```
Server start (cold)
  │
  ├─ First PCIT coding call
  │    ├─ Upload PDF + appendix → Gemini Files API → fileUris   (in-memory 48h)
  │    ├─ POST /cachedContents (fileUris + systemInstruction) → cacheName  (in-memory 24h)
  │    └─ Call Gemini (Pass 1: coding) with cachedContent=cacheName
  │
  ├─ Review feedback call (same session, same process)
  │    └─ Read cacheName from memory → call Gemini (Pass 2: feedback) — no upload, no cache creation
  │
  └─ All subsequent sessions (within 24h)
       └─ Read cacheName from memory → both passes reuse directly
```

Cache entries expire:
- **PDF / appendix files** (Files API): 48 hours — re-uploaded automatically on expiry
- **Context cache**: 24 hours — recreated automatically on expiry (also re-uploads files if needed)

Both registries are in-process memory (`geminiCache.cjs`). A server restart causes one cold round-trip (upload + cache creation) on the next session analysis, then warms again for the rest of the day.

**E2E test script**: Each script invocation is a fresh process, so the registry is always empty and the PDF is re-uploaded every run. This is acceptable for dev testing; production is unaffected (long-running server process).

---

## Fallback

If the Files API upload or cache creation fails for any reason (network error, token minimum not met, quota), the service logs a warning and falls back to sending `dpicsCoding.txt` + prompt inline — identical to pre-caching behaviour. No session is lost.

---

## Files

| File | Role |
|---|---|
| `server/assets/Manual_for_the_Dyadic_Parent-Child_Interaction_Cod.pdf` | The cached DPICS manual — committed to repo |
| `server/assets/appendix A - words_sufficiently_positive.json` | Cached appendix — list of words qualifying as sufficiently positive for LP |
| `server/prompts/dpicsCoding.txt` | System instruction: role + bilingual context + LP sub-classification (no feedback strategy — handled in review prompt) |
| `server/llm/providers/geminiCache.cjs` | Cache manager: file upload, cache creation, in-memory registry with expiry |
| `server/services/pcitAnalysisService.cjs` | Two call sites: PCIT coding pass (Step 8) and review feedback pass (`generateCDIFeedback`) |

---

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `DPICS_PDF_PATH` | `server/assets/Manual_for_the_Dyadic_Parent-Child_Interaction_Cod.pdf` (relative to `__dirname`) | Override PDF path without redeploying |
| `DPICS_APPENDIX_PATH` | `server/assets/appendix A - words_sufficiently_positive.json` (relative to `__dirname`) | Override appendix path without redeploying |
