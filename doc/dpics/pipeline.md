# DPICS Coding Pipeline

DPICS (Dyadic Parent-Child Interaction Coding System) assigns a behavioral code to every parent utterance in a session transcript and generates per-utterance coaching feedback. This document covers the full pipeline from raw transcript to stored codes.

---

## Pipeline Overview

```
Transcript (ElevenLabs)
        │
        ▼
1. Role Identification  ──────── 3-way vote: Gemini + ML + Claude tiebreaker
        │  roleIdDone checkpoint
        ▼
2. Session Quality Gate ──────── heuristic pre-filters + LLM check; throws SessionQualityError if invalid
        │
        ▼
3. DPICS Coding  ─────────────── Gemini 2.5 Flash (streaming) + context cache
        │  pcitCodingDone checkpoint
        ▼
4. Feedback Generation ──────────  combined-feedback + review-feedback (two LLM calls)
        │
        ▼
5. Child Profiling  ─────────────  developmental (Claude) + CDI coaching (Gemini) — parallel
        │
        ▼
6. Score + Persist  ─────────────  Nora Score, session update, milestone detection
```

Steps 1 and 3 each write a checkpoint to the session row (`roleIdDone`, `pcitCodingDone`). A retry of `analyzePCITCoding` skips any completed step without re-running it.

---

## Step 1 — Role Identification

Three methods run in parallel; the role receiving ≥ 2 votes per speaker wins.

| Method | Source | Notes |
|---|---|---|
| Gemini (streaming) | Transcript text | Primary |
| ML (USC SAIL) | Audio segments | Acoustic model via Lambda |
| Claude Sonnet | Transcript text | Tiebreaker only — called if Gemini and ML disagree |

Result: each speaker (e.g. `speaker_0`, `speaker_1`) is labelled `ADULT` or `CHILD`. Stored in `session.roleIdentificationJson`.

---

## Step 2 — Session Quality Gate

Runs before any expensive LLM steps. First cheap heuristics, then one LLM call.

| Check | Threshold | Error if fails |
|---|---|---|
| Non-silent utterance count | < 10 | Recording too quiet / started late |
| Session duration | < 60 s | Recording too short |
| LLM quality check | model judges content | Returns `valid: false` with `userMessage` |

Throws `SessionQualityError` — callers treat this as permanent (no retry, no alert).

---

## Step 3 — DPICS Coding

The core step. Assigns a code and feedback string to every adult utterance.

### Input

A flat JSON array of all utterances (including child):
```json
[
  { "id": 0, "role": "adult", "text": "Great job putting that piece in!" },
  { "id": 1, "role": "child", "text": "Look!" },
  ...
]
```

The model is told to code only `role === "adult"` entries and skip everything else.

### Model + Cache

Gemini 2.5 Flash via streaming endpoint (`streamGenerateContent?alt=sse`). The DPICS manual PDF and system instruction are pre-loaded into a Gemini context cache (24 h TTL) — see [caching.md](caching.md).

Temperature: `0` (deterministic output required).

### Output

Minified JSON array, adult utterances only:
```json
[
  { "id": 0, "code": "LP2", "feedback": "Nice labeled praise — you named exactly what she did!" },
  { "id": 2, "code": "Q",   "feedback": "Try a narration instead: 'You're stacking the red block.'" }
]
```

Child utterances are omitted from the response.

### Missed Utterances (Supplemental Pass)

The model occasionally stops early and produces a valid closed JSON array that is missing some adult utterances. After parsing, the service checks for missing IDs:

```
adultUtterances - codedIds → missedAdultUtts
```

If any are missed, a second streaming call is made with only the missed utterances. Results are merged into `codingResults`.

### Code → Tag Mapping

Each DPICS code maps to a Nora simplified tag via `DPICS_TO_TAG_MAP` in `scoreConstants.cjs`. Three values are stored per utterance:

| Column | Example | Source |
|---|---|---|
| `pcitTag` | `LP2` | Raw DPICS code |
| `noraTag` | `praise` | Simplified tag for score/display |
| `feedback` | `"Nice labeled praise..."` | LLM-generated coaching string |

---

## DPICS Codes

### Desirable (PRIDE skills — CDI)

| Code | Name | Description |
|---|---|---|
| `LP1` | Labeled Praise — Product | Praises the finished object or toy ("Great tower!") |
| `LP2` | Labeled Praise — Action | Praises a specific child action ("I love how you stacked those!") |
| `LP3` | Labeled Praise — Effort | Praises persistence or effort ("You kept trying even when it was hard!") |
| `LP4` | Labeled Praise — Regulatory | Praises emotional regulation or self-control ("Great job using gentle hands!") |
| `BD` | Behavioral Description | Narrates what the child is doing ("You're putting the blue block on top") |
| `RF` | Reflection | Repeats or paraphrases the child's exact words |
| `RQ` | Reflective Question | Mirrors child's utterance as a question (counts as echo) |

**LP sub-classification rule:** if uncertain between LP levels, prefer the lower level (LP1 over LP2, etc.). If uncertain between LP and UP, code UP.

**BD vs LP overlap rule:** if a behavioral description includes a positive evaluation of the action or effort (e.g. "You're wrapping the gift so carefully"), code LP2 or LP3 instead of BD.

### Undesirable (CDI avoids)

| Code | Name | Description |
|---|---|---|
| `UP` | Unlabeled Praise | Praise without a specific label ("Good job!", "Wow!") |
| `Q` | Question | Any question directed at the child |
| `DC` | Direct Command | Explicit directive ("Put the block down") |
| `IC` | Indirect Command | Implied directive ("Can you put the block down?") |
| `NTA` | Negative Talk / Criticism | Critical, sarcastic, or negative statement |

**PDI mode flip:** in PDI sessions, `DC` is the target skill (reinforce it). `IC` remains undesirable — coach toward `DC`.

### Neutral

| Code | Name | Notes |
|---|---|---|
| `AK` | Acknowledgement | "Mm-hmm", "OK", short confirmations — no feedback generated |
| `ID` | Irrelevant Discourse | Off-topic adult speech — no feedback generated |
| `TC` | Tangential Command | Command unrelated to child's play — no feedback generated |

---

## Step 4 — Feedback Generation

Two LLM calls run after coding is complete.

### Call 1: Combined Feedback

Generates session-level elements from the full tagged transcript:

| Field | Description |
|---|---|
| `topMoment` | Best moment of connection/joy in the session (quote + utterance index) |
| `Feedback` | 1–2 sentence opening message for the session report |
| `ChildReaction` | 2–3 sentence observation about the child's behaviour |
| `reminder` | 2 sentences of encouragement |
| `activity` | A few words describing the play activity (e.g. "building blocks") |

### Call 2: Review Feedback

Reviews all utterances and proposes revised per-utterance feedback where the original (from DPICS coding) would benefit from context. Also selects up to 3 silence slots for coaching tips. Returns an array of `{id, feedback, additional_tip}`.

In PDI mode, this call also receives the PDI Two Choices Flow analysis output, so it can coach the parent on command sequences (wait time, compliance, follow-through).

---

## Tag Counts

After coding, tag counts are tallied and stored in `session.tagCounts`:

| Key | Codes counted |
|---|---|
| `echo` | RF, RQ |
| `labeled_praise` | LP, LP1–LP4 |
| `unlabeled_praise` | UP |
| `praise` | all LP variants (sum) |
| `product_praise` | LP1 |
| `action_praise` | LP2 |
| `growth_praise` | LP3 |
| `regulatory_praise` | LP4 |
| `narration` | BD |
| `direct_command` | DC |
| `indirect_command` | IC |
| `command` | DC + IC |
| `question` | Q |
| `criticism` | NTA |
| `neutral` | AK, ID |

These counts drive the Nora Score, CDI coaching goals, mastery tracking, and all downstream profiling steps.

---

## Checkpoints

The session row tracks two boolean checkpoints to allow safe retries without re-running expensive steps:

| Field | Set after | Skipped if |
|---|---|---|
| `roleIdDone` | Role identification completes | `session.roleIdDone === true` |
| `pcitCodingDone` | Coding + tag update completes | `session.pcitCodingDone === true` |

A full re-run from scratch requires resetting both to `false` (see `_tmp_rerun_analysis.cjs`).

---

## Bilingual Support

The session language is detected from `session.elevenLabsJson.language_code`. For non-English sessions:

- DPICS codes in the LLM response stay in English (e.g. `LP2`, `BD`)
- The `feedback` string is written in the detected language
- Silence slot feedback (hardcoded English) is cleared before the review-feedback call, so localized coaching can be written there instead
- Traditional Chinese (`zh-TW`) is honoured over the generic Mandarin code (`zho`/`cmn`) when the user's `preferredLocale` is `zh-TW`

---

## Key Files

| File | Role |
|---|---|
| `server/prompts/dpicsCoding.txt` | System instruction: LP sub-classification rules + feedback strategy |
| `server/assets/DPICS-Manual.2.18.pdf` | Authoritative DPICS manual — uploaded to Gemini context cache |
| `server/llm/providers/geminiCache.cjs` | Cache manager: file upload, cache creation, in-memory registry |
| `server/utils/scoreConstants.cjs` | `DPICS_TO_TAG_MAP`, `calculateNoraScore` |
| `server/utils/utteranceUtils.cjs` | `getUtterances`, `updateUtteranceTags`, `updateRevisedFeedback` |
| `server/services/pcitAnalysisService.cjs` | Orchestrator: `analyzePCITCoding` |
