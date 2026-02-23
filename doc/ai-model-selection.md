# AI Model Selection

> This document describes the original per-service `callAI()` routing. The pipeline has since been refactored.
> **See [llm-gateway.md](./llm-gateway.md) for the current architecture.**

## Current Setup (post-refactor)

All AI calls go through `server/llm/gateway.cjs` via `llmCall()`. Model selection is controlled by:

1. The `model` option on each `llmCall()` call (defaults to `AI_PROVIDER` env var)
2. The model registry in `server/llm/models.cjs`

```bash
# .env
AI_PROVIDER=gemini-flash   # default — Gemini 2.0 Flash
AI_PROVIDER=claude-sonnet  # Claude Sonnet 4.6
```

See [llm-gateway.md](./llm-gateway.md) for the full call table, failure handling, schemas, and logging.
