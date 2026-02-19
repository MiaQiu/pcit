# AI Model Selection

## Overview

The PCIT analysis pipeline uses multiple AI calls. The `AI_PROVIDER` environment variable controls which model handles the 6 analysis calls in `pcitAnalysisService.cjs`.

## Configuration

```bash
# .env
AI_PROVIDER=gemini-flash   # default — Gemini 2.0 Flash (low cost)
AI_PROVIDER=claude-sonnet   # Claude Sonnet 4.5 (higher quality, higher cost)
```

If `AI_PROVIDER` is not set, it defaults to `gemini-flash`.

## Call Routing

The `callAI()` helper in `pcitAnalysisService.cjs` routes all 6 calls:

| Call | Purpose | maxTokens | temperature |
|------|---------|-----------|-------------|
| Role Identification | Identify parent/child speakers | 2048 | 0.3 |
| DPICS Coding | Tag utterances with PCIT codes | 8192 | 0 |
| Developmental Profiling | Clinical domain observations | 8192 | 0.5 |
| CDI Coaching Format | Format coaching cards for mobile | 2048 | 0 |
| Combined Feedback (4a) | Top moment, feedback, activity | 2048 | 0.7 |
| Review Feedback (4b) | Revise per-utterance feedback | 2048 | 0.5 |
| PDI Two Choices | Discipline skill ratings (PDI only) | 2048 | 0.7 |

## Unchanged Calls

The following call is **not** affected by `AI_PROVIDER`:

- **CDI Coaching Generation** — always uses Gemini 3 Pro via `callGeminiStreaming()` (streaming, thinking model)

## How `callAI()` Works

- **`claude-sonnet`**: Delegates to `callClaudeForFeedback()` in `claudeService.cjs`, which calls the Anthropic API with a system prompt field.
- **`gemini-flash`**: Calls Gemini 2.0 Flash `generateContent` endpoint directly. Since the Gemini simple API has no system prompt field, the system prompt is prepended to the user prompt. Response is parsed via `parseClaudeJsonResponse()`.

## Quality Comparison (session 807db5e6)

Both models produce structurally identical output. Claude Sonnet gives slightly more detailed/specific feedback text; Gemini Flash is more concise. Both agree on key fields like top moment and utterance indices.
