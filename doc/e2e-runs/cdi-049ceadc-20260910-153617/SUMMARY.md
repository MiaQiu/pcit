# E2E LLM calls — CDI session `049ceadc-1cfe-403d-beec-8f36460b349f`

_Run: 2026-09-10 15:36 · branch `parent-skill-ladder-9-levels` · `node scripts/e2e-llm-calls.cjs 049ceadc-… --dump=…`_

Raw per-stage outputs are the sibling `*.json` files; full console log is `run.log`.
Stage/#-numbers below map to `doc/llmcalls.md`.

## Session context

| | |
|---|---|
| mode | CDI · `analysisStatus=COMPLETED` (so a live re-run would **skip pcit-coding** via checkpoint) |
| duration | 301 s · 63 utterances (41 adult, 12 child, rest silence) |
| child (profile) | **Eh**, 37 months, girl |
| child (transcript) | parent addresses her as **胖虎 / "Panghu"** — the [child-name directive](../../../server/services/pcitAnalysisService.cjs) case |
| language | `zho` → Simplified Chinese output |
| role-id | speaker_0→ADULT (0.99), speaker_1→CHILD (0.99); ML lambda not configured, single Gemini vote |
| tagCounts | from DB — Praise 6, goal is 10 |

## Per-call result (13 calls, 0 errored, 0 fallbacks)

| # | label | model | lat | in / out tok | schema | notes |
|---|-------|-------|-----|--------------|--------|-------|
| 3 | session-quality-check | gemini-3.7-flash | 2.7s | 4141 / 147 | – | `valid:true` |
| 1 | role-id-gemini | gemini-3.7-flash | 2.4s | 4182 / 485 | – | no disagreement → no Claude tiebreak |
| 4 | pcit-coding | **gemini-3.1-pro-preview** | 54.5s | 34404 / 5308 | – | 41 adult utterances coded; created `dpics-cdi-gemini-3.1-pro-preview` cache |
| 6 | dev-profiling | gemini-3.7-flash | 8.8s | 2637 / 2304 | ✓ | 5 domains, 0 baseline achieved |
| 7 | about-child | gemini-3.7-flash | 23.1s | 1564 / 5199 | ✓ | 10 observations |
| 9 | coaching-narrative | **gemini-3.1-pro-preview** | 45.7s | 58427 / 3370 | – | reused `cdi-coaching-gemini-3.1-pro-preview` cache |
| 10 | coaching-format | gemini-3.7-flash | 10.2s | 3679 / 3879 | ✓ | structured Coach's Corner + 1 tricky moment; no escalation |
| 13 | combined-feedback | gemini-3.7-flash | 4.4s | 2236 / 876 | ✓ | |
| 16 | skill-improve | gemini-3.7-flash | 4.3s | 2063 / 338 | ✓ | 3 opportunities, direction BUILD |
| 15 | crisis-coaching (in cdi-feedback) | gemini-3.7-flash | 6.8s | 2867 / 1649 | ✓ | crisis detected |
| 14 | review-feedback | **gemini-3.1-pro-preview** | 47.1s | 33889 / 5582 | – | **now OK** — reuses the pro DPICS cache (see fix below) |
| 17 | report-highlights | gemini-3.7-flash | 3.9s | 1165 / 768 | ✓ | dead code in prod; run for coverage |
| 15 | crisis-coaching (standalone) | gemini-3.7-flash | 8.7s | 2867 / 1925 | ✓ | |

`pdi-two-choices` (#12) skipped — CDI session.

## Fix applied this run — `review-feedback` cache/model mismatch

**Symptom** (recurring, incl. the alert at 2026-09-10T07:17Z):
`Gemini API error 400: Model used by GenerateContent request (gemini-3.1-pro-preview) and CachedContent (gemini-3.7-flash) has to be the same.`

**Root cause:** `pcit-coding`, `pcit-coding-supplemental` and `review-feedback` share one DPICS
context cache. Commit `f12adf4` aligned their **model** (all on `$GEMINI_STREAMING_MODEL`) but the
cache **key** (`dpics-cdi` / `dpics-pdi`) was not model-qualified, unlike the sibling
`cdi-coaching-<model>` key. That is safe only while `pcit-coding` runs and recreates the cache.
When `pcit-coding` is skipped by the `pcitCodingDone` checkpoint (any re-run of a COMPLETED
session), `review-feedback` trusts whatever `dpics-cdi` entry is in the shared on-disk registry
(`server/llm/providers/.gemini-cache-registry.json`) — which can be stale, created at a different
model by an eval script, an older e2e run, or a previous `$GEMINI_STREAMING_MODEL`.

**Fix:**
- `server/services/pcitAnalysisService.cjs` — new `dpicsCacheKey(isCDI)` helper returning
  `dpics-cdi-<streaming-model>` / `dpics-pdi-<streaming-model>`; used by both the coding cache
  config and the review-feedback cache config. Same pattern already used for `cdi-coaching`.
- `scripts/e2e-llm-calls.cjs` — imports `dpicsCacheKey` + `DPICS_PDF_PATH` from the service
  (instead of a local literal) so the inline `pcit-coding` replica can't drift again; also now
  passes the `$GEMINI_STREAMING_MODEL` override on the coding call, matching `analyzePCITCoding`.
- Purged the stale bare `dpics-cdi` / `dpics-pdi` registry entries (local only, git-ignored).

Also added `--dump=<dir>` to the e2e script (writes each stage's returned value + per-call log
as JSON — these files).

## Child-name directive — working

Every model that writes prose now uses the profile name **Eh**, not the transcript nickname 胖虎:
hero text, crisis coaching, skill coaching, Coach's Corner, combined-feedback, review-feedback,
about-child, dev-profiling. `胖虎` survives **only** in strings reconstructed verbatim from the
transcript (`bondingMoment.quote`, `skillImprove[].quote`) — expected. Note this means
parent-quote snippets inside coaching-narrative/coaching-format are lightly paraphrased
(`"妈妈喜欢看Eh专心地…"` where the parent said `胖虎`), per the directive's intent.

## Key generated outputs

**Deterministic goal (no LLM):** `The Praise Hunt` — Praise 6 → target 10 · `BUILD_PRAISE`.

**Hero text (crisis #15):** 温柔陪伴，见证Eh的成长与坚持！

**Crisis Moment (#15, detected):** "搭建受阻时的挫败哭泣" — Eh cried when magnetic tiles wouldn't
align; mother caught the emotion, gave a hug + empathy; next-time tips = describe feelings,
fewer commands, catch small persistence.

**Coach's Corner (#10):**
- did well — theme "关注并表扬耐心与轻柔的动作", 2 examples
- growth focus — "表扬大搜寻", 6/10 labeled praise, upgrade strategy
- word bank — goal 减少破坏与肢体冲突 → 动作轻柔 / 保持耐心与冷静 (2 lines each)
- tricky moment ×1 — 应对游戏中的挫败感, rewrite via narration/echo

**About Child (#7):** 1 needs_help (完美主义的小萌芽), 4 advanced, 5 age_appropriate.

**Dev profiling (#6):** Cognitive = Advanced (causal reasoning "为什么这个不可以"), Language /
Social / Emotional / Connection = Age Appropriate; 7 milestone keys detected, 0 baseline.

**skill-improve (#16):** 3 BUILD opportunities — upgrade behavioral descriptions to labeled praise.
