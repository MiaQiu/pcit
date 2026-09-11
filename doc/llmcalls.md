# LLM calls in `server/services/pcitAnalysisService.cjs`

Inventory of every `llmCall(...)` site in the PCIT analysis pipeline: what it is,
the order `analyzePCITCoding()` drives them in, the prompt + its DB-sourced
inputs, the output shape, where the output is persisted, and whether that
persisted data reaches the mobile report — either the compact celebration screen
`nora-mobile/src/screens/ReportScreen_v3.tsx` or the full report
`nora-mobile/src/screens/ReportDetailScreen.tsx` (plus their navigation
sub-screens).

_Last reviewed: 2026-09-08 (branch `parent-skill-ladder-9-levels`)._

---

## Summary table

| # | Line | profile / label | Function | Purpose | Gemini schema |
|---|------|-----------------|----------|---------|---------------|
| 1 | 1454 | `role-identification` / `role-id-gemini` | `identifyRolesWithVoting` | Transcript-based speaker→role guess | none (JSON free-text) |
| 2 | 1514 | `role-id-tiebreaker` / `role-id-claude` | `identifyRolesWithVoting` | Claude tiebreak, **only on Gemini↔ML disagreement** | none |
| 3 | 89 | `quality-check` / `session-quality-check` | `validateSessionQuality` | Is the recording analyzable? | none |
| 4 | 1851 | `pcit-coding` / `pcit-coding` | `analyzePCITCoding` | DPICS-code every adult utterance | `PCIT_CODING` |
| 5 | 1881 | `pcit-coding-supplemental` | `analyzePCITCoding` | Re-code utterances the first pass skipped | `PCIT_CODING` |
| 6 | 512 | `dev-profiling` / `dev-profiling` | `generateDevelopmentalProfiling` | 5-domain developmental profile + milestone keys | `DEV_PROFILING` |
| 7 | 640 | `about-child` / `about-child` | `generateAboutChild` | 10 age-referenced "About Child" cards (single pass) | `ABOUT_CHILD` |
| 8 | — | _(removed — merged into #7)_ | — | was the 2nd of a 2-call flow | — |
| 9 | 718 | `coaching-narrative` / `coaching-narrative` | `generateCdiCoaching` | CDI coaching report (prose) | none |
| 10 | 747 | `coaching-format` / `coaching-format` | `generateCdiCoaching` | Split coaching prose into mobile sections | `COACHING_FORMAT` |
| 11 | 754 | `coaching-format` / `coaching-format-escalated` | `generateCdiCoaching` | Escalate #10 to `gemini-3.1-pro-preview` | `COACHING_FORMAT` |
| 12 | 1398 | `pdi-two-choices` / `pdi-two-choices` | `generatePDITwoChoicesAnalysis` | PDI discipline (Two-Choices-Flow) analysis | `PDI_TWO_CHOICES` |
| 13 | 944 | `combined-feedback` / `combined-feedback` | `generateCDIFeedback` | Top moment, opening feedback, reminder, child reaction, activity | `COMBINED_FEEDBACK` |
| 14 | 967 | `review-feedback` / `review-feedback` | `generateCDIFeedback` | Per-utterance revised coaching feedback | `REVIEW_FEEDBACK` |
| 15 | 1203 | `crisis-coaching` / `crisis-coaching` | `generateCrisis` | Hero text, crisis coaching, skill coaching, bonding moment | `CRISIS_COACHING` |
| 16 | 1340 | `skill-improve` / `skill-improve` | `generateSkillImprove` | Session-grounded opportunities for the target skill | `SKILL_IMPROVE` |
| 17 | 1093 | `report-highlights` / `report-highlights` | `generateReportHighlights` | Hero/celebration/tip/crisis — **dead code**, not called | `REPORT_HIGHLIGHTS` |

**Execution order** (`analyzePCITCoding`):

```
STEP 1  role-id: #1 gemini ∥ classifySpeakersML(ML) → #2 claude [if disagree]
GATE    #3 quality-check                          [heuristics first; throws → analysisStatus=FAILED]
STEP 2  #4 pcit-coding → #5 supplemental [if gaps]   → Nora score
STEP 9  Promise.allSettled:
          ├─ #6 dev-profiling
          ├─ generateCdiCoaching (CDI only): #9 → #10 (×1-2) → #11 [if still bad]
          └─ generateAboutChild: #7 (single pass)
COMPETENCY
          ├─ #12 pdi-two-choices                  [PDI only, before feedback]
          └─ generateCDIFeedback:
               #13 combined-feedback  then Promise.all[ #14 review-feedback, #15 crisis, #16 skill-improve ]
(post-LLM: milestone detection & about-child selection call their own services)
```

Shared input note: `utterances` throughout = rows from the **`Utterance`** table
via `getUtterances(sessionId)` (`speaker, text, startTime, endTime, role,
pcitTag, noraTag, feedback, order`). `SILENT_SPEAKER_ID` rows are synthetic
"silence slot" markers. `LANGUAGE_INSTRUCTION` / trailing language line comes from
`getLanguageInstruction(primaryLanguage)` where `primaryLanguage` is derived from
`Session.elevenLabsJson.language_code` (+ `preferredLanguage` arg for zh-TW/zh-CN).

---

## 1. `role-identification` — Gemini speaker→role vote

- **Function / step:** `identifyRolesWithVoting()`, STEP 1. Runs in parallel with the acoustic ML Lambda `classifySpeakersML(storagePath, …)` (not an LLM); a Claude call (#2) only fires if the two disagree.
- **Prompt:** `server/prompts/roleIdentification.txt`. Variables:
  - `UTTERANCES_JSON` — `utterancesForPrompt` = every `Utterance` row mapped to `{speaker, text, start, end}`.
- **Output:** JSON `{ speaker_identification: { <speakerId>: { role: "CHILD"|"ADULT", confidence, reasoning } }, analysis_summary }`.
- **Stored in:**
  - `Session.roleIdentificationJson` (merged/voted object with `_vote_sources`, `_vote_detail`), `Session.roleIdDone = true`.
  - `Utterance.role` (`'adult'`/`'child'`) via `updateUtteranceRoles()`.
- **Shown in report?** Not directly. `Utterance.role` drives everything downstream (which utterances get coded, transcript speaker labels in the **Transcript** / **SkillUtterances** sub-screens of ReportDetailScreen). The confidence/reasoning JSON is internal only.

## 2. `role-id-tiebreaker` — Claude disagreement resolver

- **Function / step:** `identifyRolesWithVoting()`, Phase 2 — **conditional** (only when Gemini's and the ML model's per-speaker roles differ).
- **Prompt:** same `roleIdentification.txt` / same `UTTERANCES_JSON`.
- **Output:** same shape as #1; contributes a third vote to the per-speaker majority.
- **Stored in:** folded into `Session.roleIdentificationJson` + `Utterance.role` (as #1).
- **Shown in report?** Same as #1 — indirectly, via `Utterance.role`.

## 3. `quality-check` — session validity gate

- **Function / step:** `validateSessionQuality()`, after STEP 1. Cheap heuristics run first (≥10 non-silent utterances, ≥60 s); this LLM call is the semantic gate.
- **Prompt:** `server/prompts/sessionQualityCheck.txt`. Variables:
  - `DURATION_SECONDS` — `Session.durationSeconds`.
  - `UTTERANCE_COUNT` — count of non-silent `Utterance` rows.
  - `SPEAKER_COUNT` — distinct non-silent speakers.
  - `UTTERANCES_SAMPLE` — first 60 non-silent utterances `{speaker,text,start,end}`.
  - `ROLE_IDENTIFICATION` — `Session.roleIdentificationJson` from #1/#2.
- **Output:** `{ valid: true }` or `{ valid: false, userMessage }`.
- **Stored in:** **Not persisted as data.** On `valid:false` it throws `SessionQualityError(userMessage)`; the recordings pipeline catches that and writes `Session.analysisStatus = 'FAILED'` + `Session.analysisError = userMessage` (+ `analysisFailedAt`).
- **Shown in report?** Only the failure path: `ReportScreen_v3` / `ReportDetailScreen` both fetch `GET /recordings/:id/analysis`, which returns `status:'failed'` + `message` (the `userMessage`); the screens render that as the error state ("Try again"). A passing check produces no visible output.

## 4. `pcit-coding` — DPICS coding of adult utterances

- **Function / step:** `analyzePCITCoding()` STEP 2 (STEP-7/8 logs). Model knob: `$GEMINI_STREAMING_MODEL` override, else profile default. Skipped entirely if `Session.pcitCodingDone` (checkpoint replay).
- **Prompt:**
  - **System / cached context:** `loadPrompt('dpicsCoding-agentic-v10-4')` (the full DPICS coding manual/rubric, in Traditional Chinese) + a PDI feedback-override paragraph appended when `session.mode === 'PDI'`. Plus the DPICS PDF (`assets/DPICS-Manual.2.18.pdf`) — both go through the gateway prompt cache keyed `dpics-cdi-<streaming-model>` / `dpics-pdi-<streaming-model>` (via `dpicsCacheKey()`; model-qualified so a stale registry entry at another model can't break `review-feedback` #14 when coding is checkpoint-skipped).
  - **User prompt (inline):** instruction to "Code every utterance where role is 'adult'" + `JSON.stringify(utterancesData)` where `utterancesData` = updated `Utterance` rows mapped to `{id: idx, role, text}`.
- **Output:** JSON array `[{id:<int>, code:<enum>}]` (schema enum: `LP UP BD RF RQ Q DC IC NTA AK ID TC`; runtime also tolerates `LP1-4`, `DQ`, `IQ`, `NC`, `Uncoded`).
- **Stored in:**
  - `Session.pcitCoding` (JSON: `{adultSpeakers, codingResults, fullResponse, analyzedAt}`), `Session.pcitCodingDone = true`.
  - `Session.tagCounts` (JSON: `echo, labeled_praise, unlabeled_praise, praise, product/action/growth/regulatory_praise, narration, direct_command, indirect_command, command, question, criticism, neutral`).
  - Per utterance: `Utterance.pcitTag` (DPICS code) + `Utterance.noraTag` (display name via `DPICS_TO_TAG_MAP`) via `updateUtteranceTags()`.
  - `Session.overallScore` — derived from `tagCounts` by `calculateNoraScore()` (deterministic, not the LLM).
- **Shown in report?** **Yes, heavily (both screens).**
  - `tagCounts` → API `stats` / `skills` / `areasToAvoid`.
  - **ReportScreen_v3:** the emotional-deposit number (`noraScore`), and today's-goal progress counts read from `stats`.
  - **ReportDetailScreen:** "Today's Interaction Style" card (Confidence Builders vs Play Interruptions bars, from `skills`/`areasToAvoid`), the per-skill "Detailed Breakdown", and tapping a skill → **SkillUtterances** sub-screen filtered by `Utterance.noraTag`. `Utterance.pcitTag`/`noraTag` also drive the **Transcript** sub-screen chips.

## 5. `pcit-coding-supplemental` — gap-fill coding

- **Function / step:** `analyzePCITCoding()` STEP-8, **conditional** — only when adult `Utterance` rows have no code after #4. Non-blocking (failure logged, ignored).
- **Prompt:** inline — "These adult utterances were missed…" + `JSON.stringify(missedAdultUtts)` (the uncoded `{id,role,text}` subset). Same DPICS cache as #4.
- **Output:** same `[{id,code}]` array; concatenated onto `codingResults`.
- **Stored in:** same fields as #4 (merged before the `Session.pcitCoding` / `tagCounts` / `Utterance` writes).
- **Shown in report?** Same as #4 — its codes are indistinguishable from the main pass downstream.

## 6. `dev-profiling` — developmental profile

- **Function / step:** `generateDevelopmentalProfiling()`, STEP 9 (parallel branch). Best-effort (returns `null` on failure).
- **Prompt:** `server/prompts/developmentalProfiling.txt`. Variables via `buildProfilingVariables()`:
  - `CHILD_NAME` — `User.childName` (decrypted).
  - `CHILD_AGE_MONTHS` — computed from `User.childBirthday` / `User.childBirthYear`.
  - `CHILD_GENDER` — `User.childGender`.
  - `SESSION_METRICS` — formatted from `Session.tagCounts` (#4).
  - `TRANSCRIPT` — non-silent `Utterance` rows as `Parent:/Child:` lines.
  - `ACHIEVED_MILESTONE_KEYS` — keys of `ChildMilestone` rows with `status='ACHIEVED'` (joined to `MilestoneLibrary.key`).
  - `IS_FIRST_SESSION_BASELINE` — from `prisma.session.count({userId, analysisStatus:'COMPLETED'}) === 0`.
  - `LANGUAGE_INSTRUCTION`.
  - _(destructured but never set on the live `childInfoForProfiling` object → always empty:_ `HISTORICAL_METRICS_SECTION`, `YESTERDAY_GOAL_SECTION`_.)_
- **Output:** `DEV_PROFILING` — `{ session_metadata, developmental_observation: {summary, domains[5]{category, framework, developmental_status, current_level, benchmark_for_age, detailed_observations[], detected_milestone_keys[]}}, baseline_achieved[] }`.
- **Stored in:**
  - `ChildProfiling` row (`upsert` on `sessionId`): `summary`, `domains` (JSON), `metadata` (JSON), `childId`, `userId`.
  - `detected_milestone_keys` (flattened) + `baseline_achieved` → passed to `milestoneDetectionService.detectAndUpdateMilestones()` (STEP 10) → writes `ChildMilestone` rows and, on new achievements, `Session.milestoneCelebrations` (JSON).
  - Not stored on `Session` directly otherwise.
- **Shown in report?** **Partially / indirectly.**
  - **ReportDetailScreen** "Developmental Milestones" card renders a `RadarChart` — but from a **separate aggregate endpoint** `recordingService.getDevelopmentalProgress()` (cross-session `DevelopmentalProgress`), and only once `completedSessionCount >= 5`; before that it shows a locked badge. This session's `ChildProfiling` feeds that aggregate but its `summary`/`domains` text is **not** rendered verbatim here. Per-domain detail (`domainProfiling`) loads on tap via `getDomainMilestones(domain)` into `DomainMilestoneModal`.
  - `Session.milestoneCelebrations` is **not** shown in either target screen (it surfaces in `HomeScreen_v2` / old `ReportScreen`).
  - **ReportScreen_v3:** not shown.
  - The full `developmental_observation` prose is shown on `ProfileReportScreen` (out of scope here).

## 7. `about-child` — "About Child" observation cards (single pass)

- **Function / step:** `generateAboutChild()`, STEP 9 (parallel branch). `alertOnFailure:false` — best-effort.
- **Prompt:** `server/prompts/aboutChild.txt`. Variables:
  - `CHILD_NAME` — `User.childName` (decrypted); `AGE_MONTHS` — from `User.childBirthday/BirthYear`; `GENDER` — `User.childGender`.
  - `TRANSCRIPT` — non-silent `Utterance` rows as `Parent:/Child:` lines.
  - + language line appended.
  - (No `tagCounts` — the metrics are not fed to this prompt any more.)
- **Persona:** child-development psychology + TPBA / KOI / Renzulli. Asks for **10** observations, each judged `advanced` / `age_appropriate` / `needs_help` for the child's age, ranked by value to the parent (id 1 = biggest "aha"). Output is deliberately jargon-free.
- **Output:** `ABOUT_CHILD` — JSON array of `{ id, label: "advanced"|"age_appropriate"|"needs_help", Title, Description, Details, tags[] }`. `generateAboutChild` then adds a derived `valence` (`needs_help`→`GROWTH_AREA`, else `STRENGTH`) to every item for back-compat.
- **Stored in:** `Session.aboutChild` (JSON array).
  - STEP 11 then runs `aboutChildSelectionService.selectAboutChildCard(childId, sessionId, aboutChild)` (honours a 5:1 strength/growth ratio + recency, keyed on the derived `valence`) → `Session.selectedAboutChild` (JSON, one item).
- **Shown in report?** **Yes — ReportDetailScreen only.** "What we learned about {childName}" card: `aboutChildItem = reportData.selectedAboutChild || reportData.aboutChild?.[0]`; renders `Title` (badge), body = `Details || Description` (falls back to `competencyAnalysis.childReaction` from #13), and `tags[]` as chips. Not shown in ReportScreen_v3.

## 8. _(removed)_

Merged into #7 — "About Child" is now a single LLM call, not a prose-then-extract pair.

## 9. `coaching-narrative` — CDI coaching report (prose)

- **Function / step:** `generateCdiCoaching()` step 2 (CDI sessions only), STEP 9 branch. Step 1 is the **deterministic** goal engine (`generateGoalForLevel(currentLevel, tagCounts, 'CDI', progress)` — no LLM), which produces `goalDirective` / `tomorrowGoal` / `notifications`.
- **Prompt:** `server/prompts/cdiCoaching.txt`. Variables via `buildProfilingVariables()` (same DB sources as #6: `CHILD_NAME`, `CHILD_AGE_MONTHS`, `CHILD_GENDER`, `SESSION_METRICS` from `tagCounts`, `SESSION_DURATION` from `Session.durationSeconds`, `TRANSCRIPT`, `PRIMARY_ISSUE`/`OTHER_ISSUES` from `Child.primaryIssue` + `ChildIssuePriority` rows, `FIRST_SESSION_NOTE` from the completed-session count) plus:
  - `TOMORROW_GOAL` — the deterministic headline from step 1 (injected so the narrative's closing matches the decided goal).
  - `LANGUAGE_INSTRUCTION`.
- **Output:** free-form coaching report prose (<500 words + optional first-session foundation block). Raw string.
- **Stored in:** `Session.coachingSummary` (String).
- **Shown in report?** **Not in either target screen.** `coachingSummary` renders in the old `ReportScreen.tsx` and `ProfileReportScreen.tsx`. In ReportDetailScreen it is only an *input* to #15 (`generateCrisis` reads `coachingNarrativeText = childProfilingResult.coachingSummary`). ReportScreen_v3 uses only the deterministic `goalDirective`.

## 10. `coaching-format` — split coaching prose into cards

- **Function / step:** `generateCdiCoaching()` step 3, via `withQualityRetry` → runs **1–2×**; `checkComplete` requires ≥3 sections covering ≥60 % of the narrative length.
- **Prompt:** `server/prompts/cdiCoachingFormat.txt`. Variables:
  - `COACHING_REPORT` — the #9 prose.
  - `LANGUAGE_INSTRUCTION`, `CHILD_GENDER` (`User.childGender`).
- **Output:** `COACHING_FORMAT` — `{ sections: [{title, content}], tomorrowGoal? }`. (The `tomorrowGoal` echo is **ignored** — the deterministic value wins.)
- **Stored in:** `Session.coachingCards` (JSON: `{ sections, tomorrowGoal, notifications, goalDirective }` — sections from this call; the other three from the deterministic step 1). On total failure, `Session.coachingSummary` is kept and `coachingCards.sections` is `null`.
- **Shown in report?**
  - `sections` — **not in either target screen** (rendered in old `ReportScreen.tsx` / `ProfileReportScreen.tsx`).
  - `coachingCards.goalDirective` **is** surfaced by the API as `tomorrowGoalDirective` / `pdiTomorrowGoalDirective` and used by **both** ReportScreen_v3 (Today's Goal card: focus skill, current vs target number, achieved/regressed state) and ReportDetailScreen ("Tomorrow's Goal" card + the Skill Coaching card's skill badge).

## 11. `coaching-format-escalated` — Gemini-Pro fallback for #10

- **Function / step:** `withQualityRetry` escalation inside `generateCdiCoaching()` step 3 — **conditional**, only if both #10 attempts fail `checkComplete`. Forced `model: 'gemini-3.1-pro-preview'` (keeps the responseSchema, which Claude can't honour). `alertOnFailure:false`.
- **Prompt / output / storage / display:** identical to #10.

## 12. `pdi-two-choices` — PDI discipline analysis

- **Function / step:** `generatePDITwoChoicesAnalysis()`, in the competency phase **before** `generateCDIFeedback` (so its output can feed #14). PDI sessions only. Best-effort (`null` on failure).
- **Prompt:** `server/prompts/pdiTwoChoicesFlow.txt`. Variables:
  - `CHILD_NAME` — `User.childName`.
  - `TRANSCRIPT` — non-silent `Utterance` rows as `<speaker>: <text>` (raw speaker id, not role label).
  - `LANGUAGE_INSTRUCTION`.
- **Output:** `PDI_TWO_CHOICES` — `{ summary, encouragement, commandSequences[]{title,label,whatHappened,command,waitTime,followThrough,coachTip?}, pdiSkills[5]{skill,performance,feedback}, tomorrowGoal }`.
- **Stored in:** `Session.competencyAnalysis` (JSON), keys: `pdiSkills`, `pdiCommandSequences`, `pdiEncouragement`, `pdiSummary`. (`tomorrowGoal` from the LLM is **discarded** — `pdiTomorrowGoal` / `pdiTomorrowGoalDirective` are recomputed deterministically via `generateGoalForLevel(..., 'PDI', ...)`.) Also feeds #14's prompt in-memory (`pdiResult`).
- **Shown in report?**
  - `pdiSkills` / `pdiCommandSequences` — **not in either target screen** (rendered in old `ReportScreen.tsx`).
  - `pdiSummary` — used only as an *input* to #15/#13 (`coachingNarrativeText` fallback) for PDI.
  - `pdiTomorrowGoalDirective` (deterministic) — used by both screens' goal cards.

## 13. `combined-feedback` — session opening report

- **Function / step:** `generateCDIFeedback()` Call 1 (sequential, runs before the parallel #14/#15/#16). Both CDI and PDI.
- **Prompt:** `generateCombinedFeedbackPrompt()` (inline). Inputs:
  - `childName` — `User.childName`.
  - `counts` — `Session.tagCounts` (#4), incl. `negative_phrases`.
  - transcript — `formatUtterancesForPrompt(utterances)`: numbered `[NN] Parent/Child: text [TAG]` lines (tags from `Utterance.pcitTag`), silence slots shown as `⏸️ SILENCE`.
  - language line appended.
- **Output:** `COMBINED_FEEDBACK` — `{ topMoment:{startUtteranceNumber,endUtteranceNumber}, Feedback (2-sentence opening), exampleUtteranceNumber, reminder (2 sentences), ChildReaction, activity }`. The top-moment **quote is rebuilt from the `Utterance` array** by `quoteFromUtteranceRange()`, not trusted as typed text.
- **Stored in:** `Session.competencyAnalysis` JSON:
  - `topMoment` (reconstructed quote string), `topMomentUtteranceNumber`
  - `feedback` (= `Feedback`), `example` (= `exampleUtteranceNumber`), `childReaction`, `reminder`, `activity`.
- **Shown in report?**
  - `topMoment` + `topMomentUtteranceNumber` (+ server-added `topMomentStartTime/EndTime`) — **ReportDetailScreen** "Top Moment" card + `MomentPlayer` audio clip (when `bondingMoment` from #15 is absent, this is the fallback).
  - `childReaction` — **ReportDetailScreen** fallback body for the "What we learned about {child}" card (after #8's `Details`/`Description`).
  - `reminder`, `feedback`, `activity`, `example` — **not shown in either target screen** (`reminder`/`activity` render in old `ReportScreen.tsx` / `HomeScreen_v2`).
  - ReportScreen_v3: none of these.

## 14. `review-feedback` — per-utterance revised coaching

- **Function / step:** `generateCDIFeedback()` Call 2, in `Promise.all` with #15/#16. Try/catch → `[]` on failure.
- **Prompt:** `generateReviewFeedbackPrompt()` (inline). Inputs:
  - `counts` — `Session.tagCounts`; metrics section differs CDI vs PDI.
  - transcript — `formatUtterancesForReview(utterances)`: `[NN] Parent/Child: "text" [TAG]` (tags from `Utterance.pcitTag`).
  - `pdiResult` (#12 output) injected for PDI as a "Two Choices Flow Analysis" block.
  - **System / cache:** `loadPrompt('dpicsCoding-agentic-v10-4')` (+ PDI override) + DPICS PDF, cache key `dpicsCacheKey(isCDI)` = `dpics-{cdi,pdi}-<streaming-model>` — must run on `$GEMINI_STREAMING_MODEL` to match that cache's model.
  - language line appended.
- **Output:** `REVIEW_FEEDBACK` — JSON array `[{ id, feedback, additional_tip? }]` (parent utterances with a DPICS tag + ≤3 silence slots; neutral codes → null/skipped).
- **Stored in:** per-utterance via `updateRevisedFeedback()`:
  - `Utterance.revisedFeedback` (= `feedback`)
  - `Utterance.additionalTip` (= `additional_tip`)
  - (also returned as `feedbackResult.revisedFeedback` but `competencyAnalysis` does not keep the array separately.)
- **Shown in report?** **Yes, indirectly — via ReportDetailScreen's sub-screens.** The API's `transcript` segments include `feedback`, `revisedFeedback`, `additionalTip`. `components/TranscriptPanel.tsx` (used by the **Transcript** screen and embedded in **SkillUtterances**) shows `displayFeedback = revisedFeedback || feedback` under each tagged adult utterance, plus `additionalTip` for desirable skills, plus the silence-slot `feedback` tips. Reached from ReportDetailScreen via "Full Transcript" and by tapping a skill. Not in ReportScreen_v3.

## 15. `crisis-coaching` — hero text + crisis/skill coaching + bonding moment

- **Function / step:** `generateCrisis()`, in `Promise.all` with #14/#16. Guarded: returns `null` if no coaching narrative or no utterances. Gemini.
- **Prompt:** `generateCrisisPrompt()` (inline). Inputs:
  - transcript — `formatUtterancesForPrompt(utterances)` (numbered, with tags + silence slots).
  - `coachingText` — `childProfilingResult.coachingSummary` (#9) for CDI, else `pdiResult.summary` (#12).
  - `childName` — `User.childName`.
  - `goalDirective` — the deterministic directive from #9's step 1 (`focusSkill`, `currentNumber` = this session's count for that skill, `actionPrompt`).
  - language line appended.
- **Output:** `CRISIS_COACHING` — `{ heroText, crisisMoment:{detected,title,coaching}, skillCoaching, topMoment:{startUtteranceNumber,endUtteranceNumber,context} }`. The bonding-exchange quote is rebuilt from the `Utterance` array (`quoteFromUtteranceRange`), kept as `{quote, utteranceNumber, endUtteranceNumber, context}`.
- **Stored in:** `Session.competencyAnalysis` JSON:
  - `heroText`, `crisisMoment` (`{detected,title,coaching}`), `skillCoaching`, `bondingMoment` (= reconstructed `topMoment`).
  - (Note `heroText` here overwrites the assembled result's field; `competencyAnalysis.heroText` = this call's.)
- **Shown in report?** **Yes — ReportDetailScreen (primary consumer).**
  - `heroText` → the hero card headline (fallback: generic i18n string).
  - `crisisMoment` (only when `detected`) → "Crisis Moment" `ReportCard` (title + `coaching` markdown, expandable).
  - `skillCoaching` → "Skill Coaching" `ReportCard` (markdown, expandable, with the goal-skill badge).
  - `bondingMoment` → "Top Moment" card (preferred over #13's `topMoment`): quote lines, `context` as the card tip, and `MomentPlayer` audio range from the matched `Utterance` start/end.
  - **ReportScreen_v3:** none (it does not read `heroText`).

## 16. `skill-improve` — session-grounded opportunities for the target skill

- **Function / step:** `generateSkillImprove()`, in `Promise.all` with #14/#15. Returns `null` when there is no `goalDirective`.
- **Prompt:** `generateSkillImprovePrompt()` (inline). Inputs:
  - transcript — `formatUtterancesForPrompt(utterances)`.
  - `goalDirective.focusSkill` + `goalDirective.goalType` (from #9 step 1) → selects a `GOAL_TYPE_IMPROVE_GUIDANCE` blurb + BUILD/AVOID direction.
  - `childName` — `User.childName`.
  - language line appended.
- **Output:** `SKILL_IMPROVE` — `{ direction, summary, opportunities:[{title, explanation, startUtteranceNumber?, endUtteranceNumber?, suggestedRewrite?}] }`. Each opportunity's `quote` is rebuilt from the `Utterance` array.
- **Stored in:** `Session.competencyAnalysis.skillImprove` = `{ skillLabel, direction, summary, opportunities:[{title, explanation, quote, suggestedRewrite}] }`.
- **Shown in report?** **Yes — ReportDetailScreen → SkillImprove sub-screen.** Inside the "Skill Coaching" card, an "Insights" badge (shown when `reportData.skillImprove` is present) navigates to `SkillImproveScreen`, which renders `summary` and each opportunity's `title` / `explanation` / `quote` block / `suggestedRewrite` ("Try instead"). Not in ReportScreen_v3.

## 17. `report-highlights` — **dead code**

- **Function:** `generateReportHighlights()` — defined, exported, and has a schema (`REPORT_HIGHLIGHTS`) + prompt (`generateReportHighlightsPrompt`), but **`analyzePCITCoding` never calls it.** Superseded by `generateCrisis` (#15), which merged hero text + crisis + skill coaching + bonding moment into one call.
- **Would have produced:** `{ heroText, topMomentCelebration, interactionTip, crisisMoment:{detected,title,description,whatHelped[]} }`.
- **Stored in / shown:** nothing. The recordings API still *reads* `session.competencyAnalysis?.topMomentCelebration` / `?.interactionTip` for backward compat, and ReportDetailScreen still has fallback wiring for `topMomentCelebration` (as the Top Moment card tip, after `bondingMoment.context`) — but for current sessions those keys are never written, so the code paths are effectively inert.

---

## What each target screen actually renders

### `ReportScreen_v3.tsx` (compact post-session celebration)
Reads only: `noraScore` (← `Session.overallScore` ← #4), `stats` (← `Session.tagCounts` ← #4/#5), `durationSeconds`, `mode`, `tomorrowGoalDirective` / `pdiTomorrowGoalDirective` (← deterministic goal engine, stored in `Session.coachingCards.goalDirective` / recomputed). Parent level + streak come from separate endpoints. **No LLM prose is shown here.**

### `ReportDetailScreen.tsx` (full "Today's Coaching" report)
| Card / element | Source LLM call | DB field |
|---|---|---|
| Hero headline | #15 `crisis-coaching` | `competencyAnalysis.heroText` |
| Crisis Moment card (conditional) | #15 | `competencyAnalysis.crisisMoment` |
| Top Moment card + audio | #15 `bondingMoment` (pref.) / #13 `topMoment` | `competencyAnalysis.bondingMoment` / `.topMoment` / `.topMomentUtteranceNumber` |
| Top Moment card "tip" | #15 `bondingMoment.context` / (#17 `topMomentCelebration`, inert) | `competencyAnalysis.topMomentCelebration` |
| Today's Interaction Style (bars + breakdown) | #4/#5 | `Session.tagCounts` |
| Skill Coaching card | #15 | `competencyAnalysis.skillCoaching` |
| Skill Coaching → "Insights" badge → SkillImprove screen | #16 | `competencyAnalysis.skillImprove` |
| "What we learned about {child}" card | #8 (pref.) → #13 fallback | `Session.selectedAboutChild` / `Session.aboutChild` / `competencyAnalysis.childReaction` |
| Developmental Milestones card (RadarChart, ≥5 sessions) | #6 (via cross-session aggregate) | `ChildProfiling` → `DevelopmentalProgress` endpoint |
| Domain detail modal (on tap) | #6 (per-domain) | `getDomainMilestones` endpoint |
| Tomorrow's Goal card / skill badge | deterministic goal engine (not LLM) | `Session.coachingCards.goalDirective` |
| Full Transcript → per-utterance feedback / tips | #14 (+ #4 tags, silence slots) | `Utterance.revisedFeedback` / `.additionalTip` / `.feedback` / `.pcitTag` / `.noraTag` |
| SkillUtterances (tap a skill) | #4 tags + #14 feedback | `Utterance.noraTag` / `.revisedFeedback` |

**Persisted LLM output NOT shown in either target screen:** #7 (never stored), #9 `coachingSummary` & #10/#11 `coachingCards.sections` (old `ReportScreen` / `ProfileReport`), #13 `reminder` / `feedback` / `activity`, #12 `pdiSkills` / `pdiCommandSequences` / `pdiEncouragement` (old `ReportScreen`), `Session.milestoneCelebrations` (`HomeScreen_v2` / old `ReportScreen`), #17 everything.
