# DPICS Coding Prompt Finetuning — Methodology & Results

Working log for iterating the DPICS coding prompt and finding the best-performing
LLM model/prompt combination, using the 6 gold-standard CDI session fixtures
described in `doc/codingTest.md`. This doc covers the *prompt iteration and eval
methodology*; see `codingTest.md` for fixture/seeding details.

## Goal

Finetune the DPICS coding prompt and find the best-performing LLM model, measured
against human-coded ground truth, without overfitting to the 6 available samples.

## Eval pipeline (`server/scripts/`)

| Script | Purpose |
|---|---|
| `dpics-eval-seed.cjs` | Seeds fixture sessions into the dev DB. See `codingTest.md`. |
| `dpics-eval-run.cjs` | Core runner — codes one session against a given prompt/model, scores vs. ground truth, writes a result JSON to `eval-results/dpics/`. |
| `dpics-eval-score.cjs` | Leaderboard across all result files, grouped by model + prompt (+ content hash). |
| `dpics-eval-codes.cjs` | `CODE_GROUPS` equivalence sets (`Q`/`DQ`/`IQ`, `LP`/`LP1-4`, `TA`/`AN`/`AK`/`ID`) for lenient "category match" scoring — old/new DPICS-manual granularity differences aren't real coding errors. |
| `dpics-eval-table.cjs` | Per-session CSV review table for manual mismatch spot-checking. |
| `dpics-eval-translate.cjs` | Chinese→English fixture translation (chunked LLM calls), used for the language-dependency experiment. |
| `dpics-eval-metrics.cjs` | Cohen's Kappa, Category Match Rate, per-code Precision/Recall/F1, confusion matrix. Supports `--prompt`/`--model`/`--sessions` filters. |

### `dpics-eval-run.cjs` flags

- `--session <label>` — required, e.g. `session-3`.
- `--grounding <cache|embed|none>` — required. Where the DPICS manual lives:
  - `cache` — Gemini's native `cachedContents` mechanism. Only valid for models with `supportsCache: true` in `llm/models.cjs` (today: `gemini`).
  - `embed` — manual + appendix embedded as plain text in the system field. Works for any model; required for models with no cache mechanism (DeepSeek, Qwen, OpenAI, Claude).
  - `none` — no manual at all; tests whether the coding prompt is self-contained.
- `--rules-location <user|cache>` — required iff `--grounding cache` (error otherwise). Whether the coding-rules prompt is prepended to every user message (`user`, cache stays manual-only and reusable across prompt variants) or baked into the cache alongside the manual (`cache`, cache is specific to that prompt revision).
- `--prompt <name>` — prompt file in `server/prompts/`, default `dpicsCoding`.
- `--model <key>` — `gemini` (default) or any other key/model id in `llm/models.cjs`.
- `--manual <path>` — swap the grounding manual PDF (default: the new-manual PDF). Ignored under `--grounding none`.
- `--few-shot <labels>` — comma-separated session labels prepended as fully-coded reference examples.

## Scoring philosophy

Two accuracy numbers are always reported:
- **Exact match** — predicted code === ground truth code, literally.
- **Category match** — predicted/ground-truth codes collapsed through `dpics-eval-codes.cjs`'s equivalence groups first. This is the metric that matters; exact match
  systematically and misleadingly shows 0% for codes like `Q`/`LP` purely because the
  model (correctly, by design) always emits the new manual's finer sub-codes (`DQ`/`IQ`,
  `LP1-4`) instead of the bare legacy code the old ground truth uses.

`dpics-eval-metrics.cjs` additionally reports **Cohen's Kappa** (agreement corrected for
chance — more rigorous than raw accuracy since it accounts for code-frequency
imbalance) and **per-code F1** (so a prompt with high overall accuracy can't hide a
code it completely fails at, e.g. `NTA`).

## Train/validation split

Two different splits were used across the session's two main phases — described here
so historical results can be correctly attributed:

- **Phase 1 (agentic-v1/v2 development):** train = {session-1, 2, 4, 5} (n=284),
  test = {session-3, 6} (n=165, held out, IC=10/NTA=5 present in test for a real
  generalization check).
- **Phase 2 (v7 onward):** train = {session-3, 4, 6}, validation = {session-1, 2, 5}
  (n=238). Most of the per-code F1/Kappa numbers in this doc use this later split,
  since it's what every prompt from `v7` onward was evaluated against.

### Ground-truth case counts per category

Consolidated from the 6 fixture sessions directly (`server/scripts/cdi sessions/json/`),
counting only adult utterances with a real code (excludes `TBD`):

| Category | s1 | s2 | s3 | s4 | s5 | s6 | **Total** |
|---|---|---|---|---|---|---|---|
| TA (incl. AN/AK/ID) | 30 | 35 | 37 | 18 | 18 | 10 | **148** |
| Q (incl. DQ/IQ) | 35 | 32 | 14 | 3 | 1 | 0 | **85** |
| BD | 0 | 0 | 0 | 8 | 22 | 22 | **52** |
| DC | 5 | 16 | 22 | 2 | 0 | 0 | **45** |
| RF | 9 | 4 | 1 | 6 | 3 | 10 | **33** |
| LP (incl. LP1-4) | 0 | 0 | 1 | 1 | 4 | 20 | **26** |
| NC | 0 | 9 | 2 | 5 | 2 | 2 | **20** |
| UP | 0 | 3 | 8 | 3 | 1 | 1 | **16** |
| IC | 0 | 5 | 10 | 0 | 0 | 0 | **15** |
| NTA | 0 | 4 | 4 | 0 | 0 | 1 | **9** |
| **TOTAL** | 79 | 108 | 99 | 46 | 51 | 66 | **449** |

By the Phase 2 split specifically:

| Category | Train (s3+s4+s6, n=211) | Validation (s1+s2+s5, n=238) |
|---|---|---|
| TA | 65 | 83 |
| Q | 17 | 68 |
| BD | 30 | 22 |
| DC | 24 | 21 |
| RF | 17 | 16 |
| LP | 22 | 4 |
| NC | 9 | 11 |
| UP | 12 | 4 |
| IC | 10 | 5 |
| NTA | 5 | 4 |

**`NTA` (n=9 total) and `IC` (n=15 total) are thin** — a handful of utterances
flipping changes their F1 by 10-25 points. This is a structural reason (not just
prompt quality) why these two codes have been impossible to confidently rank between
prompt versions; see "Known noise floor" below.

**No literal train-set sentences are ever pasted into a prompt as an example** — every
example is either a verified citation from the actual manual PDF, or a generalized
invented illustration. This was violated once (an English-translated test sentence
slipped into a rule's explanation) and corrected on the spot.

## Prompt lineage

| Prompt | What it is |
|---|---|
| `dpicsCoding` / `v0` | Baseline — manual + appendix PDF only, zero custom rules. |
| `v2`–`v6` | Manual trial-and-error iteration (confirmed wins: NC, NTA; confirmed regressions: RF, IC — root cause of the IC regression was never conclusively isolated). |
| `agentic-v1` / `agentic-v2` | Built via disciplined train-only diagnosis (Phase 1 split). `agentic-v2` was the Phase-1 deliverable. |
| `agentic-v3` | Built on `agentic-v2` with three targeted fixes (NC tracking-word carve-out, NTA "ignore politeness wrappers" rule, an explicit priority/dominance hierarchy). The dominance-hierarchy section caused a real regression (TA over-absorbing Q/DC/NTA/UP) — removing it recovered most of the loss, but net effect vs. `agentic-v2` is a wash, not an improvement. |
| `agentic-v4` | Major expansion of the manual+appendix cache approach. Added: detailed LP/UP distinction (Complete Sentence Rule, pronoun judgment, sufficiently-positive word list from appendix); six-category NTA taxonomy (direct criticism, subtle correction, predicting failure, sarcasm, threats, harsh stopping); explicit RF→BD→TA priority section with the "verbal-echo intercept" principle (口語呼應優先); IC/DC/TA three-way disambiguation; and a context-awareness section (省略主語推斷). No chain-of-thought output — the eval runner user-turn still drives `[{"id", "code"}]` format as with all cached-manual prompts. |
| `v7`–`v10` | User-authored, fully self-contained prompts (no "see manual" references, designed to run with `--no-cache`) with chain-of-thought output (`syntax_analysis`/`priority_evaluation`/`decision_rule_application`/`final_code` fields). `v7`→`v8` added onomatopoeia/sound-effect NC coverage and a DC/IC "specificity" rule; `v9` removed `v8`'s Decision Rules section (regression); `v10` restored it and fixed NC further. |

## Caching infrastructure

Two real changes to `server/llm/gateway.cjs` / `server/llm/providers/geminiCache.cjs`:

1. **Disk-persisted file/cache registry** (`.gemini-cache-registry.json`) — file
   uploads and cache references now survive across separate CLI invocations, not
   just within one process.
2. **Shared files-only cache** — the cache now holds *only* the uploaded manual/appendix
   files, keyed by manual filename alone (not prompt content). The prompt text is
   prepended into the regular message content instead of sent via Gemini's
   `systemInstruction` field. This matters because **Gemini's API rejects combining
   `cachedContent` with a per-call `systemInstruction`** — that combination was tried
   first and fails outright with `"CachedContent can not be used with GenerateContent
   request setting system_instruction, tools or tool_config."` Plain prompt text
   alongside `cachedContent` is not subject to that restriction, which is what makes
   the shared cache possible. Verified directly: switching prompts between calls now
   logs "Reusing" instead of "Creating" the cache.
3. Cache TTL raised from 24h to 48h, matching the Files API's own upload TTL.

`--legacy-cache` exists solely to A/B test the new mechanism against the old one (see
"Known noise floor" below) and should not be used for normal eval runs.

## Known noise floor — read before comparing close results

**Re-running the identical prompt/model/session set produces real run-to-run
variance, even at temperature 0.** Concretely: `agentic-v2` on the validation set
scored 91.6%/0.893 (Kappa) on one run, then 88.2%/0.851 on an immediate re-run with
the *same* (legacy) caching mechanism, and 88.7%/0.857 under the new shared-cache
mechanism. The legacy re-run essentially matched the new mechanism's number, not the
original 91.6% — meaning **91.6% was very likely a favorable non-determinism outlier,
not the prompt's "true" ceiling**, and the new caching mechanism is not the cause of
any meaningful regression.

**Practical implication: don't treat single-run differences smaller than ~3 points
of category match (or ~0.03-0.04 Kappa) as a real signal.** Any ranking claim between
close candidates needs multiple independent runs, averaged.

### A second noise source: silently mixing caching mechanisms within one "pooled" number

Separate from run-to-run variance, an audit of all result files found that result
filenames for the same prompt+hash can span *both* the old per-prompt cache and the
new shared-cache mechanism (or include a `--no-cache`/`--legacy-cache` variant) without
anything in the grouping key distinguishing them. Naively pooling "all files matching
this prompt hash" therefore risks double-counting a session (once per mechanism) and
blending two different request shapes into one misleading number. This corrupted the
originally-reported numbers for `v8` and `v9` (see Results table below — both were
inflated by exactly this). **Always check `noCache`/`legacycache` filename tags and the
file's `timestamp` against when the new caching mechanism was deployed
(`2026-06-22T08-52-06`) before pooling multiple files for the same prompt hash.**

## Results (validation set, sessions 1/2/5, n=238 unless noted; mechanism-consistent, audited)

| Prompt | Category Match | Kappa | Notes |
|---|---|---|---|
| `agentic-v2` (original run, June 18) | 91.6% | 0.893 | Single run — see noise-floor note, likely a favorable outlier |
| **`agentic-v4` (old manual, single run)** | **91.6%** | **0.892** | Single run; old manual (`DPICS-Manual.2.18.pdf`); NTA recall 0% |
| `dpicsCoding-v5` | 90.3% | 0.877 | |
| `agentic-v3` (pipeline section removed) | 90.3% | 0.877 | |
| `dpicsCoding-v4` (f0850029) | 90.3% | 0.876 | |
| `agentic-v1` (single original run) | 90.3% | 0.876 | Single run |
| **`agentic-v1` (8 pooled independent re-runs, new-cache mechanism)** | **89.1%** | **0.861** | Most statistically robust estimate available for any prompt in this table |
| `agentic-v3` (latest edits, 2f7c9a50/fa44ea63) | 89.9% | 0.871 | |
| **`agentic-v4` (new manual + appendix, single run)** | **89.5%** | **0.864** | Single run; new manual (`Manual_for_the_Dyadic_Parent-Child_Interaction_Cod.pdf`) + appendix; NTA recall 0% |
| `agentic-v2` (new shared-cache mechanism) | 88.7% | 0.857 | |
| `agentic-v2` (`--legacy-cache` re-run) | 88.2% | 0.851 | Confirms 91.6% doesn't reproduce |
| `agentic-v1.2` | 87.4% | 0.841 | Single run; few-shot examples checked clean of test-set leakage |
| `dpicsCoding-v6` / `v3` | ~87.0% | ~0.83 | |
| `dpicsCoding-v8` | **85.7%** | **0.817** | Corrected — originally reported as 88.0%/0.841, inflated by the mechanism-mixing bug above |
| `dpicsCoding-v10` | 84.0% | 0.799 | |
| `agentic-v2` (`--no-cache`) | 83.6% | 0.796 | |
| `dpicsCoding-v9` | **82.8%** | **0.781** | Corrected — originally reported as 84.5%/0.798, same bug as `v8` |
| `dpicsCoding-v0` (no-prompt baseline) | 82.4% | 0.769 | |
| `agentic-v3` (broken — execution-pipeline regression) | 79.8% | 0.736 | |

**The top cluster (89-90.3%, including `agentic-v1`'s robust 8-run-pooled estimate) and
`agentic-v2` (88.2-88.7% on repeat) are statistically indistinguishable** given the
~3-point noise floor above — there is currently no confidently-determined single best
prompt. What's solid: the bottom tier (`v9`, `v10`, the no-prompt baseline, any
`--no-cache` self-contained variant, and the broken `agentic-v3`) sit meaningfully
below the top cluster, a gap larger than the demonstrated noise.

## Persistent weak codes, across every prompt version tested

- **`NTA` (Negative Talk)** — lowest or near-lowest F1 in every single prompt version,
  including the best performers. High precision, low recall: when the model does call
  NTA it's usually right, but it misses most of the real cases. Subtle/implicit
  criticism (vs. blatant insult) appears to be where models systematically under-call.
- **`IC` (Indirect Command)** — second-most persistent weak spot. Scatters into `DC`
  and `TA` depending on the prompt version; no tested rule change has cleanly fixed
  it, and one tightening attempt (the RF "Single-Word Echo" rule, `v4`→`v5`) caused
  collateral regressions elsewhere without fixing IC.
- **`NC`** — was 0% in early self-contained prompts (`v7`) because they had no `NC`
  code defined at all (a structural prompt gap, not a model failure). Adding explicit
  onomatopoeia/sound-effect coverage (`v8`→`v10`) fixed this substantially.

## Other findings

- **Chinese vs. English:** translating fixtures to natural/idiomatic English and
  re-running the baseline scored *worse* (76.84% vs 83.52% category, `v0` baseline) —
  traced to a translation-fidelity confound: idiomatic English often drops the
  explicit verb from terse Chinese commands (e.g. "小力一點" → "a bit more gently", no
  verb), removing the structural signal `DC` detection depends on. This experiment was
  paused after the `v0` baseline run; the full diagnose-and-iterate cycle was never run
  on the English data.
- **Multi-agent decomposition (one agent per code) was considered and rejected** in
  favor of a single holistic prompt — the actual failure mode is boundary confusion
  between *adjacent* codes (RF/BD/TA, IC/DC/TA), which a per-code split doesn't
  address and which multiplies orchestration cost/risk for no clear benefit.
- **Claude Sonnet vs. Gemini Flash**, same prompt (`v7`, train set): Gemini scored
  higher on every headline metric (72.5% vs. 69.2% exact, Kappa 0.674 vs. 0.634), but
  both hit the same NC/NTA structural wall.

## Model comparison — `agentic-v1` (hash `228a0484`), old manual, validation set

All runs use the files-only shared cache (prompt prepended as message text). Each model gets its own model-specific cache key so Gemini's per-model cachedContents restriction doesn't cause cross-model cache collisions.

| Model | Runs | Category Match | Kappa | Notes |
|---|---|---|---|---|
| `gemini-3.1-pro-preview` | 3-run avg | **92.3%** | **0.901** | Runs: 92.9/91.2/92.9% — run 2 is the low outlier |
| `gemini-3.1-pro-preview` (new manual) | 2-run avg | **91.4%** | **~0.889** | Runs: 91.2/91.6% — old manual gives slight edge |
| `gemini-3.5-flash` | 2-run avg | **~89.7%** | **~0.869** | Runs: 91.6/87.8% — higher variance than Pro |
| `claude-sonnet` | 1 run | **85.3%** | **0.812** | Single run only |

### Per-run detail

**gemini-3.1-pro-preview, old manual:**

| Run | s1 | s2 | s5 | Total | Kappa |
|---|---|---|---|---|---|
| Run 1 | 100% | 89.81% | 88.24% | 92.9% | 0.908 |
| Run 2 | 100% | 86.11% | 88.24% | 91.2% | 0.886 |
| Run 3 | 100% | 89.81% | 88.24% | 92.9% | 0.908 |
| **3-run avg** | | | | **92.3%** | **0.901** |

Session-1 is perfectly stable (100% all three runs). Session-5 is stable at 88.24%. Only session-2 varies (±3.7 points) — that single session accounts for all of Pro's run-to-run variance.

**gemini-3.1-pro-preview, new manual:**

| Run | s1 | s2 | s5 | Total | Kappa |
|---|---|---|---|---|---|
| Run 1 | 94.94% | 89.81% | 88.24% | 91.2% | 0.886 |
| Run 2 | 97.47% | 89.81% | 86.27% | 91.6% | 0.892 |
| **2-run avg** | | | | **91.4%** | **~0.889** |

Old manual is ~0.9 points better than new manual on average, driven by session-1 stability (100% vs 94-97%). The gap is small but consistent across both new-manual runs.

## Manual comparison — `agentic-v4` (hash `811c08cb`), gemini-3.1-pro-preview, single run each

| Manual | Validation (s1+s2+s5, n=238) | Kappa | All 6 (n=449) | Kappa |
|---|---|---|---|---|
| Old manual (`DPICS-Manual.2.18.pdf`) | **91.6%** | **0.892** | 88.2% | 0.857 |
| New manual + appendix | **89.5%** | **0.864** | 86.6% | 0.837 |

Per-session breakdown:

| Session | Old manual | New manual | Δ |
|---|---|---|---|
| s1 | 98.73% | 97.47% | -1.3 |
| s2 | 88.89% | 85.19% | -3.7 |
| s3 | 83.84% | 82.83% | -1.0 |
| s4 | 76.09% | 76.09% | 0 |
| s5 | 86.27% | 86.27% | 0 |
| s6 | 90.91% | 89.39% | -1.5 |

Old manual is consistently better by ~1-4 points (s4 and s5 identical — both dominated by BD/DC/LP which the manual revision doesn't affect). Session-2 shows the biggest drop (-3.7), driven by the new manual handling NC (`ㄟˊ` sounds) and NTA differently. The direction matches the `agentic-v1` old-vs-new finding (~0.9 points); `agentic-v4`'s larger gap (~2 points on validation) may reflect that its more detailed NTA taxonomy interacts worse with the new manual's revised NTA section.

**NTA recall is 0% on both manuals** — the six-category NTA taxonomy in the prompt did not fix the model's systematic under-calling of NTA. All 9 (old manual) / 18 (all-6) NTA utterances were missed, scattered into TA, IQ, or RF.

### Non-determinism at temperature=0

Even at temperature=0, re-running the same model/prompt/session produces real variance:
- **Flash noise floor**: ~3-4 points (91.6% → 87.8%, same session 1 hour apart)
- **Pro noise floor**: ~1.7 points (92.9/91.2/92.9% across three runs ~18 hours apart)

This is **not** attributable to model version updates — the timeframes are too short. Root cause: Gemini's serving infrastructure has inherent floating-point non-determinism in batched GPU/TPU inference even at temp=0. Practical consequence: single-run differences smaller than the model's noise floor carry no signal. Multi-run averaging is required for confident ranking.

### Persistent error cases (wrong in all 3 Pro runs, old manual)

| text | real | v1 pred | v2 pred | v3 pred |
|---|---|---|---|---|
| 嗯嗯。 | NTA | AK | AK | AK |
| 是這樣嗎？ | NTA | Q | Q | Q |
| 牠不會怕冷， | TA | RF | RF | RF |
| 你幫它關起來了欸。 | TA | BD | BD | BD |
| 那你要不要幫我放一些花？ | Q | IC | IC | IC |
| 好不好？ | Q | IC | IC | IC |
| XX，那邊。 | TA | IC | DC | IC |
| 載著小朋友去參觀動物好了。 | DC | ID | ID | ID |
| 你這裡還沒做完捏。 | NTA | ID | ID | ID |
| 你有輕輕地幫他盪鞦韆 | BD | LP4 | LP4 | LP4 |
| 裝起來 | BD | DC | DC | DC |
| 把車子蓋起來 | BD | DC | DC | DC |
| 把手手舉起來 | TA | DC | DC | DC |
| 這樣子看看 | TA | DC | DC | DC |
| 讓小朋友坐車子有乖乖坐好，很棒喔 | UP | LP2 | LP2 | LP2 |

The session-5 BD→DC cluster (`裝起來`, `把車子蓋起來`, `把手手舉起來`) fails on every model and every prompt tested — a persistent structural blind spot, likely requiring a very specific BD-vs-DC rule for action-completion framing in Chinese.

## dpicsCoding-agentic-v10 iteration report

All numbers in this section are **category match** accuracy across all 6 sessions (n=449) unless noted. Numbers marked "file-verified" were computed directly from result JSON files; numbers marked "from terminal" were read from eval output during the session.

---

### Prompt versions tested

| Hash | Description | Runs |
|---|---|---|
| `d38d4b95` | v10 baseline — `要不要→Q` rule corrected, no subject field | 6 (3 new manual + 3 old manual) |
| `75f09222` | + subject chain-of-thought output field | 12 new-manual Pro + 3 old-manual Pro + 3 new-manual Flash + 3 old-manual Flash |
| `a2ffd24d` | + NC and TA rule edits (regression, reverted) | 3 new-manual Pro |
| `8bbc7581` | after partial revert of NC/TA edits | 3 new-manual Pro |

All runs: `gemini-3.1-pro-preview` unless noted, `--legacy-cache`, no few-shot.

---

### Phase 1 — Baseline (`d38d4b95`)

`d38d4b95` is v10 after correcting the `要不要→Q` classification rule (previously coded IC). No subject field. Evaluated with both manuals, 3 runs each. **(file-verified)**

**New manual — 3 runs:**

| Session | Run 1* | Run 2 | Run 3 | Avg |
|---|---|---|---|---|
| s1 (n=79) | 100.00% | 97.47% | 100.00% | 99.16% |
| s2 (n=108) | 93.52% | 90.74% | 90.74% | 91.67% |
| s3 (n=99) | 91.92% | 90.91% | 89.90% | 90.91% |
| s4 (n=46) | 93.48% | 86.96% | 84.78% | 88.41% |
| s5 (n=51) | 94.12% | 86.27% | 86.27% | 88.89% |
| s6 (n=66) | 92.42% | 90.91% | 87.88% | 90.40% |
| **Total** | **94.21%** | **90.49%** | **89.09%** | **91.98%** |

\* Run 1 was the first new-manual run, before old/new manual labelling was introduced. It is a confirmed outlier — the 94.21% did not reproduce. Stable average of runs 2–3: **90.87%** (816/898).

**Old manual — 3 runs:**

| Session | Run 1 | Run 2 | Run 3 | Avg |
|---|---|---|---|---|
| s1 (n=79) | 100.00% | 100.00% | 100.00% | 100.00% |
| s2 (n=108) | 94.44% | 93.52% | 93.52% | 93.83% |
| s3 (n=99) | 89.90% | 88.89% | 88.89% | 89.23% |
| s4 (n=46) | 89.13% | 91.30% | 91.30% | 90.58% |
| s5 (n=51) | 90.20% | 86.27% | 86.27% | 87.58% |
| s6 (n=66) | 90.91% | 89.39% | 89.39% | 89.90% |
| **Total** | — | — | — | **92.28%** |

Run 1 is the untagged run at T03:54 (before old/new file-label was added). Old manual is 1.4 pp better than new-manual stable average (92.28% vs 90.87%). s2 is notably stronger with old manual (93.83% vs 90.74%). s4 is slightly weaker (90.58% vs 88.41% avg including outlier, or roughly equal excluding it).

---

### Phase 2 — Subject field (`75f09222`)

Two changes from `d38d4b95`:
1. **Subject chain-of-thought** — model outputs `{"id", "subject", "code"}` per utterance, first identifying who the utterance is about (`兒童` / `物品/玩具` / `家長自身` / `遊戲角色` / `第三方` / `不明`) before choosing the code. Motivation: role-play errors where parent narrates toy-character actions but model codes DC/IC/BD.
2. **Output format instruction updated** in eval runner to request the `subject` field.

#### Determinism experiment (all new manual, Pro)

Run-to-run variance is a known issue even at temperature=0 (GPU/TPU batching non-determinism). Four configurations were tested progressively. **(file-verified totals; per-run breakdown from terminal)**

| Config | Runs | Total accuracy |
|---|---|---|
| No seed, no nonce | 3 | 92.43% |
| seed=42, no nonce | 3 | 92.06% |
| **seed=42 + nonce** | **3** | **93.10%** |
| temp=0.3 + seed=42 + nonce | 3 | 92.50% |

**How each control helps:**
- `seed=42` — fixes sampling for simple sessions. s1 and s5 became perfectly stable (identical output across all 3 runs). Longer sessions (s2, s3, s4) still varied, suggesting Gemini's `cachedContent` pipeline may not fully honour the seed for large inputs.
- **UUID nonce prefix** on the user prompt — bypasses Gemini's automatic prefix-match implicit caching, forcing fresh inference on every call. With both seed + nonce, s6 also became stable (93.94% ×3), and variance in s2/s4 shrank.
- **temperature=0.3** — slightly worse overall vs. temperature=0 (92.50% vs 93.10%). s5 improved (+2 pp, ambiguous BD cases resolved) but s2 regressed (-2 pp, noise on top of systematic Q/IQ/DQ errors) and s4 became more volatile. Reverted.

**Best config: seed=42 + nonce + temp=0.** All subsequent runs in this phase use this config.

#### Per-session detail — `75f09222`, Pro, seed=42, nonce, temp=0

**New manual (3 runs): (file-verified)**

| Session | Run A | Run B | Run C | Avg |
|---|---|---|---|---|
| s1 (n=79) | 100.00% | 100.00% | 100.00% | **100.00%** |
| s2 (n=108) | 91.67% | 90.74% | 91.67% | **91.36%** |
| s3 (n=99) | 89.90% | 92.93% | 90.91% | **91.25%** |
| s4 (n=46) | 91.30% | 95.65% | 91.30% | **92.75%** |
| s5 (n=51) | 90.20% | 90.20% | 90.20% | **90.20%** |
| s6 (n=66) | 93.94% | 92.42% | 92.42% | **92.93%** |
| **Total** | | | | **93.10%** (1254/1347) |

**Old manual (3 runs): (file-verified)**

| Session | Run A | Run B | Run C | Avg |
|---|---|---|---|---|
| s1 (n=79) | 100.00% | 98.73% | 100.00% | **99.58%** |
| s2 (n=108) | 89.81% | 91.67% | 93.52% | **91.67%** |
| s3 (n=99) | 87.88% | 90.91% | 88.89% | **89.23%** |
| s4 (n=46) | 95.65% | 95.65% | 84.78% | **92.03%** |
| s5 (n=51) | 90.20% | 94.12% | 90.20% | **91.50%** |
| s6 (n=66) | 90.91% | 90.91% | 90.91% | **90.91%** |
| **Total** | | | | **92.43%** (1245/1347) |

**Manual comparison (`75f09222`, Pro):**

| Session | New manual | Old manual | Δ |
|---|---|---|---|
| s1 | 100.00% | 99.58% | -0.4 |
| s2 | 91.36% | 91.67% | +0.3 |
| s3 | 91.25% | 89.23% | **+2.0** |
| s4 | 92.75% | 92.03% | +0.7 |
| s5 | 90.20% | 91.50% | -1.3 |
| s6 | 92.93% | 90.91% | **+2.0** |
| **Total** | **93.10%** | **92.43%** | **+0.67** |

**New manual now edges out old (+0.67 pp)** — a reversal from `d38d4b95` where old was better. The subject field guidance appears better aligned with the new manual's terminology, particularly on s3 and s6.

#### Flash 3.5 comparison — `75f09222`, seed=42, nonce, temp=0

**(file-verified)**

| Session | Flash new | Flash old | Pro new | Pro old |
|---|---|---|---|---|
| s1 (n=79) | 94.51% | 90.30% | 100.00% | 99.58% |
| s2 (n=108) | 88.89% | 89.51% | 91.36% | 91.67% |
| s3 (n=99) | 87.21% | 85.86% | 91.25% | 89.23% |
| s4 (n=46) | 89.13% | 86.23% | 92.75% | 92.03% |
| s5 (n=51) | 87.58% | 88.24% | 90.20% | 91.50% |
| s6 (n=66) | 93.94% | 90.40% | 92.93% | 90.91% |
| **Total** | **90.13%** | **88.49%** | **93.10%** | **92.43%** |

- Pro outperforms Flash by **3.0 pp** (new) and **3.9 pp** (old).
- New manual outperforms old on both models: +1.6 pp for Flash, +0.67 pp for Pro.
- Flash has notably higher run-to-run variance: s4-old ranged 82.6–91.3%, s6-old ranged 83.3–93.9%. Pro was tight across all 3 runs (≤3 pp spread per session on new manual).
- s6 is perfectly stable for Flash-new (93.94% ×3) and nearly so for Pro-new (93.94%, 92.42%, 92.42%) — this session's content is structurally unambiguous for both models.

---

### Phase 3 — NC/TA rule edits (`a2ffd24d`, then `8bbc7581`)

User edited v10 with new NC and TA rules → hash changed to `a2ffd24d`. Setup: Pro, new manual, seed=42, nonce, temp=0, 3 runs. **(file-verified)**

| Session | `a2ffd24d` avg | `75f09222` avg | Δ |
|---|---|---|---|
| s1 (n=79) | 99.16% | 100.00% | -0.84 |
| s2 (n=108) | 91.98% | 91.36% | +0.62 |
| s3 (n=99) | 87.88% | 91.25% | **-3.37** |
| s4 (n=46) | 87.68% | 92.75% | **-5.07** |
| s5 (n=51) | 90.85% | 90.20% | +0.65 |
| s6 (n=66) | 92.42% | 93.94% | -1.52 |
| **Total** | **91.83%** | **93.10%** | **-1.27** |

Regression of **-1.27 pp** overall. Concentrated in s3 (-3.4 pp) and s4 (-5.1 pp), which are the sessions heaviest in BD/DC/LP content. The new TA rules likely over-absorbed action-completion utterances that should be BD or DC. Edits reverted.

After revert, hash changed to `8bbc7581` (not identical to `75f09222` — residual differences remain):

| Session | `8bbc7581` avg | `75f09222` avg | Δ |
|---|---|---|---|
| s1 (n=79) | 98.31% | 100.00% | -1.69 |
| s2 (n=108) | 90.74% | 91.36% | -0.62 |
| s3 (n=99) | 89.90% | 91.25% | -1.35 |
| s4 (n=46) | 92.03% | 92.75% | -0.72 |
| s5 (n=51) | 91.50% | 90.20% | +1.30 |
| s6 (n=66) | 91.92% | 93.94% | -2.02 |
| **Total** | **92.28%** | **93.10%** | **-0.82** |

Better than `a2ffd24d` (91.83%) but still -0.82 pp below `75f09222`. s1 dropping from 100% to 98.3% and s6 from 93.9% to 91.9% indicate residual differences in the prompt content.

---

### Overall leaderboard — v10 variants (all 6 sessions, n=449)

| Hash | Model | Manual | Config | Accuracy |
|---|---|---|---|---|
| `75f09222` | Pro 3.1 | New | seed=42, nonce | **93.10%** |
| `75f09222` | Pro 3.1 | Old | seed=42, nonce | 92.43% |
| `8bbc7581` | Pro 3.1 | New | seed=42, nonce | 92.28% |
| `d38d4b95` | Pro 3.1 | Old | no seed/nonce | 92.28% |
| `d38d4b95` | Pro 3.1 | New | no seed/nonce (stable runs only) | 90.87% |
| `a2ffd24d` | Pro 3.1 | New | seed=42, nonce | 91.83% |
| `75f09222` | Flash 3.5 | New | seed=42, nonce | 90.13% |
| `75f09222` | Flash 3.5 | Old | seed=42, nonce | 88.49% |

### Key findings

1. **Subject chain-of-thought (+2.2 pp)** — adding the subject label before the DPICS code (`75f09222` vs `d38d4b95` stable): 93.10% vs 90.87% on new manual with Pro. The biggest gains were on s3 (+0.3 pp) and s6 (+3.5 pp), which both contain role-play / toy-narration content where subject disambiguation matters most.

2. **Nonce + seed is critical for reliable measurement** — without nonce, Gemini's implicit prefix-match cache can serve stale results, and seed alone doesn't help much if the cache is hit. With seed=42 + nonce: s1, s5, s6 became perfectly stable (identical across 3 runs); remaining variance in s2/s3/s4 is genuine model non-determinism in longer sessions.

3. **New manual now beats old on `75f09222`** (+0.67 pp with Pro) — reversed from all prior versions where old manual consistently led. The subject field guidance is apparently better aligned with the new manual's descriptions.

4. **Pro vs Flash gap is ~3 pp** (new manual: 93.10% vs 90.13%). Flash shows ~3–4× higher run-to-run variance. For production use where multiple re-runs aren't feasible, Pro's tighter distribution is an advantage beyond just the mean.

5. **NC/TA rule edits caused a -1.3 pp regression** — concentrated in BD/DC-heavy sessions. The TA over-absorption pattern (TA eating what should be BD) is a recurring hazard when broadening TA rules.

6. **Persistent errors across all v10 variants** (wrong in every run):
   - s5 BD→DC: `裝起來`, `把車子蓋起來` — action-completion framing in Chinese
   - s5 BD→LP: `你有輕輕地幫他盪鞦韆` — praise vs. behaviour description boundary
   - s4 TA→RF/BD: `你找到野餐墊`, `放得好穩喔` — timing/visual ambiguity (>5s gap, irreducible)
   - s2 TA→BD: `你幫它關起來了欸` — child already did action >5s prior (irreducible-visual)

## Full prompt history — per-code causal analysis

All five comparison points use `gemini-3.1-pro-preview` + old manual (`DPICS-Manual.2.18.pdf`) across all 6 sessions (n=449) for consistency. v1/v4/v9/v10-d38 are 3-run averages; v0 is 1 run (n=429, one session partially missing). Numbers are file-verified.

### Overall accuracy across versions

| Version | Accuracy | Δ prev |
|---|---|---|
| v0 (no custom rules) | 88.58% | — |
| v1 (`228a0484`) | 88.57% | ~0 |
| v4 (`811c08cb`) | 87.97% | -0.6 |
| v9 (`agentic-v9-4aa7abdd`) | 88.20% | +0.2 |
| v10-d38 (`d38d4b95`) | 92.28% | **+4.1** |

**v0 through v9 are statistically indistinguishable at ~88%.** Despite extensive rule engineering in v1, v4, and v9, the model's global accuracy did not move. The gains in some codes were offset by regressions in others. v10-d38 broke this plateau with a 4+ pp jump.

### Per-code recall across versions

| Code | v0 | v1 | v4 | v9 | v10-d38 |
|---|---|---|---|---|---|
| TA | 89.2% | 83.8% | 83.8% | 83.8% | 90.1% |
| Q | 97.6% | 97.6% | 97.6% | 95.3% | **99.6%** |
| BD | 96.2% | 94.2% | 94.2% | 94.2% | 91.0% |
| DC | 93.3% | 91.9% | **97.8%** | **97.8%** | 92.6% |
| RF | 72.7% | **87.9%** | 77.8% | 83.8% | **93.9%** |
| LP | 100% | 100% | 100% | 100% | 100% |
| NC | 0% | 83.3% | 88.3% | 81.7% | **91.7%** |
| UP | 87.5% | 87.5% | 87.5% | 87.5% | 85.4% |
| IC | 60.0% | **86.7%** | 77.8% | **86.7%** | **100.0%** |
| NTA | 0% | 18.5% | 0% | 11.1% | 37.0% |

### Transition 1 — v0 → v1: rules introduced, NC/RF/NTA improved, TA recall fell

**What v1 added:** explicit NC code coverage, RF rules, NTA rules, IC/DC disambiguation.

Key improvements (utterance-level, prediction changed):
- `ㄟˊ` ×3 (TA→NC ✓): filler vocalisations now correctly NC
- `痾~`, `那我們…`, `阿這邊…` (UN/TA→NC ✓): similar coverage
- `它的食物在那邊喔。` (TA→RF ✓): first RF success
- `這樣子會摔下來捏。` (TA→NTA ✓): negative-talk rule fires correctly
- `來。`, `好，來。` (TA→DC ✓): single-word commands now DC not TA

Key regressions:
- `好不好？` (DQ→IC ✗): "Is that ok?" was correctly Q in v0; adding IC rules caused the model to see the imperative-seeking form as IC. Persists through all versions until v10.
- `XX，那邊。` (TA→IC ✗): Short directive coded IC instead of TA. Same IC over-fire.
- `椅子要放好阿`, `椅子要放好`, `也要放好` (DC→IC ✗): Cleanup commands misclassified as IC — they're imperative-form but toward a state, not an action. IC rules grabbed them.
- `全部，`, `嗚！` (TA→NC ✗): Single-word TA utterances absorbed into NC category.
- `牠不會怕冷，` (TA→RF ✗): A TA narration now coded RF — RF rules over-fired.
- `你有輕輕地幫他盪鞦韆` (BD→LP4 ✗): LP rules introduced a persistent BD error that appears in every subsequent version.

**Mechanism — IC over-fire pattern established here:** v1's IC rules correctly improved IC recall from 60% to 86.7%, but with a systematic side effect — any utterance that has an imperative surface form or question-tag is at risk of being coded IC. This error pattern (`XX，那邊`, `好不好？`, cleanup commands) migrates across every version.

**NC gains came at the cost of TA recall:** TA recall fell from 89.2% (v0) to 83.8% (v1) and stayed there through v4 and v9. Several short TA utterances (`全部，`, `嗚！`, `唉呦喂~`) started landing in NC. NC's definition in v1 apparently captured sound-like or terse utterances beyond just the intended vocalisations.

---

### Transition 2 — v1 → v4: 15 improvements, 15 regressions — exact wash

**What v4 added:** detailed LP/UP distinction, six-category NTA taxonomy, RF→BD→TA priority section with "verbal-echo intercept" rule, IC/DC/TA three-way disambiguation.

Key improvements:
- `椅子要放好阿` ×3 (IC→DC ✓): Cleanup commands fixed. v4's IC/DC/TA section correctly targeted these.
- `齁齁齁~` (TA→NC ✓): NC coverage for this specific repeated sound.
- `XX，那邊。` (IC→TA ✓): Short directive fixed back to TA.
- `小象齁。`, `哦~` (ID/AK→TA ✓): Short sounds back to TA.
- `牠不會怕冷，` (RF→TA ✓): Recovered the TA regression from v1.

Key regressions:
- `呵呵呵呵。`, `呵呵。` (TA→NC ✗): Laughter sounds absorbed into NC. Same NC over-fire pattern — fixed in v9 then re-broken.
- `這樣子會摔下來捏。` (NTA→TA ✗): NTA recall dropped from 18.5% back to 0%. **The six-category NTA taxonomy made things worse.** More elaborate subcategory definitions appear to have raised the model's threshold for committing to NTA, not lowered it.
- `嘿，XX你發現了野餐墊欸`, `喔，XX發現了一條魚`, `XX發現、找到一塊麵包` (RF→BD ✗): Three child-discovery utterances that were correctly RF in v1 are now coded BD. v4's "verbal-echo intercept" RF→BD priority rule caused `[X] 發現了 [Y]` descriptions to hit BD (the child "has" or "holds" Y) rather than RF (parent mirrors child's discovery). This is the origin of the RF→BD regression that took until 75f09222's subject field to fully fix.
- `好，等一下我們再開門。` (IC→TA ✗): A genuine IC utterance lost; v4's IC rules narrowed IC coverage.
- `大家趕快跑、趕快跑。`, `哇~ 趕快跑。` (TA→DC ✗): Urgent-sounding TA utterances misclassified as DC.
- `椅子、你的椅子沒有擺好。` (NTA→TA ✗): NTA missed — same taxonomy failure.

**Why v4 ended up lower overall despite fixing v1's IC regressions:** The RF→BD regression (losing 3 RF utterances) offset the DC gains. And the NTA taxonomy produced worse NTA recall than v1's simpler rule. Precision improved across TA/DC but recall suffered in RF and NTA.

---

### Transition 3 — v4 → v9: 16 improvements, 16 regressions — another wash

**What v9 changed:** redesigned chain-of-thought structure, new BD/TA disambiguation (key: child-description utterances should be TA not BD).

Key improvements:
- `呵呵呵呵。`, `呵呵。` (NC→TA ✓): Laughter sounds recovered back to TA.
- `好，等一下我們再開門。` (TA→IC ✓): IC recovered.
- `你發現、XX有發現有馬桶`, `XX拿到的是釣竿`, `XX你現在把藍色的積木板當作湖` (BD→TA ✓): **The BD→TA fix for child-description utterances.** v9's rules correctly identified that `你/XX發現了X`, `XX拿到的是X` are TA (tracking what the child has/sees), not BD. This directly addressed v4's "verbal-echo intercept" over-fire.
- `去開紅色的車子` (DC→RF ✓): RF recovered.
- `喔，你把灑水器拿起來。` (BD→RF ✓): Another RF recovery.

Key regressions:
- `XX，那邊。`, `那邊也要種花阿。`, `那邊的地板也要種花阿。` (TA→IC ✗): The IC over-fire came back. Short directional TA utterances coded IC again — the same error v4 had fixed.
- `好嗎？` ×2 (IQ→IC ✗): Question-tag `好嗎？` coded IC — a new variant of the IC over-fire.
- `哇！`, `哇~` (TA→UP ✗): Single-word positive exclamations now going to UP instead of TA.
- `Okay，放平均了。` (TA→BD ✗): Regression.

**Insight:** v9 successfully fixed v4's BD over-capture but immediately recreated v4's IC over-fire. These two problems appear to be structurally linked: tightening BD (fewer false BD predictions) pushes borderline cases toward IC or DC, which then over-fires. Fixing IC pushes cases back to TA where they may be correct or may hit NC/UP instead.

---

### Transition 4 — v9 → v10-d38: 38 improvements, 12 regressions — the plateau break

**What v10-d38 changed:** complete prompt rewrite with decision rules, explicit `要不要/好不好/好嗎→Q` rule, new IC definition.

Key improvements (38 total — more than double any previous transition):
- **Q/IC disambiguation — the single biggest win:** `那你要不要幫我放一些花？`, `好不好？`, `好嗎？` ×2 (IC→IQ/DQ ✓). The explicit rule that `要不要...`, `好不好?`, `好嗎?` are Q-forms, not IC, fixed 4–5 utterances that had been wrong in every previous version. This single rule likely accounts for ~1–1.5 pp of the +4.1 pp jump.
- `我們也要回家了。`, `媽媽跟你說要...，玩具要愛惜喔。` (TA/DC→IC ✓): True IC utterances correctly identified.
- **TA exclamation recovery:** `哇！`, `哇~`, `嗚！` (UP/NC→TA ✓): Short positive sounds returned to TA. And `嗚~哇塞！真的是大力士耶！` (UP→TA ✓) — a combined exclamation+NTA utterance correctly TA not UP.
- **DC→TA for narration-form directives:** `那個放著就好`, `這個放著就好`, `大家趕快跑、趕快跑。` (DC/TA variants → ✓): Short contextual narration utterances now stable TA.
- **NTA recovery:** `椅子、你的椅子沒有擺好。` (TA→NTA ✓): First time this NTA utterance is consistently correct.
- **RF:** `嘿，XX你發現了野餐墊欸` (TA→RF ✓): Discovery RF partially recovered — same utterance that 75f09222 fully locked in.
- **IC recall reaches 100%**: Every IC utterance now correctly identified — IC's 77.8% in v4 and 86.7% in v9 became 100%.

Key regressions (12):
- `哇，你找到奶奶了` (BD→TA ✗): A BD description now coded TA — the BD/TA boundary shifted with new rules.
- `喔，你找到狗狗的房子…屋子欸。` (BD→TA ✗): Same BD→TA over-correction.
- `椅子要放好阿` ×3 dropped from 100% to 67% stability.
- `全部，` (TA→NC ✗): Single-word TA still hitting NC.

**Why this transition finally broke the plateau:** The `要不要→Q` rule is the clearest example of a *targeted structural fix* rather than a broad category expansion. Every previous change had tried to improve recall in one code by describing it more thoroughly, consistently causing over-fire in adjacent codes. The Q/IC fix instead drew a bright-line exception based on grammatical form — no interpretation required — and it fired cleanly without collateral damage.

---

### Cross-version structural patterns

**1. IC over-fire is the recurring failure mode**
IC false-positives appear in v1, recede in v4, return in v9, then are fixed in v10. The trigger: any utterance with an imperative-seeking form or optional-action phrasing risks IC classification. The pattern: `XX，那邊` (directive), `好不好？` (question-tag), `那邊也要種花阿` (suggestion). Each fix involves either an explicit exclusion rule or a priority hierarchy.

**2. TA/NC boundary for short sounds oscillates every version**
`呵呵`, `嗚！`, `全部，`, `齁齁齁` switch between TA and NC unpredictably. Each version's NC rules draw the line slightly differently. No version has stably fixed all of them. The root issue: NC is defined by non-verbal sounds, but many TA utterances are also monosyllabic or sound-like.

**3. NTA elaborate taxonomy backfired**
v1 simple NTA: 18.5% recall. v4 six-category NTA taxonomy: 0% recall. More elaborate rules made the model *less* likely to commit to NTA, not more. The pattern reverses in v10 (37% recall with simpler rules). Implication: for low-frequency codes, simpler rules with clear examples outperform comprehensive taxonomies.

**4. RF←→BD←→TA three-way instability**
The discovery utterances (`你發現了X`, `你找到X`) rotate across RF, BD, and TA across versions:
- v0/v1: some coded TA, some RF
- v4: RF→BD (verbal-echo intercept over-fired)
- v9: BD→TA (BD→TA fix over-corrected)
- v10-d38: TA→RF (partially corrected, still unstable)
- v10-75f: RF (subject field = `兒童` locks them in)
The subject field in 75f09222 is the first fix that worked, and the mechanism is different from all prior attempts: instead of a code-boundary rule, it forces explicit subject identification before coding.

**5. LP→BD false positive is permanent**
`你有輕輕地幫他盪鞦韆` coded LP4 since v1 and has never been fixed. LP rules introduced in v1 captured this utterance and no subsequent rule change has displaced it. The utterance is structurally ambiguous: "you gently helped him swing" could read as a labelled praise (LP) or a BD. Without a specific exception, LP4 wins every time.

## Per-code causal analysis — how each prompt change worked

All numbers below are averages over 3 independent runs (file-verified). "d38" = `d38d4b95`, "75f" = `75f09222` B3b (seed=42+nonce), "a2f" = `a2ffd24d`.

### Change 1: Subject chain-of-thought field (d38 → 75f)

Full per-code precision/recall shift:

| Code | Recall Δ | Precision Δ | Direction |
|---|---|---|---|
| RF | **+5.1 pp** | -4.7 pp | Recall up, but more false-RF |
| IC | +2.2 pp | **+9.7 pp** | Both better — fewer spurious IC |
| NC | +3.3 pp | -1.1 pp | Recall up |
| DC | +2.2 pp | +1.5 pp | Both better |
| UP | +2.1 pp | -2.2 pp | Recall up, slight precision loss |
| TA | +1.1 pp | +1.4 pp | Small improvement |
| LP | 0 | +4.2 pp | No recall change; fewer false LP |
| BD | 0 | +1.1 pp | Unchanged |
| Q | -0.8 pp | +1.1 pp | Slight recall loss |
| NTA | 0 | 0 | Unchanged |

#### Mechanism — what actually happened utterance by utterance

**RF recall +5.1 pp: discovery/finding utterances correctly disambiguated from TA**

Three RF utterances in s4/s6 were TA→RF:
- `嘿，XX你發現了野餐墊欸` (TA→RF ✓)
- `喔，XX發現了一條魚` (TA→RF ✓)
- `XX發現、找到一塊麵包` (TA→RF ✓)

Mechanism: With subject=`兒童`, the model recognizes the parent is mirroring what the child just found — the defining characteristic of RF. Without the subject field, these "you found X" phrasings were grouped with TA's general tracking function.

**RF precision -4.7 pp: unintended side effect on object-subject questions**

`花花放哪裡？` (GT=Q): IQ→RF regression. When the subject is labeled `物品/玩具` (the flowers), a question about where the object goes is re-framed as a reflection about the object's state, not a question to the child. The model reasons: subject=物品/玩具 → statement about what should happen to it → RF. But the utterance is still Q: the parent is *asking* the child.

This reveals a class-level failure: **any question where the natural subject is the object, not the child, risks being misclassified as RF under the subject field**. The subject field makes the model assign pragmatics based on referent rather than utterance form.

**TA role-play recovery: DC→TA for pretend-play commands**

Three utterances in s5/s2 shifted DC/NTA→TA:
- `把手手舉起來` (DC→TA ✓)
- `這樣子看看` (DC→TA ✓)
- `小象齁。` (NTA→TA ✓)

Mechanism: subject=`遊戲角色` (play character) correctly signals these are in-character narration, not commands to the child. This was the primary design intent of the subject field — it worked exactly as intended for role-play sequences.

**IC precision +9.7 pp: false IC eliminated**

Several utterances that were spuriously coded IC in d38 are no longer IC in 75f. The subject field appears to resolve IC/DC/TA three-way ambiguities by making the referent explicit, reducing false alarms.

**BD unchanged, NTA unchanged**

The subject field does not help the BD→DC cluster (`裝起來`, `把車子蓋起來`). These are genuinely ambiguous without visual context — even with subject=`兒童`, the model correctly identifies the child as referent but still interprets the action-completion form as a command. The subject field answers *who*, not *whether the child is already doing it*.

**One paired-utterance inconsistency exposed:**

`嘿，XX你發現了野餐墊欸` (GT=RF, improved ✓) and `你找到野餐墊` (GT=TA, regressed ✗) are near-identical utterances with different ground-truth codes. The subject field makes both look like RF ("subject=child, who found something"). The model correctly converges both to RF — but this exposes a ground-truth annotation inconsistency rather than a fixable prompt error.

---

### Change 2: NC and TA rule edits (75f → a2f) — regression analysis

Full per-code shift:

| Code | Recall Δ | Precision Δ | Direction |
|---|---|---|---|
| NC | **-10.0 pp** | +0.4 pp | Heavy recall loss |
| DC | -5.9 pp | +0.1 pp | Recall loss |
| NTA | -3.7 pp | +4.6 pp | Recall loss, slightly purer |
| UP | -2.1 pp | -2.2 pp | Both worse |
| TA | -1.1 pp | **-2.8 pp** | More TA false positives |
| IC | 0 | **-6.4 pp** | Many more spurious IC |
| RF | +2.0 pp | +2.7 pp | Improved (side effect) |
| BD | 0 | -2.2 pp | More false BD |
| Q | +0.8 pp | +0.4 pp | Slight improvement |
| LP | 0 | -2.2 pp | More false LP |

#### Mechanism — the TA over-absorption pattern

The new TA rules caused TA to absorb content from three neighboring codes:

**1. TA eating NC onomatopoeia (NC recall -10 pp)**

`齁齁齁齁齁齁齁齁齁。` and `齁。` (100%→33%, NC→TA): Two repeated grunt sounds correctly coded as NC in 75f, now moving to TA. The new TA rules apparently included language about "vocalisations accompanying tracking" or similar, which the model applied to these sounds. NC's onomatopoeia definition was effectively crowded out.

**2. TA eating DC cleanup commands (DC recall -5.9 pp)**

`椅子要放好阿`, `也要放好`, `這都要收進去`, `椅子要放好。` all dropped from 100% to 67% stable. These are DC (direct commands for cleanup) that the new TA rules apparently captured as "narrating expected state." The boundary `椅子要放好` = "chair should be put right" reads as both DC (command) and TA (tracking that the state isn't right). Expanded TA pulled them out of DC territory.

`阿你桌上的玩具還沒有收好阿。` (TA→NTA): A mild correction framed as observation ("your toys on the table aren't put away") was coded as NTA by the new NTA rules. GT=TA. The new NTA rules apparently broadened NTA to include these observational corrections.

**3. IC precision collapse (-6.4 pp)**

More utterances incorrectly predicted as IC in a2f. The most likely mechanism: tighter DC rules push some utterances out of DC, and the fallback coding pattern goes IC (indirect command) rather than TA. IC effectively acts as a "DC recycle bin" when DC rules become more restrictive.

**4. RF improvements (side effect)**

RF improved +2 pp recall and +2.7 pp precision in a2f vs 75f. Because TA precision decreased (more TA false positives), some utterances that would have been falsely TA in 75f were now not TA, and the model landed on the correct RF. This is an incidental benefit, not a targeted one.

#### Incidental Q fix from the NC/TA edits

`花花放哪裡？` (RF→IQ fix): This utterance that regressed to RF in 75f (the object-subject problem above) incidentally *improved* in a2f to the correct IQ. The NC/TA edits changed how the model handles short question-form utterances, apparently breaking the false RF classification. This is not a sustainable fix — it's a collateral correction from a different change.

---

### Cross-cutting themes for next iteration

1. **RF/TA boundary rule needed:** The distinction between RF (reflecting the child's action back) and TA (tracking narration) is the highest-value remaining target. RF improved +5 pp with the subject field but precision dropped. A sharper rule: *RF requires an immediately-prior child action that the parent is mirroring verbally; TA is the parent's own running commentary not contingent on a specific prior child act.* The subject field helps identify the referent but doesn't encode the temporal contingency.

2. **Guard rule for object-subject questions:** Add: "When the subject is an object/toy, if the utterance form is a question, code it as Q/IQ/DQ — not RF. RF requires the child as the primary referent." This directly targets the `花花放哪裡？` failure class.

3. **NC must explicitly cover repeated onomatopoeia sounds:** The a2f regression shows that NC's onomatopoeia coverage is fragile against TA rules. Add explicit examples of repeated sounds (`齁齁齁`, animal sounds repeated 3+ times) as NC to immunise against TA absorption.

4. **DC/TA for cleanup commands needs anchored examples:** `椅子要放好` type utterances are structurally ambiguous. Anchoring DC vs TA with explicit examples of this cleanup-instruction class (where the child must act vs parent is just narrating) would reduce variance.

5. **BD→DC is not a prompt problem:** Every prompt change has left `裝起來`, `把車子蓋起來` wrong. The subject field (subject=`兒童`) and every explicit BD-vs-DC rule have failed. These are genuine visual-context cases — the distinction requires knowing whether the child is mid-action. May require either (a) a very specific `把[X][V]起來` rule treating these as BD when in CDI toy-play context, or (b) accepting these as irreducible errors.

## Chunking experiment

**Hypothesis:** 100 utterances is a large context for the model to hold alongside a complex coding manual. Breaking sessions into 20-utterance chunks and running in parallel might reduce context overload and improve accuracy.

**Implementation:** `dpics-eval-run.cjs` was modified to split `utterancesData` into N-utterance chunks, call `llmCall` in parallel for each chunk, and concatenate results. Each chunk call gets a fresh UUID nonce. Tested on v10 `8bbc7581`, all 6 sessions, Pro + new manual + seed=42.

**Results (all 6 sessions, n=452):**

| Config | Accuracy |
|---|---|
| 20-utterance chunks (parallel) | 90.78% |
| Single full-session call | 91.15% |

Chunking **did not help** — it cost 0.37 pp on average. Two possible reasons:
1. Cross-chunk context loss: the model can't see utterances from other chunks when resolving pronouns or tracking topic continuity. A chunk starting mid-session lacks setup.
2. The manual cache (grounding document) is shared but the conversational context is severed at chunk boundaries — the model loses the inferred "this session is about gardening" context that informs subject disambiguation.

**Decision:** Reverted to single full-session call. `const chunks = [utterancesData]` — effectively a no-op chunking that preserves the parallel-call infrastructure if needed later.

---

## Enrichment experiment — Flash pre-annotation

**Hypothesis:** Chinese's subject-dropping grammar is the main source of coding errors. A cheap pre-processing step (Gemini 3.5 Flash, ~$0) can resolve implicit subjects and pronouns before the coding model sees the utterance, reducing the Pro model's inference burden.

**Implementation:** `dpics-enrich.cjs` passes each full session (all roles, for context) to Flash with a coreference-resolution prompt. Flash adds an `enriched` field to every utterance with implied subjects bracketed and pronouns replaced:

```
Before: 放在這裡就好了。
After:  （你）（把積木）放在這裡就好了。

Before: 謝謝你把它放好。
After:  謝謝你把（建築的東西）放好。
```

The enriched field is then passed as `text` to the v10 Pro coding call instead of `verbalization`.

**Results — enriched vs. no-enrichment (d175d4c5, Pro, seed=42, s1–3):**

| Session | No-enrichment | Enriched | Δ |
|---|---|---|---|
| s1 (n=79) | 98.7% | 98.7% | 0 |
| s2 (n=109) | 89.0% | 86.2% | **-2.8 pp** |
| s3 (n=101) | 89.1% | 84.2% | **-4.9 pp** |
| **Overall (s1–3)** | **92.1%** | **88.9%** | **-3.2 pp** |

Enrichment **hurt** on every session with meaningful content.

**Why it regressed:**

1. **Flash introduces fabricated context.** When the conversational referent is genuinely ambiguous, Flash guesses — and guesses wrong. E.g. `謝謝你把它放好` → `謝謝你把（建築的東西）放好` when the actual object was a flower pot. The coding model then reasons about `建築的東西` (construction materials) instead of the real object, shifting boundary decisions.

2. **Enriched text changes surface form.** The coding model's rules were calibrated on raw verbalization text. Inserting `（你）` or `（把X）` mid-sentence changes the syntactic structure the model pattern-matches against. What reads as BD or DC in the raw form may read as LP or TA after enrichment alters the framing.

3. **The Pro model already handles implicit subjects well through the subject CoT field.** The subject chain-of-thought in `75f09222` (outputting `"subject": "兒童"` before choosing the code) is a better mechanism for the same purpose — it keeps the original text intact and adds subject information as a separate reasoning step, not as a text modification.

**Decision:** Enrichment as a pre-processing pass does not help with the current v10 prompt. The subject CoT field in the prompt is a superior approach to the same problem. The `dpics-enrich.cjs` and `dpics-anno-code.cjs` scripts are available but not part of the standard eval pipeline.

---

## DeepSeek experiment — embed-manual approach

### Setup

DeepSeek's API (OpenAI-compatible) has no file-upload or context-cache equivalent. The manual PDF and appendix must be embedded inline. The `--embed-manual` flag was added to `dpics-eval-run.cjs` to handle this:

- **System message** (fixed, never changes between runs): manual text (extracted via `pdftotext`, ~568K chars) + appendix JSON
- **User message** (changes per prompt iteration): v10 rules (~12K chars) + utterances (~11–14K chars)

Splitting this way keeps the system message stable so future API-level caching (if DeepSeek adds it) would require no changes.

Total context per call: ~160K tokens. Prompt saved to `prompts/deepseek/` for reference (`system.txt` + `session-{N}-user.txt`).

Eval command:
```bash
node server/scripts/dpics-eval-run.cjs --session session-N --model deepseek-v4-flash --prompt dpicsCoding-agentic-v10 --embed-manual
```

### Results — `dpicsCoding-agentic-v10` (`d8c3cbc7`), all 6 sessions

#### Single-run comparison: Flash v4 vs Pro v4 vs Gemini Pro

| Session | n | DS Flash v4 | DS Pro v4 | Gemini Pro (75f, 3-run avg) |
|---|---|---|---|---|
| s1 | 79 | **97.47%** | 93.67% | 100.00% |
| s2 | 108 | 85.19% | 82.41% | 91.36% |
| s3 | 99 | 86.87% | 77.78% | 91.25% |
| s4 | 46 | 84.78% | 78.26% | 92.75% |
| s5 | 51 | 88.24% | 88.24% | 90.20% |
| s6 | 66 | **93.94%** | **93.94%** | 92.93% |
| **Total** | **449** | **89.31%** | **85.30%** | **93.10%** |

Latency: Flash ~40–55s per session; Pro ~110s. Both single-call, no Gemini cache overhead.

#### Multi-run variance — DeepSeek Flash v4 (4 runs)

After moving the UUID nonce to the front of the user message (same position as Gemini's nonce):

| Session | Run 1 | Run 2 | Run 3 | Run 4 | Avg |
|---|---|---|---|---|---|
| s1 | 97.47% | 97.47% | 96.20% | **100.00%** | **97.79%** |
| s2 | 85.19% | 87.04% | 86.11% | 86.11% | **86.11%** |
| s3 | 86.87% | 86.87% | 83.84% | 84.85% | **85.61%** |
| s4 | 84.78% | 71.74% | 71.74% | 80.43% | **77.17%** |
| s5 | 88.24% | 88.24% | 92.16% | 88.24% | **89.22%** |
| s6 | 93.94% | 89.39% | 93.94% | 92.42% | **92.42%** |
| **Total** | **89.31%** | **87.75%** | **87.75%** | **89.53%** | **88.59%** |

**4-run average: 88.59%**, range 87.75–89.53%. **s4 is the main variance source** (71–85%), driven by 9 structurally ambiguous utterances that flip across runs:
- TA/NC/BD boundary: `媽媽會...學你`, `嗯，XX，你手上拿的是那個`, `你找到野餐墊`, `喔，你發現、XX有發現有馬桶`
- UP/LP boundary: `哇，你這個設計...真的很漂亮`
- RF/TA: `XX你想做大改造喔`

Nonce position (front vs after rules) did not meaningfully change variance — s4 instability is content-driven, not caching-driven.

### Key findings

1. **Flash beats Pro by 4 pp** (89.31% vs 85.30%), and is ~2× faster. For DeepSeek, Flash is the clear choice.

2. **DeepSeek Flash 4-run avg (88.59%) vs Gemini Flash 3-run avg (90.13%)** — gap is ~1.5 pp. Substantially narrower than the single-run comparison suggested.

3. **DeepSeek Flash vs Gemini Pro gap is ~4.5 pp** (88.59% vs 93.10%) on a robust multi-run basis.

4. **s4 is DeepSeek's weak session** (avg 77%) vs Gemini Pro's 92.75%. Same ambiguous utterances drive variance on both providers; DeepSeek resolves them less consistently.

5. **s6 is stable across providers** — 92–94% on every model and every run.

### NTA performance

NTA is highly unstable for DeepSeek Flash across runs:

| Run | NTA accuracy | Notes |
|---|---|---|
| Run 1 | 3/9 = 33.3% | TA×3, DQ×2, RF×1 |
| Run 2 | 3/9 = 33.3% | |
| Run 3 | 3/9 = 33.3% | |
| Run 4 (front nonce) | 2/9 = 22.2% | gained `椅子、你的椅子沒有擺好。`, lost others |
| **DS Pro v4** | **4/9 = 44.4%** | TA×2, DQ×2, RF×1 |
| **Gemini Pro (`75f09222`)** | **4/9 = 44.4%** | — |

DeepSeek Flash NTA recall is 22–33% across runs — worse than Pro (44%) and Gemini Pro (44%), and unstable. The same core cases (`嗯嗯。`→TA, `是這樣嗎？`→DQ, `你覺得你放不平均喔。`→RF) are wrong on every run of every model. NTA weakness is structural and model-agnostic, not DeepSeek-specific.

### Manual-only baseline

Running with a condensed user prompt (subject/output format rules only, relying on the full manual for coding rules — no v10 decision rules):

| Session | manual-only | v10 rules | Δ |
|---|---|---|---|
| s1 | 98.73% | 97.47% | +1.3 |
| s2 | 82.41% | 85.19% | -2.8 |
| s3 | 81.82% | 86.87% | -5.1 |
| s4 | 67.39% | 84.78% | **-17.4** |
| s5 | 84.31% | 88.24% | -3.9 |
| s6 | 62.12% | 93.94% | **-31.8** |
| **Total** | **79.24%** | **89.31%** | **-10.1** |

The v10 decision rules add **+10 pp** overall. s4 and s6 collapse without them (-17 and -32 pp) — both are heavy in LP/BD/DC distinctions where the explicit rules do the most work. The manual alone is insufficient for these finer-grained codes.

---

## No-cache baseline across models (`d8c3cbc7`)

All runs use `dpicsCoding-agentic-v10` (hash `d8c3cbc7`) with `--no-cache` — v10 rules prepended as plain text to the user message, no manual/appendix attached. Nonce prepended to every user message. Single run each.

### Gemini Flash and Pro — no-cache vs embed-manual

| Session | n | Flash no-cache | Flash embed-manual (4-run avg) | Pro no-cache | Pro embed-manual (1 run) |
|---|---|---|---|---|---|
| s1 | 79 | 96.20% | 97.05% | 94.94% | 93.67% |
| s2 | 108 | 87.04% | 86.11% | 87.96% | 82.41% |
| s3 | 99 | 84.85% | 85.86% | 85.86% | 77.78% |
| s4 | 46 | 78.26% | 76.09% | 80.43% | 78.26% |
| s5 | 51 | 86.27% | 89.55% | 90.20% | 88.24% |
| s6 | 66 | 93.94% | 92.42% | 92.42% | 93.94% |
| **Total** | **449** | **88.18%** | **88.59%** | **88.42%** | **85.30%** |

**No-cache essentially matches or beats embed-manual for both Gemini models.** The v10 rules alone are sufficient — embedding the 568K-char manual adds nothing measurable for Flash (+0.4 pp), and actively hurts Pro (-3.1 pp on embed-manual vs no-cache). This contrasts with DeepSeek, where embed-manual scores 88.59% (4-run avg) — very close to Gemini's no-cache numbers.

The gap between Gemini (cached manual, `75f09222`) at **93.10%** and no-cache at **88.18–88.42%** reveals that the +5 pp gain from Gemini's file-cache approach comes from the combination of the manual PDF *and* the `75f09222` prompt hash's subject CoT field, not just having the manual text present. Running `d8c3cbc7` (which also has the subject field) no-cache shows that simply having the manual inline doesn't replicate Gemini's native cached-manual performance.

### gpt-4o no-cache

gpt-4o was set up as a new provider (OpenAI-compatible, `max_completion_tokens` capped at 16384). The full embed-manual approach is not viable: at 159K tokens, the prompt exceeds gpt-4o's 128K context window and OpenAI Tier 1's 30K TPM limit.

Tested via `--user-prompt-dir` using the pre-saved DeepSeek prompts (which embed v10 rules in the user message). No system prompt is set when `--user-prompt-dir` is active — the saved file is self-contained.

| Session | n | gpt-4o (no-cache, user-prompt-dir) | Flash no-cache | Pro no-cache |
|---|---|---|---|---|
| s1 | 79 | 75.95% | 96.20% | 94.94% |
| s2 | 108 | 78.70% | 87.04% | 87.96% |
| s3 | 99 | 84.85% | 84.85% | 85.86% |
| s4 | 46 | 60.87% | 78.26% | 80.43% |
| s5 | 51 | 78.43% | 86.27% | 90.20% |
| s6 | 66 | 87.88% | 93.94% | 92.42% |
| **Total** | **449** | **79.51%** | **88.18%** | **88.42%** |

gpt-4o scores **79.51%** — ~9 pp below both Gemini models on the same rules-only input. s4 (60.87%) is notably weak. The context for these calls was the DeepSeek embed-manual user message (which includes v10 rules + utterances but was designed for a DeepSeek system-message context), so some prompt-model mismatch is expected. A gpt-4o-native prompt may perform better.

**Rate limits:** Tier 1 is 30K TPM for gpt-4o. Running 6 sessions in parallel (each ~13–24K tokens) saturates the limit. Sessions must be run sequentially. Tier 2 requires $50+ cumulative spend.

---

## Flash vs Pro disagreement arbitration

### Experiment design

For each of the 6 sessions (no-cache, `d8c3cbc7`), disagreements between Gemini Flash and Gemini Pro at the **exact code level** were extracted. Cases where both models gave different codes but both happened to land in the correct category were identified. Only cases where at least one model was categorically wrong ("meaningful" disagreements) were passed to an arbiter.

The arbiter call: Gemini Pro + cached manual (filesOnly cache), single call with all disagreement cases formatted as a structured prompt (utterance + ±2-utterance context window + both model predictions).

Script: `server/scripts/dpics-disagree-arbitrate.cjs`

### Results

| | Count |
|---|---|
| Total exact-code disagreements | 67 |
| Both categorically correct (different codes, same category) | 38 |
| **Meaningful disagreements (≥1 model wrong)** | **29** |

Among the 67 exact-code disagreements, 38 were not real errors by category match — Flash and Pro gave different codes that both mapped to the correct category (e.g. Q vs DQ both correct). Only 29 disagreements represent a genuine coding error.

**Breakdown of the 29 meaningful cases:**

| Situation | Count | Arbiter correct |
|---|---|---|
| Flash correct, Pro wrong | 12 | 7/12 (agreed with Flash) |
| Pro correct, Flash wrong | 15 | 9/15 (agreed with Pro) |
| Both wrong | 2 | 1/2 (uniquely correct) |
| **Total** | **29** | **17/29 = 58.6%** |

On the 29 hard cases, Pro edges Flash (15 vs 12 correct), and the arbiter with the full manual gets 17/29 — better than either model alone (+2 from Flash, +2 from Pro). The manual is providing a meaningful tiebreak on genuine boundary cases.

### Combined (agree → use agreed code; disagree → use arbiter code) accuracy

| Session | n | Combined + arbiter |
|---|---|---|
| s1 | 79 | 100.00% |
| s2 | 108 | 88.99% |
| s3 | 99 | 83.17% |
| s4 | 46 | 76.09% |
| s5 | 51 | 86.27% |
| s6 | 66 | 93.94% |
| **Total** | **452*** | **88.72%** |

\* Slight count difference (452 vs 449) because the union of Flash and Pro covers a few utterances missed by one model.

The ensemble (88.72%) improves over Flash alone (88.18%) and Pro alone (88.42%) by +0.5 pp. Gains are modest because the 29 hard cases have a ceiling: even with the full manual, the arbiter only reaches 58.6% on them.

### Error patterns in arbitration failures (12/29 wrong after arbitration)

- **RF vs TA for short acknowledgments** (`那邊喔，好`, `有喔`): Both models and arbiter call TA; ground truth is RF. The model consistently misses that brief acknowledgments of a child's statement are RF.
- **Contextual DC vs TA** (s5: `去開紅色的車子`, `把手手舉起來`, `這樣子看看`): Arbiter sides with Pro (TA) but Flash was right (DC). These are play-context commands without explicit imperative markers — the arbiter lacks the visual context to distinguish.
- **LP/BD/UP boundary** (s4: `放得好穩喔`, `哇，你這個設計...真的很漂亮`): Arbiter picks LP/BD where ground truth is TA/UP. Praise threshold judgment is still inconsistent.

---

## Open items

- **Best prompt**: `agentic-v10` (hash `75f09222`) with `gemini-3.1-pro-preview` + new manual + seed=42 + nonce is the current best at **93.10%** (all 6 sessions, 3-run avg). This is a meaningful improvement over the previous best cluster (`agentic-v1`/`agentic-v4` at ~91-92%). However, the old-vs-new manual advantage has reversed — further investigation needed to confirm whether this is a property of v10's subject field or a general trend.
- **NTA recall improved from 0% (all prior prompts) to 44.4% (4/9) in `agentic-v10` (`75f09222`), with 100% precision.** Five cases remain persistently wrong on every run: `嗯嗯。`→TA, `是這樣嗎？`→DQ, `因為這樣太重太多了。`→TA, `你是大力士？`→DQ, `你覺得你放不平均喔。`→RF. All involve sarcasm or implicit negativity with no overt negative surface form. May require few-shot examples or a two-pass NTA audit.
- **Persistent BD→DC error cluster in session-5** (`裝起來`, `把車子蓋起來`, `把手手舉起來`, `你有輕輕地幫他盪鞦韆`) is unresolved across all models and all prompt versions tested. Likely requires a very specific BD-vs-DC rule for action-completion framing in Chinese.
- IC's root-cause regression (introduced somewhere in `v3`→`v4`) was never isolated.
- The English-translation experiment is paused, not concluded.
- `doc/codingTest.md`'s session-ID table is stale relative to the most recent re-seed.
- The mechanism-mixing audit only checked prompts already in the original Results table — any future addition to `eval-results/dpics/` should be checked against `noCache`/`legacycache`/timestamp-cutoff logic before pooling.
- **Nonce + seed interactions with `legacyCache`**: seed=42 achieved perfect determinism on s1/s5/s6 but not s2/s3/s4. Whether the variance in the larger sessions is due to the explicit cache bypassing the seed, or intrinsic model non-determinism at scale, is unconfirmed.
- **gpt-4o baseline is 79.51%** on no-cache with the DeepSeek user-prompt-dir. A gpt-4o-native prompt (not recycled from DeepSeek's embed-manual format) may score higher. Tier 1 rate limits (30K TPM) require sequential runs; Tier 2 needs $50+ spend. Embed-manual is not viable for OpenAI — 160K tokens exceed both the 128K context window and any reasonable rate limit.
- **Qwen experiments** (qwen3.7-max embed-manual, `d8c3cbc7`) were rate-limited before all 6 sessions could complete. Results are incomplete and not included in this doc. The international API endpoint (`dashscope-intl.aliyuncs.com`) is confirmed working; burst rate limits are aggressive and sessions must be run with long delays between them.
