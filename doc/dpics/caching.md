# DPICS Coding — Gemini Context Caching

## Why

The DPICS Manual PDF (~266 KB, thousands of tokens) is the authoritative reference for coding parent verbalizations. Previously, the coding rules were summarized in `dpicsCoding.txt` and sent inline with every request — paying the full input token cost on every session analysis.

Gemini's context caching API lets us upload the PDF once and reference it by a cache ID on subsequent calls. The cached tokens are billed at a reduced rate and not re-processed per call.

---

## What is cached

| Layer | Content |
|---|---|
| `systemInstruction` | Role declaration + bilingual context rule + LP sub-classification (LP1–LP4) + feedback generation strategy (from `dpicsCoding.txt`) + PDI override (PDI cache only) |
| `contents` | `DPICS-Manual.2.18.pdf` — the full authoritative coding manual |

Two cache variants are maintained in memory:
- `dpics-cdi` — CDI sessions
- `dpics-pdi` — CDI rules + PDI command feedback override (DC is target skill, IC → coach to DC)

---

## What is sent per call

**Main coding pass:**
```
Code every utterance where role is "adult". Skip all "child" entries.

[transcript JSON array: {id, role, text}]

Return a minified JSON array for adult utterances only:
[{"id": <int>, "code": <string>, "feedback": <string>}, ...]
- Return ONLY the JSON array — no text, no markdown, no code fences
- First character MUST be [, last character MUST be ]
- Every adult entry MUST have both "code" and "feedback"
[language line — only for non-English sessions]
```

**Supplemental pass** (when the model stops early and misses some utterances):
```
These adult utterances were missed in the prior pass. Code each one and return ONLY a valid JSON array:

[missed utterances JSON]
```

---

## Request structure

With cache active:
```json
{
  "cachedContent": "cachedContents/abc123",
  "contents": [{ "role": "user", "parts": [{ "text": "<transcript + output rules>" }] }],
  "generationConfig": { "temperature": 0, "maxOutputTokens": 32768 }
}
```

Without cache (fallback):
```json
{
  "contents": [{ "role": "user", "parts": [{ "text": "<dpicsCoding.txt + PDI override + transcript + output rules>" }] }],
  "generationConfig": { "temperature": 0, "maxOutputTokens": 32768 }
}
```

---

## Lifecycle

```
Server start (cold)
  │
  ├─ First PCIT coding call
  │    ├─ Upload PDF → Gemini Files API → fileUri        (in-memory 48h)
  │    ├─ POST /cachedContents (fileUri + systemInstruction) → cacheName  (in-memory 24h)
  │    └─ Call Gemini with cachedContent=cacheName
  │
  └─ All subsequent calls (within 24h)
       └─ Read cacheName from memory → call Gemini directly (no upload, no cache creation)
```

Cache entries expire:
- **PDF file** (Files API): 48 hours — re-uploaded automatically on expiry
- **Context cache**: 24 hours — recreated automatically on expiry (also re-uploads file if needed)

Both registries are in-process memory (`geminiCache.cjs`). A server restart causes one cold round-trip (upload + cache creation) on the next session analysis, then warms again.

---

## Fallback

If the Files API upload or cache creation fails for any reason (network error, token minimum not met, quota), the service logs a warning and falls back to sending the full `dpicsCoding.txt` + prompt inline — identical to pre-caching behaviour. No session is lost.

---

## Files

| File | Role |
|---|---|
| `server/assets/DPICS-Manual.2.18.pdf` | The cached document — committed to repo, baked into the App Runner container image |
| `server/prompts/dpicsCoding.txt` | System instruction: role + bilingual context + feedback strategy (no coding rules — those are in the PDF) |
| `server/llm/providers/geminiCache.cjs` | Cache manager: file upload, cache creation, in-memory registry with expiry |
| `server/services/pcitAnalysisService.cjs` | Call site: resolves cache before each PCIT coding call; constructs per-call user message |

---

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `DPICS_PDF_PATH` | `server/assets/DPICS-Manual.2.18.pdf` (relative to `__dirname`) | Override PDF path without redeploying |
