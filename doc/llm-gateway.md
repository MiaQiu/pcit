# LLM Gateway

All AI calls in the PCIT backend go through a single gateway in `server/llm/`. This document covers the architecture, how to make a call, how to change a model, and how failures are handled.

---

## File Structure

```
server/llm/
├── gateway.cjs          # Single entry point — llmCall()
├── models.cjs           # Model registry (swap models here)
├── repair.cjs           # JSON parsing with jsonrepair fallback
├── logger.cjs           # Structured per-call log line
├── providers/
│   ├── gemini.cjs       # Gemini generateContent fetch
│   └── anthropic.cjs    # Claude messages fetch
└── schemas/
    └── index.cjs        # Gemini responseSchema definitions
```

---

## Making a Call

Import `llmCall` from the gateway and pass a prompt with options:

```javascript
const { llmCall } = require('../llm/gateway.cjs');

// JSON object (default)
const result = await llmCall(prompt, {
  label:       'my-call',        // appears in log output
  model:       'flash',          // 'flash' | 'pro' | 'claude' (default: env-driven)
  output:      'json',           // 'json' | 'array' | 'text'
  maxTokens:   2048,
  temperature: 0.7,
  systemPrompt: null,
  timeout:     60_000,           // ms
  schema:      SCHEMAS.MY_SCHEMA // optional Gemini responseSchema
});

// Array output
const items = await llmCall(prompt, { output: 'array', label: 'pcit-coding' });

// Raw text (no JSON parsing)
const text = await llmCall(prompt, { output: 'text', label: 'coaching-narrative' });
```

---

## Model Registry

Defined in `server/llm/models.cjs`. To swap a model, change it here — nothing else needs updating.

| Key | Provider | Primary Model | Fallback |
|-----|----------|---------------|---------|
| `flash` | Gemini | `gemini-2.0-flash` | `gemini-3-flash-preview` |
| `pro` | Gemini | `gemini-3.1-pro-preview` | — (streaming only) |
| `claude` | Anthropic | `claude-sonnet-4-6` | — |

**Default model** is controlled by the `AI_PROVIDER` environment variable:
```bash
AI_PROVIDER=gemini-flash   # → 'flash' (default)
AI_PROVIDER=claude-sonnet  # → 'claude'
```

---

## Call Sites

### `pcitAnalysisService.cjs` — 7 calls (gateway) + 2 streaming

| Label | Output | Model | Schema | Temperature |
|-------|--------|-------|--------|-------------|
| `role-id` | json | flash | — | 0.3 |
| `pcit-coding` | array | flash | `PCIT_CODING` | 0 |
| `dev-profiling` | json | flash | `DEV_PROFILING` | 0.5 |
| `coaching-format` | json | flash | `COACHING_FORMAT` | 0 |
| `combined-feedback` | json | flash | `COMBINED_FEEDBACK` | 0.7 |
| `review-feedback` | array | flash | `REVIEW_FEEDBACK` | 0.5 |
| `gemini-flash-raw` | text | flash | — | 0.7 (×2, about-child steps) |
| CDI coaching | text | pro (streaming) | — | 0.5 |
| PDI two-choices | json | pro (streaming) | — | 0.7 |

### `milestoneDetectionService.cjs` — 1 call

| Label | Output | Model | Schema |
|-------|--------|-------|--------|
| `milestone-detection` | json | flash | `MILESTONE_DETECTION` |

### Streaming (outside gateway)

CDI and PDI coaching generation both use `callGeminiStreaming()` directly in `pcitAnalysisService.cjs` with `gemini-3.1-pro-preview`. Streaming responses cannot go through the gateway's JSON-parse/retry path.

### `weeklyReportService.cjs` — 1 call (bypasses gateway)

Weekly report calls `callClaudeForFeedback()` from `claudeService.cjs` directly. It is not yet routed through `llmCall()`.

---

## Failure Handling

Each call goes through up to 4 layers:

```
1. Gemini responseSchema  ← prevents malformed JSON at the token level (Gemini only)
2. jsonrepair             ← fixes structural issues in the returned text
3. LLM retry              ← re-sends the same prompt once if JSON parse still fails
4. Model fallback         ← tries fallback model if primary throws (Gemini only)
```

**Layer 1 — responseSchema:** When a `schema` is passed and the provider is Gemini, the gateway sets `responseMimeType: 'application/json'` and `responseSchema` in `generationConfig`. This constrains token-level output so structurally invalid JSON cannot be produced. Has no effect for Claude calls.

**Layer 2 — jsonrepair:** `server/llm/repair.cjs` strips markdown fences, extracts the JSON substring, tries `JSON.parse`, and on failure tries `jsonrepair` (handles truncation, trailing commas, unclosed brackets). Returns `{ value, repaired }`.

**Layer 3 — LLM retry:** If JSON parsing fails even with repair, the gateway re-sends the original prompt once. If that also fails to parse, the error is thrown.

**Layer 4 — model fallback:** For Gemini calls, if the primary model throws (e.g. 429, 503, empty response), the gateway automatically retries with the fallback model defined in the registry.

---

## Structured Logging

Every call emits one JSON log line to stdout via `server/llm/logger.cjs`:

```json
{
  "event": "llm_call",
  "label": "pcit-coding",
  "model": "gemini-2.0-flash",
  "provider": "gemini",
  "latencyMs": 20397,
  "inputTokens": 9927,
  "outputTokens": 3278,
  "hasSchema": true,
  "usedFallback": false,
  "usedRepair": false,
  "usedRetry": false,
  "ok": true,
  "error": null
}
```

| Field | Meaning |
|-------|---------|
| `label` | Caller-supplied name, set in the call options |
| `model` | Actual model used (may be fallback, not primary) |
| `hasSchema` | `true` if Gemini responseSchema was active |
| `usedFallback` | Primary model failed, fallback was used |
| `usedRepair` | `jsonrepair` was needed to fix the response |
| `usedRetry` | JSON parse failed once, prompt was re-sent |
| `ok` | `false` if the call ultimately threw |

In a healthy run all flags are `false`. If `usedRepair: true` appears frequently for a call, investigate the prompt or schema.

---

## Schemas

Defined in `server/llm/schemas/index.cjs` (OpenAPI 3.0 subset). Each schema maps to one call site:

| Export | Call site |
|--------|-----------|
| `PCIT_CODING` | `pcit-coding` |
| `REVIEW_FEEDBACK` | `review-feedback` |
| `COMBINED_FEEDBACK` | `combined-feedback` |
| `PDI_TWO_CHOICES` | `pdi-two-choices` |
| `DEV_PROFILING` | `dev-profiling` |
| `COACHING_FORMAT` | `coaching-format` |
| `MILESTONE_DETECTION` | `milestone-detection` |

Schemas have no effect for Claude calls — they are silently ignored.

---

## Switching Models

**Change the default model for all analysis calls:**
```bash
# .env
AI_PROVIDER=gemini-flash    # gemini-2.0-flash (default)
AI_PROVIDER=claude-sonnet   # claude-sonnet-4-6
```

**Swap the Gemini primary/fallback globally:**
Edit `server/llm/models.cjs`:
```javascript
flash: {
  provider: 'gemini',
  primary:  'gemini-2.0-flash',       // ← change here
  fallback: 'gemini-3-flash-preview', // ← and here
},
```

**Use a different model for a single call:**
```javascript
const result = await llmCall(prompt, { model: 'claude', label: 'my-call' });
```

---

## Provider Notes

**Gemini** — system prompt is prepended to the user message (no separate system field in the API). Structured output via `responseSchema` prevents malformed JSON at the token level.

**Claude** — uses the `system` field in the messages API. Does not support `responseSchema`; JSON reliability relies on jsonrepair + LLM retry.

**Timeouts** — both providers use `AbortController` with a configurable `timeout` option (default 60s). The controller is created per call and cleaned up in a `finally` block.
