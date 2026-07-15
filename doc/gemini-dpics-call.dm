# Gemini DPICS Call/Score Tooling

## Why

Ad hoc scripts to call Gemini directly for DPICS coding (outside the production pipeline and outside the DB-backed `dpics-eval-run.cjs` harness), one API call per session, so different prompt/model/cache/manual combinations can be tried quickly and compared on cost + accuracy. Built incrementally in one session; this doc is the settled state.

Three files, all under `server/scripts/`:
- `gemini-dpics-call.cjs` — makes the calls, tracks cost
- `gemini-dpics-score.cjs` — scores saved call output against ground truth, writes the leaderboard
- `dpics-ground-truth.cjs` — DB-backed ground-truth cache used by the scorer

---

## gemini-dpics-call.cjs

```
node server/scripts/gemini-dpics-call.cjs --model flash|pro [--cache] [--session <label>] [--prompt <name>] [--ttl <duration>] [--keep-cache]
```

| Flag | Meaning |
|---|---|
| `--model` | `flash` → `gemini-3.5-flash` (default), `pro` → `gemini-3.1-pro-preview`. Also accepts a full model id. |
| `--cache` | Upload `DPICS-Manual.2.18.pdf` + the prompt file and wrap them in a Gemini context cache (`cachedContents`), reused across every session in this run. User message becomes session data only. If omitted, no manual at all — the prompt file is sent as `systemInstruction`, user message is session data only. |
| `--session` | Run one session file only, e.g. `--session session-3`. Omit to run all files under `prompts/deepseek/session-only/`. |
| `--prompt` | Prompt file name under `server/prompts/`, without `.txt`. Default: `dpicsCoding-agentic-v10`. |
| `--ttl` | Only with `--cache`. Overrides the cache's TTL at creation (Gemini duration format, e.g. `--ttl 600s`). Default: `900s` (15m). Scoped to this script only — does not change the shared `geminiCache.cjs` default (`7200s`) that production relies on. |
| `--keep-cache` | Only with `--cache`. Skip end-of-run TTL shrink, leave the cache at its full committed TTL (e.g. planning another `--cache` batch against the same prompt soon). |

One call per session. Within a batch (no `--session` filter), all sessions share the **same** cache — it's created once before the loop, reused via `cachedContent` for every session, and shrunk once at the end.

### Nonce-prefix (no-cache path only)

Gemini's implicit prefix caching can silently discount repeated identical system-instruction tokens across sequential calls. Since the no-cache path resends the same prompt file verbatim for every session in a batch, each call gets a fresh `[Cache-Bypass ID: <uuid> | Timestamp: <ms>]` prefix so no two calls can accidentally prefix-match — keeping the no-cache cost baseline honest.

### Output files

Written to `eval-results/dpics/gemini-calls/`, one pair per call:

- `<session>__<model>__<cache|nocache>__<prompt>__<timestamp>.json` — full model output + usage/cost breakdown
- `<session>__<model>__<cache|nocache>__<prompt>__<timestamp>.prompt.txt` — the exact prompt actually sent (system instruction + user message for no-cache; user message only for cache mode, with a note that the manual/prompt were supplied via `cachedContent` and excluded here)

---

## Cost model

Three cost components, all reported per run and none of which come for free from a single `generateContent` call's `usageMetadata`:

### 1. Generation cost (every call)

From `usageMetadata`: `promptTokenCount`, `cachedContentTokenCount`, `candidatesTokenCount`, `thoughtsTokenCount`. Thinking tokens are stripped from the visible text but billed at the **output** rate, so they're added to `billedOutputTokens`.

```
cost = uncachedPromptTokens/1M × input_rate
     + cachedTokens/1M         × cachedInput_rate
     + (outputTokens + thinkingTokens)/1M × output_rate
```

### 2. Cache write cost (once per cache-creation event, `--cache` only)

A one-time fee at cache-creation time, billed at the **standard** (not cached) input rate for the tokens written in. Confirmed empirically: the very first `generateContent` call after a fresh cache already shows its tokens billed at the discounted cached rate — meaning the write itself is a separate, earlier billing event (the `cachedContents.create` call), never reflected in any `generateContent` response.

Detected heuristically: if the cache's `createTime` is <10s old right after `getOrCreateCache` returns, this run just created it fresh (charge applies); an older `createTime` means an existing cache was reused (already paid in a prior run, no new charge).

### 3. Cache storage cost (`--cache` only)

Hourly rate × however long the cache is alive. **Gemini bills the full committed TTL/expireTime (set at creation or last update) — not prorated to when you call `delete()`.** This was the single biggest correction made while building this: calling `delete()` on an untouched cache does *not* stop billing for the remainder of its committed TTL.

The fix: `PATCH` the cache's `ttl` down to Gemini's minimum (60s) right after the last session — this **recalculates** the bill to match actual usage, then the cache auto-expires on its own. This script **never calls `delete()`** on a cache it created; it only shrinks. (Verified live: PATCH with `updateMask=ttl` and body `{ttl: "60s"}` returns 200 and immediately updates `expireTime`.)

Because shrinking (not deleting) leaves the resource in place server-side, the local reuse-registry (`server/llm/providers/.gemini-cache-registry.json`) would otherwise still think it's valid for its original pre-shrink TTL. `forgetCacheRegistryEntry()` drops that entry directly (geminiCache.cjs doesn't expose a registry-only removal, so this script reads/writes the registry file itself) so the next run creates a clean fresh cache instead of referencing an expiring/expired one.

### Verified pricing (as of 2026-07-01, ai.google.dev/gemini-api/docs/pricing)

| | input | cached input | output (incl. thinking) | storage/hr |
|---|---|---|---|---|
| gemini-3.5-flash | $1.50/1M | $0.15/1M | $9.00/1M | $1.00/1M |
| gemini-3.1-pro-preview (≤200k ctx) | $2.00/1M | $0.20/1M | $12.00/1M | $4.50/1M |

Pro is tiered above 200k context tokens (higher rates) — this script always uses the ≤200k tier since actual session sizes never approach that.

**Unverified / not fully documented:**
- Whether the shrink-then-expire storage cost is prorated to the second/minute vs. some coarser rounding — Google's docs give the rate but not the billing granularity.
- The exact interaction between an update-shortened TTL and any minimum billing floor.

### Minimum cache size and TTL

- Minimum tokens to create a cache: **4,096** for both `gemini-3.5-flash` and `gemini-3.1-pro-preview` (below this, caching isn't available at all — most single prompts are too small to qualify; caching only pays off for large static content like the manual).
- No enforced minimum TTL — the API accepted `ttl: "1s"` without error in testing, but sub-few-second TTLs are practically useless since the create call's own round-trip latency exceeds them (the cache can expire before you ever get to use it).

### Why not cache everything and delete immediately?

- Most content doesn't meet the 4,096-token minimum.
- Cache-and-delete is 3-4 sequential API calls (upload → create → generate → shrink) vs. one inline call — real latency/complexity overhead.
- The write fee is only worth paying if amortized across enough reuse; a true one-shot call gets little benefit over inlining.
- This is why production keeps its DPICS cache alive with a static key across many requests (see below) rather than tearing it down after each use.

---

## gemini-dpics-score.cjs

```
node server/scripts/gemini-dpics-score.cjs [--dir <path>]
```

Default `--dir`: `eval-results/dpics/gemini-calls`.

- Parses each call's `text` output (JSON array of `{id, code, subject, reasoning}`) via the existing `llm/repair.cjs` `parseJSON` (same repair-fallback logic as the production gateway).
- Predicted `id` maps directly to the DB `Utterance.order` field — both this script's `id` numbering and the session-only export files number all utterances (adult + child) 0..n in DB order, so no separate lookup table is needed. Verified directly against the DB.
- Scores exact match and lenient "category match" (via `dpics-eval-codes.cjs`'s `sameCategory`, which treats known old/new-manual code-family splits as equivalent — e.g. `Q`/`DQ`/`IQ`/`RQ`).
- Writes a `<basename>.score.json` companion per call (originals untouched).
- **Dedupes by latest run per `(model, prompt, cache, session)`** before aggregating — otherwise re-running the same six sessions would double/triple-count old + new results together. Picked by the timestamp embedded in the filename.
- Regenerates `result.dm` from scratch every run (from every `*.score.json` present) — always a full up-to-date history, not an incremental append. Old batches persist as long as their score files aren't deleted; new prompts/models/cache combos just add a new section.
- Folds in the one-time cache-write cost per batch, deduped by the cache's actual `createTimeMs` (not by dollar value — two distinct cache-creation events can coincidentally cost the same amount if the token count matches, which happened in practice).

### dpics-ground-truth.cjs

`getGroundTruth(label)` — checks `eval-results/dpics/ground-truth/<label>.json` first; only falls back to the DB (via `prisma`, requires the SSH tunnel — `scripts/start-db-tunnel.sh`) on a cache miss, then persists. All 12 sessions (`session-1`..`session-6`, `session2-1`..`session2-6`) are cached locally already, so scoring runs need no DB access at all in the common case. Fully generic over the label — any key present in `eval-results/dpics/sessions.json` works, no code changes needed to add a new batch.

---

## Second batch (`session2`, added 2026-07-09)

Extended coverage to the 6 `session2-*` sessions (see `doc/codingTest.md`) using the same two scripts. Two things had to be built/fixed first, since this tooling had only ever been run against the original `session-1`..`session-6`:

1. **No export script existed** for the `prompts/deepseek/session-only/<label>-user.txt` format (lead-in line + `{id, role, text}` JSON array + the fixed trailing output-schema instructions) — the original 6 were a one-off manual export. Generated the `session2-*-user.txt` equivalents with a throwaway script pulling `getUtterances(sessionId)` per label from `eval-results/dpics/sessions.json`, using the DB `order` field directly as `id` (same invariant `gemini-dpics-score.cjs` already relies on).
2. **Label-derivation bug in `gemini-dpics-call.cjs`**: the per-call `label` was derived via `file.match(/session-\d+/)?.[0] || file`, which assumes every filename contains a literal `session-<digits>` substring. `session2-1-user.txt` doesn't (`session2-1`, no hyphen right after `session`) — silently fell through to the `|| file` branch and recorded the raw filename (`"session2-1-user.txt"`) as the session label, which would have broken `getGroundTruth()` lookups. Fixed by deriving the label by stripping the known `-user.txt`/`-user copy.txt` suffix instead of pattern-matching a specific prefix shape:
   ```js
   const label = file.replace(/\.txt$/, '').replace(/-user( copy)?$/, '');
   ```
   One already-completed call (`session2-1`) had recorded the bad label before the fix was caught — patched its output `.json`/`.prompt.txt` in place (renamed + corrected the `session` field) rather than re-spending on a re-run.

Ran `dpicsCoding-agentic-v10`, `gemini-3.1-pro-preview`, `--cache`, one session per invocation (12 sequential invocations total across both batches share this cache key, so each pays its own one-time cache-write fee — no way to batch multiple explicit `--session` labels into one shared-cache invocation without extending `--session` to accept a comma-separated list, not yet done).

Updated leaderboard (`dpicsCoding-agentic-v10`, `gemini-3.1-pro-preview`, cache), all 12 sessions:

| session | exact | category | cost |
|---|---|---|---|
| session-1 | 44/79 (55.7%) | 79/79 (100%) | $0.15603 |
| session-2 | 67/108 (62.04%) | 99/108 (91.67%) | $0.15693 |
| session-3 | 75/99 (75.76%) | 89/99 (89.9%) | $0.13199 |
| session-4 | 35/46 (76.09%) | 38/46 (82.61%) | $0.12642 |
| session-5 | 48/51 (94.12%) | 49/51 (96.08%) | $0.09618 |
| session-6 | 61/66 (92.42%) | 61/66 (92.42%) | $0.11852 |
| session2-1 | 39/70 (55.71%) | 51/70 (72.86%) | $0.14580 |
| session2-2 | 70/98 (71.43%) | 77/98 (78.57%) | $0.16994 |
| session2-3 | 62/96 (64.58%) | 75/96 (78.13%) | $0.17225 |
| session2-4 | 60/65 (92.31%) | 61/65 (93.85%) | $0.12854 |
| session2-5 | 84/89 (94.38%) | 84/89 (94.38%) | $0.14840 |
| session2-6 | 59/83 (71.08%) | 77/83 (92.77%) | $0.13334 |
| **total** | 704/950 (74.11%) | 840/950 (88.42%) | $1.68433 |
| cache write (one-time, 7x) | | | $0.48132 |
| **grand total (incl. cache write)** | | | $2.16565 |

Category accuracy on the session2 batch alone (425/501 = 84.83%) is close to the original 6-session batch's 92.43%, but with a wider per-session spread: the three father-child pretreatment-assessment sessions (`session2-1/2/3`) sit at 72-79% while the three CDI-coaching sessions (`session2-4/5/6`) sit at 92-94% — a split not seen in the original batch (all six of which were CDI-coaching-style, no pretreatment assessments). Worth treating as a hypothesis (pretreatment-assessment content structurally harder to code, or father-child role is a factor) rather than a settled conclusion — no isolating experiment has been run yet.

---

## result.dm format

One section per `(prompt, model, cache)` batch, sorted by exact accuracy descending:

```
## <prompt>, <model>, <cache|no-cache>

| session | exact | category | cost |
|---|---|---|---|
| session-1 | 41/79 (51.9%) | 76/79 (96.2%) | $0.10161 |
...
| **total** | 320/449 (71.27%) | 401/449 (89.31%) | $0.64209 |
| cache write (one-time, 2x) | | | $0.10314 |
| **grand total (incl. cache write)** | | | $0.68823 |
```

The cache-write row only appears for `--cache` batches, and its count (`Nx`) reflects how many distinct cache-creation events fed into the currently-deduped rows (e.g. if one session in a batch was re-run in its own separate invocation later, that's 2 write events, not 1).

---

## What production actually uses (different from what's been tested here)

Discovered while comparing — worth keeping visible since it's easy to assume the eval setup matches production:

| | this tooling (so far) | production (`pcitAnalysisService.cjs` step 8) |
|---|---|---|
| Prompt | `dpicsCoding-agentic-v10.txt` (25KB, rich subject/reasoning/difficulty CoT schema) | `dpicsCoding.txt` (1.5KB, minimal — just `{id, code}` output) |
| Manual | `DPICS-Manual.2.18.pdf` (49 pages) | `Manual_for_the_Dyadic_Parent-Child_Interaction_Cod.pdf` (243 pages) |
| Cache key | `<prompt>__<model>` per this script's invocation | static `dpics-cdi` / `dpics-pdi`, reused across all sessions and requests until natural 2h TTL expiry — never torn down per-use |
| Model | same profile (`gemini-3.5-flash` → `gemini-3.1-pro-preview` fallback) | same |

Production's long-lived static cache is the correct pattern for a live system serving many sessions (amortizes the write fee over continuous real traffic) — the opposite of this eval tooling's per-batch shrink-and-let-expire, which is right for one-off experimentation but would be wasteful in production.

---

## Known gaps / things not verified

- Storage billing proration granularity (second/minute vs. some rounding) — unconfirmed from Google's docs.
- Whether an update-shortened TTL can hit some undocumented minimum billing floor.
- `PRICING` in `gemini-dpics-call.cjs` should be re-verified if Google revises pricing, or if any run's context grows near the 200k-token tier boundary for pro.
