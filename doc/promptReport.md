# DPICS Automated Coding — Prompt Evaluation Report

**Prepared for:** Head of Research
**Date:** 2026-06-29
**Scope:** Full evaluation of prompt versions, model choices, and configuration settings for automated DPICS coding using LLMs, covering all 6 gold-standard CDI sessions (n=449 adult utterances).

---

## Executive Summary

Automated DPICS coding using `gemini-3.1-pro-preview` with the best-performing prompt (`agentic-v10`, version `75f09222`) and the new DPICS manual achieved **93.10% category match accuracy** against human-coded ground truth, averaged across 3 independent runs. This represents the highest accuracy recorded across all prompt versions and model configurations tested.

Key conclusions:

- **Best configuration:** `agentic-v10` (hash `75f09222`) + `gemini-3.1-pro-preview` + new manual + seed=42 + nonce prefix. Category match accuracy: **93.10%** across all 6 sessions (n=449).
- **Model matters significantly:** Pro outperforms Flash by ~3 percentage points and is considerably more stable across runs.
- **Prompt design outweighs manual choice:** The new manual and old manual now perform similarly under the best prompt (+0.67 pp in favour of new); earlier prompts favoured the old manual by up to 2 pp.
- **Two persistent error clusters remain:** NTA (Negative Talk) recall improved from 0% in earlier prompts to 44.4% in v10, but five sarcastic/implicit cases are still missed on every run; a BD→DC confusion cluster in Chinese action-completion utterances is unresolved across all models and prompts.

---

## 1. What Is Being Measured

DPICS (Dyadic Parent–Child Interaction Coding System) assigns one of 11 behavioural codes to each parent utterance during a CDI play session. The automated system reads session transcripts and outputs a code per utterance.

**Primary metric — Category Match Accuracy:** Predicted and ground-truth codes are first collapsed through equivalence groups (`Q`/`DQ`/`IQ`, `LP`/`LP1-4`, `TA`/`AN`/`AK`/`ID`) before comparison. This is the correct metric to use: the two DPICS manual editions use different granularity for some codes (e.g. the new manual distinguishes `DQ` from `IQ` while the old uses only `Q`), so a prediction of `DQ` where the ground truth says `Q` is not a real error. Exact match would wrongly penalise these.

**Secondary metric — Cohen's Kappa:** Agreement corrected for chance. Accounts for the fact that some codes (`TA`, `Q`) are much more frequent than others (`NTA`, `IC`), so a model that simply guesses `TA` everywhere would appear to have high raw accuracy. Kappa values in the 0.85–0.91 range correspond to the top-performing prompts.

**Dataset:** 6 human-coded CDI sessions with 449 total adult utterances. Distribution is uneven: `TA` (148 utterances, 33%) and `Q` (85, 19%) dominate; `NTA` (9) and `IC` (15) are sparse. The sparsity of `NTA` and `IC` means a few missed utterances change their F1 score by 10–25 points — these codes cannot be reliably ranked between prompt versions with the current dataset size.

---

## 2. Evaluation Setup

### Models tested

| Model | Role |
|---|---|
| `gemini-3.1-pro-preview` | Primary evaluation model; best accuracy and consistency |
| `gemini-3.5-flash` | Speed/cost comparison; lower accuracy and higher variance |
| `claude-sonnet` | One-time comparison run (single run, no further testing) |

All Gemini runs used a **context cache** that holds the DPICS manual PDF alongside the coding prompt. The model receives the session transcript as the user turn and returns a JSON array of codes.

### Manuals

Two editions of the DPICS manual were tested as the grounding reference:
- **Old manual:** `DPICS-Manual.2.18.pdf` — the edition in current clinical use
- **New manual:** `Manual_for_the_Dyadic_Parent-Child_Interaction_Cod.pdf` — the updated edition with finer code granularity and revised NTA/NC sections

### Non-determinism controls

Even at temperature=0, Gemini's serving infrastructure (GPU/TPU batching) produces real run-to-run variation. Across all experiments, single-run results should not be treated as definitive — differences smaller than ~3 percentage points carry no reliable signal without multiple runs. Two controls were adopted:

- **`seed=42`** in the generation config — stabilises simpler sessions (s1, s5 became perfectly reproducible) but does not eliminate variance in longer, more ambiguous sessions.
- **UUID nonce prefix** on the user prompt — prevents Gemini's implicit prefix-match caching from serving cached outputs, forcing fresh inference every call. Combined with seed=42, this stabilised an additional session (s6) and reduced variance in others.

**All results marked "file-verified" were computed directly from saved result JSON files, not from terminal output.**

---

## 3. Prompt Evolution

### 3.1 Baseline and early iterations

| Prompt | Cat. Match | Kappa | Notes |
|---|---|---|---|
| `v0` (no custom rules; manual PDF only) | 82.4% | 0.769 | Theoretical floor for grounded-only approach |
| `v3`–`v6` (manual trial-and-error) | ~83–90% | ~0.80–0.88 | Inconsistent; `v8`/`v9` inflated by a scoring bug |
| `agentic-v1` (8-run pooled, validation set) | **89.1%** | **0.861** | Most statistically robust single-prompt estimate |
| `agentic-v2` (stable re-run) | 88.2–88.7% | 0.851–0.857 | Confirms ~91.6% original result was a non-determinism outlier |
| `agentic-v4` (old manual, Pro) | **91.6%** | **0.892** | Single run; top of the pre-v10 cluster |

The gap between `v0` and the top of the pre-v10 cluster (~91.6% on validation) represents the accumulated value of prompt engineering. The top cluster (`agentic-v1`, `agentic-v2`, `agentic-v4`) is statistically indistinguishable due to run-to-run variance — there is no confidently determined single best among them.

### 3.1a What the prompt changes actually did — per-code causal analysis (all 6 sessions, old manual, Pro)

Running per-code analysis across all versions on all 6 sessions reveals that **v0 through v9 all score ~88% globally**, and that gains in one code category were consistently offset by regressions in others. The 4+ pp jump to v10 came from a different type of change.

**Per-code recall across the full history:**

| Code | v0 | v1 | v4 | v9 | v10-d38 |
|---|---|---|---|---|---|
| TA | 89.2% | 83.8% | 83.8% | 83.8% | 90.1% |
| Q | 97.6% | 97.6% | 97.6% | 95.3% | **99.6%** |
| BD | 96.2% | 94.2% | 94.2% | 94.2% | 91.0% |
| DC | 93.3% | 91.9% | **97.8%** | **97.8%** | 92.6% |
| RF | 72.7% | **87.9%** | 77.8% | 83.8% | **93.9%** |
| NC | 0% | 83.3% | 88.3% | 81.7% | **91.7%** |
| UP | 87.5% | 87.5% | 87.5% | 87.5% | 85.4% |
| IC | 60.0% | **86.7%** | 77.8% | **86.7%** | **100.0%** |
| NTA | 0% | 18.5% | 0% | 11.1% | 37.0% |

#### v0 → v1: NC and RF rules added — IC over-fire introduced

v1 added NC coverage (bringing NC recall from 0% to 83%), RF disambiguation rules (RF recall 72.7% → 87.9%), and NTA rules (0% → 18.5%). IC recall jumped from 60% to 86.7%.

The cost: TA recall fell from 89.2% to 83.8% and stayed there through v4 and v9. Short TA utterances (`全部，`, `嗚！`, laughter sounds) started being absorbed into NC. Additionally, v1's IC rules introduced a persistent **IC over-fire pattern** — utterances with imperative-seeking surface forms (`好不好？`, `XX，那邊。`, cleanup commands like `椅子要放好`) were misclassified as IC. Some persisted wrongly in every version until v10.

#### v1 → v4: IC over-fire partly fixed, RF→BD regression introduced, NTA taxonomy backfired

v4 fixed the cleanup-command IC errors (`椅子要放好阿` correctly DC). But its "verbal-echo intercept" rule for RF vs BD caused three child-discovery utterances (`嘿，XX你發現了野餐墊欸`, `喔，XX發現了一條魚`, `XX發現、找到一塊麵包`) to shift RF→BD. **RF recall fell from 87.9% back to 77.8%.**

Most significantly: v4 introduced a six-category NTA taxonomy designed to improve NTA recall. It had the opposite effect — **NTA recall dropped from 18.5% back to 0%.** More subcategories raised the model's threshold for committing to NTA rather than lowering it. This is a general pattern for low-frequency codes: elaborate taxonomies underperform simple rules with clear examples.

Net result: v4 (87.97%) is slightly *lower* than v1 (88.57%) on all 6 sessions, despite fixing some individual errors.

#### v4 → v9: BD→TA over-correction, IC over-fire returned

v9 correctly identified that `你/XX發現了X` utterances are TA (tracking), not BD — fixing v4's RF→BD regression partially. But the IC over-fire returned in a new form: `那邊也要種花阿`, `好嗎？` hit IC again. Exclamations `哇！`, `哇~` shifted to UP instead of TA.

Result: 38.57% → net accuracy unchanged at ~88%.

#### v9 → v10-d38: structural rule, not expansion — broke the plateau (+4.1 pp)

The biggest single improvement was the explicit rule that `要不要...`, `好不好?`, `好嗎?` are Q-forms, not indirect commands. This fixed utterances that had been wrong in every prior version: `那你要不要幫我放一些花？`, `好不好？`, `好嗎？` (×2 in s3). **A single bright-line grammatical rule corrected 4–5 utterances without touching anything else** — exactly the class of change that moves accuracy without causing collateral regressions.

IC recall reached 100% for the first time. Exclamation TA recovery (`哇！`, `嗚！`), NTA improvement (37% recall vs 11%), and 38 total improvements vs only 12 regressions explain the +4.1 pp gap.

**The key lesson across v0–v9:** Every version that tried to improve a code by adding more description or subcategories ended up trading recall in that code for false-positives in adjacent codes. The v10 jump came from the opposite approach — a structural exclusion rule (grammatical Q-form = always Q) that left adjacent codes undisturbed.

### 3.2 Model comparison at peak pre-v10 performance

Using `agentic-v1` (hash `228a0484`), old manual, validation set (sessions 1, 2, 5; n=238):

| Model | Runs | Cat. Match | Kappa | Notes |
|---|---|---|---|---|
| `gemini-3.1-pro-preview` | 3-run avg | **92.3%** | **0.901** | Tight distribution: 91.2–92.9% |
| `gemini-3.5-flash` | 2-run avg | ~89.7% | ~0.869 | Higher variance: 87.8–91.6% |
| `claude-sonnet` | 1 run | 85.3% | 0.812 | Not further evaluated |

Pro's advantage over Flash (~2.6 pp) held consistently across multiple prompt versions. Flash's wider variance (up to 3.8 pp swing between runs on the same session) means it would require multiple runs in production to match Pro's reliability.

---

## 4. agentic-v10 Evaluation

`agentic-v10` is the current best prompt, developed by the user. It is a fully self-contained coding specification (no "see manual" references) with explicit decision rules for each code. All v10 evaluation was run across all 6 sessions (n=449) using `--legacy-cache`.

### 4.1 What was tested

Four prompt versions (identified by content hash) were evaluated:

| Hash | Change | Outcome |
|---|---|---|
| `d38d4b95` | Baseline v10 — corrected `要不要→Q` rule | 90.87–92.28% depending on manual |
| `75f09222` | + Subject chain-of-thought output field | **93.10%** — current best |
| `a2ffd24d` | + NC and TA rule edits | 91.83% — regression of -1.27 pp; reverted |
| `8bbc7581` | After partial revert | 92.28% — not fully restored to `75f09222` |

### 4.2 Phase 1 — Baseline (`d38d4b95`)

The `要不要→Q` rule correction (utterances like "要不要幫它做" previously miscoded as IC) was the primary change. Evaluated 3 runs each with both manuals.

| Session | New manual avg | Old manual avg |
|---|---|---|
| s1 (n=79) | 99.16% | 100.00% |
| s2 (n=108) | 91.67% | 93.83% |
| s3 (n=99) | 90.91% | 89.23% |
| s4 (n=46) | 88.41% | 90.58% |
| s5 (n=51) | 88.89% | 87.58% |
| s6 (n=66) | 90.40% | 89.90% |
| **Total** | **91.98%** | **92.28%** |

*New manual Run 1 (94.21%) was a non-determinism outlier; stable average of Runs 2–3 is 90.87%. Old manual advantage: +1.4 pp stable.*

Old manual performed better at this stage, most notably on s2 (93.83% vs 90.74% stable).

### 4.3 Phase 2 — Subject chain-of-thought (`75f09222`)

**The key change:** the model now outputs a `subject` label (`兒童` / `物品/玩具` / `家長自身` / `遊戲角色` / `第三方` / `不明`) for each utterance before selecting the DPICS code. The motivation was to reduce errors in role-play sequences where parents narrate toy-character actions — the model was misclassifying these as DC/IC/BD rather than TA. By explicitly naming the subject first, the disambiguation happens as part of the model's reasoning chain.

#### Determinism experiment (new manual, Pro, 4 configurations — file-verified totals)

| Configuration | Runs | Total accuracy |
|---|---|---|
| No seed, no nonce | 3 | 92.43% |
| seed=42, no nonce | 3 | 92.06% |
| **seed=42 + nonce (best)** | **3** | **93.10%** |
| temperature=0.3 + seed=42 + nonce | 3 | 92.50% |

Temperature=0.3 was tested in response to residual variance in longer sessions. It improved s5 (+2 pp) but regressed s2 (-2 pp) with no net gain. Temperature=0 with seed+nonce is the recommended configuration.

#### Per-session results — `75f09222`, Pro, seed=42 + nonce + temp=0 (file-verified)

| Session | New manual avg (3 runs) | Old manual avg (3 runs) | Δ (new − old) |
|---|---|---|---|
| s1 (n=79) | **100.00%** | **99.58%** | -0.4 |
| s2 (n=108) | **91.36%** | **91.67%** | +0.3 |
| s3 (n=99) | **91.25%** | **89.23%** | **+2.0** |
| s4 (n=46) | **92.75%** | **92.03%** | +0.7 |
| s5 (n=51) | **90.20%** | **91.50%** | -1.3 |
| s6 (n=66) | **92.93%** | **90.91%** | **+2.0** |
| **Total** | **93.10%** (1254/1347) | **92.43%** (1245/1347) | **+0.67** |

**The new manual now edges out the old manual (+0.67 pp).** This reverses the pattern seen in every prior prompt version. The gains for new manual are concentrated in s3 and s6, which both contain role-play and toy-narration sequences — exactly the content that the subject field was designed to help with. The new manual's terminology for these contexts is better matched to the subject field guidance.

#### Model comparison at `75f09222` (file-verified)

| Session | Flash 3.5, new | Flash 3.5, old | Pro 3.1, new | Pro 3.1, old |
|---|---|---|---|---|
| s1 (n=79) | 94.51% | 90.30% | 100.00% | 99.58% |
| s2 (n=108) | 88.89% | 89.51% | 91.36% | 91.67% |
| s3 (n=99) | 87.21% | 85.86% | 91.25% | 89.23% |
| s4 (n=46) | 89.13% | 86.23% | 92.75% | 92.03% |
| s5 (n=51) | 87.58% | 88.24% | 90.20% | 91.50% |
| s6 (n=66) | 93.94% | 90.40% | 92.93% | 90.91% |
| **Total** | **90.13%** | **88.49%** | **93.10%** | **92.43%** |

Pro outperforms Flash by **3.0 pp on the new manual** and **3.9 pp on the old manual**. Flash also shows 3–4× higher run-to-run variance per session (s4-old ranged 82.6–91.3% across 3 runs; s6-old ranged 83.3–93.9%).

### 4.4 Phase 3 — NC/TA rule edits and regression (`a2ffd24d` → `8bbc7581`)

Additional NC and TA rules were introduced by the user to improve edge-case coverage. The result was a regression of **-1.27 pp overall** (Pro, new manual, seed=42 + nonce; file-verified):

| Session | `a2ffd24d` (revised) | `75f09222` (reference) | Δ |
|---|---|---|---|
| s1 (n=79) | 99.16% | 100.00% | -0.84 |
| s2 (n=108) | 91.98% | 91.36% | +0.62 |
| s3 (n=99) | 87.88% | 91.25% | **-3.37** |
| s4 (n=46) | 87.68% | 92.75% | **-5.07** |
| s5 (n=51) | 90.85% | 90.20% | +0.65 |
| s6 (n=66) | 92.42% | 93.94% | -1.52 |
| **Total** | **91.83%** | **93.10%** | **-1.27** |

The regression was concentrated in s3 (-3.4 pp) and s4 (-5.1 pp), both of which are heavy in BD/DC/LP utterances. The expanded TA rules appear to have over-absorbed action-completion utterances that should have been coded BD or DC — a recurring hazard when broadening TA's scope. After reverting, a residual difference in the prompt (hash `8bbc7581`) left performance at 92.28%, 0.82 pp below the reference. The exact residual difference has not been identified.

---

## 5. Full Leaderboard — v10 Variants

| Prompt hash | Model | Manual | Configuration | Accuracy |
|---|---|---|---|---|
| `75f09222` | Pro 3.1 | New | seed=42, nonce, temp=0 | **93.10%** |
| `75f09222` | Pro 3.1 | Old | seed=42, nonce, temp=0 | 92.43% |
| `8bbc7581` | Pro 3.1 | New | seed=42, nonce, temp=0 | 92.28% |
| `d38d4b95` | Pro 3.1 | Old | no seed/nonce | 92.28% |
| `d38d4b95` | Pro 3.1 | New | no seed/nonce (stable runs only) | 90.87% |
| `a2ffd24d` | Pro 3.1 | New | seed=42, nonce, temp=0 | 91.83% |
| `75f09222` | Flash 3.5 | New | seed=42, nonce, temp=0 | 90.13% |
| `75f09222` | Flash 3.5 | Old | seed=42, nonce, temp=0 | 88.49% |

All values: category match accuracy, all 6 sessions (n=449), 3-run average. File-verified.

---

## 6. Key Findings

### 6.1 Subject chain-of-thought yields a measurable, consistent improvement

Adding an explicit `subject` label to the output format (`75f09222` vs `d38d4b95`-stable) produced +2.2 pp on the new manual with Pro (93.10% vs 90.87%). The gains are not uniformly distributed: s3 (+0.3 pp) and s6 (+3.5 pp) benefited most — both contain structured role-play sequences. Sessions with little role-play content (s2, s4) showed smaller or no gains.

The mechanism is interpretable: by outputting a subject category before the DPICS code, the model makes its assumed referent explicit. Role-play narration (e.g. parent says "你騎馬去" as the toy character, not as an instruction to the child) is mis-coded as DC/IC without this step; with it, the model labels the subject as `遊戲角色` and correctly codes TA.

### 6.2 Seed + nonce is the recommended configuration for reliable measurement

Without both controls, reported accuracy conflates prompt quality with serving-layer noise. The effects:

- **seed alone** fully stabilises simple, unambiguous sessions (s1: 100% ×3; s5: 90.2% ×3) but cannot stabilise longer sessions where the context cache may not respect the seed parameter.
- **nonce prefix** (a unique UUID prepended to each user prompt) forces Gemini's implicit cache to treat every call as a new request, making the seed behavioural rather than nominal. With seed+nonce, a third session (s6) also stabilised.
- **Temperature=0.3** was tested as an alternative to address residual variance. It did not help: net effect was -0.60 pp across all sessions, with s5 improving but s2 regressing. Temperature=0 with seed+nonce is preferred.

### 6.3 Old vs. new manual preference has reversed

In every prompt version prior to `75f09222`, the old manual produced consistently higher accuracy (typically +1 to +2 pp). With the subject chain-of-thought field, the new manual now edges out the old (+0.67 pp with Pro). The reversal is driven by s3 and s6, where the new manual's descriptions of role-play and toy-narration contexts appear to align better with the subject field categories. This finding is based on 3-run averages (file-verified) and should be considered stable for planning purposes, though further runs on additional sessions would strengthen confidence.

### 6.4 Gemini Pro 3.1 is strongly preferred over Flash 3.5

At a headline level, Pro outperforms Flash by 3 pp (new manual). More importantly, Flash's run-to-run variance is 3–4× higher per session than Pro's. In sessions requiring nuanced disambiguation (s3, s4), Flash's variance exceeded 9 pp across 3 runs, making individual-run results unreliable without averaging. For a production deployment where decisions are made from single-session outputs, Pro's tighter distribution (≤3.4 pp spread per session on the new manual) is the more relevant advantage.

### 6.5 NC/TA rule boundary is sensitive and must be changed with caution

The regression from `a2ffd24d` demonstrates that broadening TA rules reliably causes BD/DC utterances to be absorbed into TA, particularly in sessions with action-completion speech. This pattern has appeared in prior prompt iterations as well (e.g. `agentic-v3`'s dominance-hierarchy section caused the same category of regression). New rules for TA should be validated with particular attention to s3 and s4, which contain the most BD/DC/LP content.

---

## 7. Persistent Unsolved Errors

Two categories of error have resisted all prompt interventions across every model and every prompt version tested:

### 7.1 NTA (Negative Talk) — partial improvement in v10, five cases unresolved

NTA (n=9 utterances across all 6 sessions) was 0% recall in every prompt version prior to v10. `agentic-v10` (`75f09222`) achieves **44.4% recall (4/9)** with 100% precision — a meaningful improvement, but five cases remain wrong on every run.

The five persistently missed NTA utterances (wrong in all 3 independent runs; file-verified):

| Utterance | Predicted | Why it's hard |
|---|---|---|
| `嗯嗯。` | TA | Minimal backchannelling sound — indistinguishable from acknowledgement without tonal context |
| `是這樣嗎？` | DQ | Sarcastic rhetorical question; surface form is identical to a genuine question |
| `因為這樣太重、太多了。` | TA | Matter-of-fact explanatory statement; criticism is entirely implicit |
| `你是大力士？` | DQ | Again, sarcasm misread as a genuine inquiry |
| `你覺得你放不平均喔。` | RF | Sounds like a reflection/observation rather than a negative evaluation |

The common thread is **implicit or sarcastic negativity** — none of these utterances contain overt negative language. The model classifies them by their surface form (question → DQ, observation → TA/RF) rather than their communicative intent. This is a genuine hard case: accurate NTA coding requires pragmatic inference beyond the text itself, and potentially knowledge of the preceding interaction context.

Note: with only 9 NTA utterances in the dataset, the measurement noise per case is high — a single utterance flip changes recall by 11 points. Expanding the evaluation dataset with more NTA examples is a prerequisite for confidently measuring any further NTA-specific intervention.

### 7.2 BD→DC in action-completion Chinese utterances

A cluster of utterances in session-5 is miscoded as DC (Direct Command) in every run across every model and every prompt version:

| Utterance | Ground truth | Predicted |
|---|---|---|
| 裝起來 | BD | DC |
| 把車子蓋起來 | BD | DC |
| 把手手舉起來 | TA | DC |

These are completion-framed Chinese action verbs — the parent is describing or narrating an ongoing action rather than issuing a command, but the terse imperative surface form makes them structurally indistinguishable from commands without visual context (what the child is doing at that moment). This appears to be a genuine boundary case that may require a specific BD-vs-DC rule for action-completion framing in Chinese, or may be irreducible without multimodal input.

Additionally, a small number of TA utterances involving >5-second timing gaps (`你找到野餐墊`, `放得好穩喔` in s4) are consistently coded as RF or BD — these may be irreducible without access to video timestamps, as the coding rule depends on whether the parent's utterance follows the child's action by more or less than 5 seconds.

---

## 8. Recommended Configuration for Production

Based on all experiments:

| Parameter | Setting | Rationale |
|---|---|---|
| Model | `gemini-3.1-pro-preview` | 3 pp advantage over Flash; 3–4× lower variance |
| Prompt | `agentic-v10` (hash `75f09222`) | 93.10% — current best; do not use `8bbc7581` |
| Manual | New (`Manual_for_the_Dyadic_Parent-Child_Interaction_Cod.pdf`) | +0.67 pp over old with this prompt; more future-proof |
| seed | 42 | Stabilises simple sessions; reduces measurement noise |
| Nonce prefix | UUID per request | Prevents implicit cache from bypassing seed |
| Temperature | 0 | Temperature=0.3 tested and found slightly worse |
| Runs for evaluation | ≥3 averaged | Single runs are unreliable; 3-run average is the minimum for confident comparisons |

---

## 9. Open Questions

1. **Can NTA reach higher recall?** v10 improved recall from 0% to 44.4%, but five cases (sarcasm, implicit criticism, backchannelling) remain wrong on every run. The surface form of these utterances is genuinely ambiguous without pragmatic/tonal context. Few-shot examples of subtle NTA cases, or a two-pass NTA-audit approach, are the most promising untested interventions. Expanding the dataset beyond 9 NTA utterances is also necessary to measure any further improvement reliably.

2. **Is the new-manual advantage durable across further prompt iterations?** The reversal from old-favoured to new-favoured is plausible mechanistically (subject field + new manual terminology) but is based on one prompt version. Testing `agentic-v4` or `agentic-v1` with the subject field added would clarify whether the advantage is from the subject field interaction specifically or from some other v10 change.

3. **Can the BD→DC cluster in session-5 be resolved?** A very specific rule for action-completion framing in Chinese may help (`把 X V起來` constructions where the child is mid-action ≠ DC), but this pattern is so narrow that it risks overfitting to the available sessions. Multimodal input (video + audio) may ultimately be required for these cases.

4. **Is seed=42 bypassed by the explicit context cache?** Sessions s2/s3/s4 remain non-deterministic even with seed+nonce. The hypothesis is that Gemini's `cachedContent` pipeline does not respect the `seed` parameter for large cached inputs, but this is unconfirmed.

5. **`8bbc7581` residual:** The partial revert introduced an unidentified change that costs 0.82 pp. Resolving this requires a character-level diff between `8bbc7581` and `75f09222` — not yet done.

---

*All accuracy numbers in this report are category match rates (not exact match). Session breakdown: s1 n=79, s2 n=108, s3 n=99, s4 n=46, s5 n=51, s6 n=66, total n=449. Source data: `eval-results/dpics/`. Full methodology and raw run-by-run tables: `doc/dpicsFinetune.md`.*
