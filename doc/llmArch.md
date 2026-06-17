# LLM Architecture

All AI calls in the PCIT backend go through a single 5-layer stack. This document is the authoritative reference — `doc/llm-gateway.md` covers the older pre-refactor design.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 5 — Service Layer                                        │
│  pcitAnalysisService, weeklyReportService, dpicsSegmenter, …   │
│  Call: llmCall(prompt, { profile: 'pcit-coding', cache: … })   │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│  Layer 4 — Call Profiles  (server/llm/profiles.cjs)            │
│  Named presets: model, temperature, maxTokens, timeout, output  │
│  Explicit options always override profile defaults              │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│  Layer 3 — Gateway  (server/llm/gateway.cjs)                   │
│  • Merges profile defaults with explicit options                │
│  • Resolves context cache (Gemini only, supportsCache models)   │
│  • Primary → fallback model switching after retries exhausted   │
│  • Up to 3 attempts on retryable errors (1s, 2s backoff)       │
│  • JSON parse with jsonrepair; one LLM retry on parse failure   │
│  • Structured log line on every call                            │
│  • Sends failure alert on terminal error                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│  Layer 2 — Model Registry  (server/llm/models.cjs)             │
│  Named keys → { provider, primary, fallback, streaming,        │
│                  supportsCache }                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│  Layer 1 — Providers                                            │
│  providers/gemini.cjs      geminiCall / geminiStreamCall        │
│  providers/anthropic.cjs   anthropicCall                        │
│  providers/geminiCache.cjs getOrCreateCache                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
server/llm/
├── gateway.cjs           # Single entry point — llmCall()
├── models.cjs            # Model registry
├── profiles.cjs          # Named call presets
├── repair.cjs            # JSON parse with jsonrepair fallback
├── logger.cjs            # Structured per-call log line
├── sanitize.cjs          # Output sanitisation
├── alertEmail.cjs        # Slack/email alert on terminal failure
├── providers/
│   ├── gemini.cjs        # Gemini generateContent / streamGenerateContent
│   ├── anthropic.cjs     # Claude messages API
│   └── geminiCache.cjs   # Gemini context cache (Files API + CachedContent)
└── schemas/
    └── index.cjs         # Gemini responseSchema definitions (OpenAPI 3.0 subset)
```

---

## Layer 1 — Providers

### `gemini.cjs`

Two functions: `geminiCall` (blocking) and `geminiStreamCall` (SSE).

Both accept a `cachedContent` option. When present, it is injected into the request body and the system-prompt text prepend is skipped (the system prompt is already embedded in the cache).

```js
geminiCall(apiKey, model, body, { timeout, cachedContent })
geminiStreamCall(apiKey, model, body, { timeout, cachedContent })
```

> **Why streaming exists:** Reasoning-class models (gemini-2.5-pro and similar) think silently for 30–90 s before producing output. The blocking `:generateContent` endpoint times out during this phase. The SSE endpoint (`:streamGenerateContent?alt=sse`) keeps the connection alive with heartbeat chunks. The gateway routes to streaming automatically when `modelDef.streaming = true`.

### `anthropic.cjs`

Single `anthropicCall(apiKey, model, { prompt, systemPrompt, maxTokens, temperature, timeout })`. Returns `{ text, usage }`.

Claude does not support `cachedContent` or `responseSchema` — both are silently ignored by the gateway for Anthropic calls.

### `geminiCache.cjs`

`getOrCreateCache(key, primaryFile, systemPrompt, model, extraFiles)` — uploads files via the Gemini Files API then creates a `CachedContent` object embedding the system prompt and files. The cache name is stored in memory keyed by `key`. On subsequent calls the cached content is reused until it expires (default TTL: 60 min).

Returns a `cachedContent` resource name string, or throws on failure (gateway catches and falls back to inline prompt).

---

## Layer 2 — Model Registry

Defined in `server/llm/models.cjs`. Change models here — nothing in the service layer needs to change.

| Key | Provider | Primary | Fallback | Streaming | supportsCache |
|-----|----------|---------|---------|-----------|---------------|
| `fast` | Gemini | `gemini-2.5-flash` | `gemini-2.0-flash` | — | — |
| `flash` | Gemini | `gemini-2.5-flash` | `gemini-2.0-flash` | — | — |
| `gemini-3.5-flash` | Gemini | `gemini-3.5-flash` | `gemini-2.5-flash` | — | — |
| `reasoning` | Gemini | `$GEMINI_REASONING_MODEL` | `claude-sonnet-4-6` | ✅ | ✅ |
| `haiku` | Anthropic | `$CLAUDE_HAIKU_MODEL` | — | — | — |
| `claude` | Anthropic | `claude-sonnet-4-6` | — | — | — |

**`reasoning` model** is the only model with both `streaming: true` and `supportsCache: true`. All DPICS coding, coaching narrative, and review-feedback calls use this key.

**Env vars:**

```bash
GEMINI_REASONING_MODEL=gemini-2.5-pro         # primary for 'reasoning' key
GEMINI_STREAMING_MODEL=gemini-2.5-pro         # legacy alias (still accepted)
CLAUDE_HAIKU_MODEL=claude-haiku-4-5-20251001  # primary for 'haiku' key
```

`resolveModel()` also accepts full model IDs directly (e.g. `'claude-opus-4-8'`, `'gemini-2.5-flash'`) — provider is inferred from the prefix.

---

## Layer 3 — Gateway

### Signature

```js
const { llmCall } = require('../llm/gateway.cjs');

const result = await llmCall(prompt, {
  // ── Profile (optional) ────────────────────────────────────────────
  profile:      'pcit-coding',        // loads preset from profiles.cjs

  // ── Context cache (optional, Gemini reasoning model only) ─────────
  cache: {
    key:         'dpics-cdi',         // cache identity key (in-memory)
    primaryFile: DPICS_PDF_PATH,      // path to primary file to cache
    systemPrompt: dpicsSystemPrompt,  // embedded in cache + text fallback
    extraFiles:  [{ path, mimeType }] // additional files (optional)
  },

  // ── Explicit options (override profile defaults) ───────────────────
  model:        'reasoning',          // model key or full model ID
  output:       'array',              // 'json' | 'array' | 'text'
  maxTokens:    32768,
  temperature:  0,
  timeout:      300_000,              // ms
  systemPrompt: null,
  label:        'pcit-coding',        // appears in log output
  schema:       SCHEMAS.PCIT_CODING,  // Gemini responseSchema (optional)
  _geminiConfig: {},                  // merged into generationConfig (escape hatch)
  sessionId:    sessionId,            // included in failure alerts
});
```

### Call Flow

```
llmCall(prompt, options)
  │
  ├─ extract { profile, cache, ...rest }
  ├─ merge profileDefaults + rest  (explicit wins)
  ├─ resolveModel(modelKey) → modelDef
  │
  ├─ if cache && modelDef.supportsCache:
  │    getOrCreateCache(…) → cachedContent
  │    (on failure: warn + continue without cache)
  │
  ├─ _callWithFallback(modelDef, …, cachedContent)
  │    ├─ _callWithRetry(primary, …, cachedContent)   ← up to 3 attempts
  │    │    └─ _call(modelDef, …)
  │    │         ├─ Gemini streaming  (modelDef.streaming)
  │    │         ├─ Gemini blocking
  │    │         └─ Claude
  │    │
  │    └─ on retryable failure: _callWithRetry(fallback, …, cachedContent=null)
  │         (cachedContent is always null for the fallback — cache is Gemini-specific)
  │
  ├─ output === 'text': return sanitizeOutput(text)
  │
  └─ JSON path:
       parseJSON(text, type)  ← jsonrepair fallback
         on failure: retry entire _callWithFallback once
           parseJSON again → throw if still fails
```

### Retry & Fallback

**Retryable errors:** `AbortError`, `ETIMEDOUT`, `ECONNRESET`, `err.retryable === true` (set by providers on 429/5xx).

**Non-retryable errors** (4xx auth, bad config) bypass both retry and fallback and throw immediately.

**Fallback rules:**
- Gemini primary → Gemini fallback model (stays in-provider to keep `responseSchema` behaviour)
- Anthropic primary → throws (no cross-provider fallback for Claude)
- `reasoning` primary (Gemini) → `claude-sonnet-4-6` fallback (cross-provider, with `cachedContent = null`)

---

## Layer 4 — Call Profiles

Defined in `server/llm/profiles.cjs`. Each profile is a named preset for one task. Call sites pass `{ profile: '<name>' }` and rely on the preset for model, temperature, maxTokens, timeout, and output type.

Explicit options in the call always override the profile.

| Profile | Model | Temp | maxTokens | Timeout | Output |
|---------|-------|------|-----------|---------|--------|
| `pcit-coding` | `reasoning` | 0 | 32768 | 5 min | array |
| `pcit-coding-supplemental` | `reasoning` | 0 | 8192 | 2 min | array |
| `review-feedback` | `reasoning` | 0.5 | 8192 | 2 min | array |
| `combined-feedback` | `haiku` | 0.4 | 2048 | 2 min | json |
| `coaching-narrative` | `reasoning` | 0.5 | 16384 | 5 min | text |
| `coaching-format` | `fast` | 0 | 4096 | 2 min | json |
| `coaching-notifications` | `reasoning` | 0.5 | 2048 | 90 s | json |
| `dev-profiling` | `haiku` | 0.5 | 8192 | 2 min | json |
| `about-child-narrative` | `haiku` | 0.7 | 4096 | 2 min | text |
| `about-child-extract` | `haiku` | 0.3 | 2048 | 60 s | array |
| `pdi-two-choices` | `reasoning` | 0.4 | 6144 | 2 min | json |
| `role-identification` | `fast` | 0.3 | 2048 | 60 s | json |
| `role-id-tiebreaker` | `claude` | 0.3 | 2048 | 60 s | json |
| `quality-check` | `haiku` | 0 | 512 | 30 s | json |
| `weekly-report` | `haiku` | 0.7 | 2000 | 60 s | text |
| `text-input-eval` | `haiku` | 0.3 | 512 | 30 s | json |
| `abc-insight` | `fast` | 0.3 | 2000 | 60 s | json |
| `segmenter` | `gemini-3.5-flash` | 0 | 8192 | 2 min | array |

---

## Layer 5 — Service Layer

### `pcitAnalysisService.cjs` — PCIT core pipeline

The main orchestrator. `analyzePCITCoding(sessionId, userId)` runs the full pipeline in order:

```
1. Role identification vote
   ├─ Gemini (profile: role-identification) ─┐
   └─ ML acoustic model                      ├─ majority vote → roleMap
       on disagreement:                       │
   └─ Claude tiebreaker (role-id-tiebreaker) ┘

2. Session quality gate  (profile: quality-check)
   └─ throws SessionQualityError if invalid → no alert sent

3. PCIT coding  (profile: pcit-coding, cache: dpics-cdi/pdi)
   └─ supplemental pass if utterances were missed  (pcit-coding-supplemental)

4. Child profiling — parallel:
   ├─ Developmental profiling  (profile: dev-profiling)
   ├─ CDI Coaching:
   │   ├─ Notifications / tomorrow goal  (coaching-notifications)
   │   ├─ Coaching narrative             (coaching-narrative)
   │   └─ Format for mobile             (coaching-format, withQualityRetry)
   └─ About Child:
       ├─ Psychologist narrative  (about-child-narrative)
       └─ Extract observations    (about-child-extract)

5. Feedback — sequential:
   ├─ Combined feedback card   (combined-feedback)
   └─ Per-utterance coaching   (review-feedback, cache: dpics-cdi/pdi)
       └─ results written to Utterance.revisedFeedback + additionalTip

6. PDI only: Two Choices Flow analysis  (pdi-two-choices)

7. Milestone detection  (external service, non-blocking)
```

**Checkpoints:** `roleIdDone` and `pcitCodingDone` are stored on the Session row. If the pipeline is re-run (e.g. via `run-llm-only.cjs`), completed checkpoints are skipped unless explicitly cleared.

**`withQualityRetry`** — used for `coaching-format`. Runs the call up to twice; if the result fails the completeness check (`checkComplete`), escalates to the same call with `model: 'reasoning'` override. Returns `null` if all attempts fail (caller falls back to raw coaching text).

### Other Services

| Service / Route | Profile | Notes |
|-----------------|---------|-------|
| `weeklyReportService.cjs` | `weekly-report` | One call per report |
| `textInputEvaluationService.cjs` | `text-input-eval` | Evaluates parent exercise answers |
| `routes/abc-logs.cjs` (insights) | `abc-insight` | Uses `_geminiConfig.thinkingConfig` override |
| `utils/dpicsSegmenter.cjs` | `segmenter` | Re-segments ElevenLabs utterances pre-analysis |
| `services/claudeService.cjs` | (no profile) | Thin wrapper — passes `model: 'claude'` to llmCall |
| `routes/coach.cjs` | — | Live chat agent loop — calls Gemini directly, not via llmCall |

---

## Context Caching

The DPICS manual (~500-page PDF) and appendix JSON are expensive to include inline on every PCIT coding and review-feedback call. The gateway caches them as a `CachedContent` object in the Gemini API.

**Cache keys in use:**

| Key | Calls | Contents |
|-----|-------|---------|
| `dpics-cdi` | `pcit-coding`, `review-feedback` (CDI) | DPICS PDF + appendix A JSON + CDI system prompt |
| `dpics-pdi` | `pcit-coding`, `review-feedback` (PDI) | DPICS PDF + appendix A JSON + PDI system prompt |

**What happens when the cache is available:**
- `cachedContent` resource name is injected into the Gemini request body
- System prompt text prepend is skipped — it is already embedded in the cache

**What happens when the cache fails** (file upload error, API quota, TTL expired):
- Gateway warns and continues
- `effectiveSystemPrompt` is prepended to the prompt as plain text
- No error is raised — the call degrades gracefully

**File paths** (overridable via env vars):

```bash
DPICS_PDF_PATH      # default: server/assets/Manual_for_the_Dyadic_Parent-Child_Interaction_Cod.pdf
DPICS_APPENDIX_PATH # default: server/assets/appendix A - words_sufficiently_positive.json
```

---

## Structured Logging

Every `llmCall` emits one JSON line to stdout:

```json
{
  "event": "llm_call",
  "label": "pcit-coding",
  "model": "gemini-2.5-pro",
  "provider": "gemini",
  "latencyMs": 80144,
  "inputTokens": null,
  "outputTokens": null,
  "hasSchema": false,
  "usedFallback": false,
  "usedRepair": false,
  "usedRetry": false,
  "ok": true,
  "error": null
}
```

| Field | Meaning |
|-------|---------|
| `label` | Profile name or caller-supplied label |
| `model` | Actual model used (may differ from primary if fallback triggered) |
| `hasSchema` | Gemini responseSchema was active |
| `usedFallback` | Primary model failed; fallback was used |
| `usedRepair` | jsonrepair was needed to fix the response |
| `usedRetry` | JSON parse failed once; prompt was re-sent |
| `ok` | `false` if the call ultimately threw |

> Streaming calls (`reasoning` model) return `inputTokens: null` — the Gemini SSE endpoint does not report token counts in the stream.

In a healthy run all boolean flags are `false`. Frequent `usedRepair: true` on a specific label indicates the prompt or schema needs attention.

---

## Schemas

Defined in `server/llm/schemas/index.cjs` (OpenAPI 3.0 subset). Passed via `schema` option; only active for Gemini calls — silently ignored for Claude.

| Export | Profile |
|--------|---------|
| `DEV_PROFILING` | `dev-profiling` |
| `COACHING_FORMAT` | `coaching-format` |
| `COMBINED_FEEDBACK` | `combined-feedback` |
| `PDI_TWO_CHOICES` | `pdi-two-choices` |

Schemas constrain token-level output so structurally invalid JSON cannot be produced. Use them on calls where the JSON shape is fixed and parse failures are costly.

---

## Failure Handling Summary

```
Network / timeout / 5xx
  → retry up to 3 attempts (1s, 2s backoff)
  → if all fail: switch to fallback model
  → if fallback also fails: throw

JSON parse failure
  → jsonrepair attempt
  → if still fails: one full LLM retry (including repair)
  → if still fails: throw

Context cache failure
  → warn + continue with inline system prompt (graceful degradation)

SessionQualityError (bad recording)
  → thrown before any expensive calls
  → caller shows user-facing message, no Slack alert

Terminal error (anything else)
  → sendLLMFailureAlert (Slack/email)
  → throw — caller marks session FAILED
```

---

## How to Make a New LLM Call

1. **Add a profile** in `server/llm/profiles.cjs`:
   ```js
   'my-task': {
     model:       'fast',
     temperature: 0.3,
     maxTokens:   1024,
     timeout:     60_000,
     output:      'json',
   },
   ```

2. **Call from service code:**
   ```js
   const result = await llmCall(prompt, {
     profile:  'my-task',
     label:    'my-task',
     sessionId,
   });
   ```

3. **Optionally add a schema** in `server/llm/schemas/index.cjs` and pass it via `schema: SCHEMAS.MY_TASK` if the output shape is fixed and the call uses a Gemini model.

4. **Use the DPICS cache** if the call needs the DPICS manual:
   ```js
   const result = await llmCall(prompt, {
     profile: 'my-task',
     cache: {
       key:         isCDI ? 'dpics-cdi' : 'dpics-pdi',
       primaryFile: DPICS_PDF_PATH,
       systemPrompt: dpicsSystemPrompt,
       extraFiles:  [{ path: DPICS_APPENDIX_PATH, mimeType: 'application/json' }],
     },
     label:    'my-task',
     sessionId,
   });
   ```

---

## How to Change a Model

**Change the reasoning model** (PCIT coding, coaching, review-feedback):
```bash
GEMINI_REASONING_MODEL=gemini-2.5-pro   # in .env / App Runner
```

**Change Haiku** (quality-check, dev-profiling, combined-feedback, weekly-report, etc.):
```bash
CLAUDE_HAIKU_MODEL=claude-haiku-4-5-20251001
```

**Swap a specific profile to a different model** without touching other profiles — edit `profiles.cjs`:
```js
'dev-profiling': { model: 'fast', … }   // switch from haiku to Gemini Flash
```

**One-off override at the call site** (explicit options always win over profile):
```js
await llmCall(prompt, { profile: 'coaching-format', model: 'reasoning', label: '…' })
```
This is how `withQualityRetry` escalates the `coaching-format` call to the reasoning model on failure.

---

## Adding a New Provider

1. Create `server/llm/providers/<name>.cjs` — must return `{ text, usage }` and throw with `err.retryable = true` on 429/5xx.
2. Add a named key in `server/llm/models.cjs` with `provider: '<name>'`.
3. Add a routing branch in `_call()` in `gateway.cjs`.
