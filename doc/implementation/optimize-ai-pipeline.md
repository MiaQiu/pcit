# Implementation Plan: Clean Up AI Pipeline

See also: [field-audit.md](./field-audit.md) for the full field trace from AI output → DB → API → mobile app.

## Goal

Remove dead code, eliminate unused data paths, and simplify the pipeline for maintainability — without compromising output quality or performance.

## Current State

### CDI Session: 8 AI calls
| # | Call | Model | Fields Used by App |
|---|------|-------|--------------------|
| 1 | Role Identification | Gemini Flash | Internal only |
| 2 | PCIT Coding | Gemini Flash | tag, feedback, tagCounts |
| 3 | Developmental Profiling | Gemini Flash | Feeds milestones only (not displayed) |
| 4 | CDI Coaching Report | Gemini 3 Pro (streaming) | coachingCards, tomorrowGoal |
| 5 | CDI Coaching Format | Gemini Flash | coachingCards, tomorrowGoal |
| 6 | Combined Feedback | Gemini Flash | topMoment, feedback, activity, exampleUtteranceNumber |
| 7 | Review Feedback | Gemini Flash | revisedFeedback, additionalTip (used in TranscriptScreen) |
| 8 | Milestone Detection | Gemini Flash | milestoneCelebrations |

### PDI Session: 9 AI calls
Same as CDI + PDI Two Choices Flow analysis. CDI Coaching (calls 4+5) run unnecessarily for PDI.

---

## Phase 0: Remove Dead Data (immediate cleanup)

### 0.1 Strip dead fields from Combined Feedback prompt
**File:** `server/services/pcitAnalysisService.cjs` — `generateCombinedFeedbackPrompt()`

**Dead fields (stored, returned, never displayed):**
- `childReaction` — UI code commented out in ReportScreen
- `reminder` — UI code commented out in ReportScreen
- `tips` — hardcoded null, never populated

**Note:** `exampleUtteranceNumber` is **actively used** in `ReportScreen.tsx:758` — keep it.

**Change:** Remove `childReaction`, `reminder`, and `tips` from the prompt's "Return ONLY valid JSON" section. Keep `exampleUtteranceNumber`.

**Before (prompt asks for 6 fields):**
```json
{
  "topMoment": {...},
  "Feedback": "...",
  "exampleUtteranceNumber": 7,
  "reminder": "...",
  "ChildReaction": "...",
  "activity": "..."
}
```

**After (prompt asks for 4 fields):**
```json
{
  "topMoment": {...},
  "feedback": "...",
  "exampleUtteranceNumber": 7,
  "activity": "..."
}
```

**Why:** Dead fields in the prompt are confusing for future developers reading the code — they look important but do nothing. Also removes the corresponding dead code in the response handler.

### 0.2 Stop returning dead fields in API response
**File:** `server/routes/recordings.cjs` — `GET /api/recordings/:id/analysis`

**Remove from response:**
- `pcitCoding` (full AI response — only tagCounts is used)
- `childReaction` (commented out in UI)
- `reminder` (commented out in UI)
- `tips` (always null)
- `aboutChild` (backward-compat transform, never referenced by mobile app)
- `childPortfolioInsights` (backward-compat transform, never referenced by mobile app)

**Keep in response (actively used):**
- `exampleIndex` — used in ReportScreen.tsx for example utterance display
- `transcript[i].revisedFeedback` — used in TranscriptScreen.tsx (preferred over original feedback)
- `transcript[i].additionalTip` — used in TranscriptScreen.tsx (tip with lightbulb icon)

**Why:** Dead fields in the API response create confusion about what the app actually uses. New developers might build on fields that are never displayed, or be afraid to modify them.

### 0.3 Stop storing pcitCoding full response
**File:** `server/services/pcitAnalysisService.cjs` — final session update

**Change:** Don't write `Session.pcitCoding` (full AI response blob). The individual utterance records already have the tags and feedback. Only `tagCounts` is needed.

**Note:** Keep `fullResponse` variable in code for error logging if parsing fails.

**Why:** The blob duplicates data already stored per-utterance and makes it unclear what the source of truth is.

---

## Phase 1: Fix Incorrect Behavior

### 1.1 Skip CDI coaching for PDI sessions
**File:** `server/services/pcitAnalysisService.cjs` (~line 1047)

**Problem:** PDI sessions run the full CDI coaching pipeline (Gemini Pro report + format call). This generates coaching about "play skills" and "labeled praise" for discipline sessions — wrong content that's never shown.

**Change:**
```javascript
// Before
const [profilingSettled, coachingSettled] = await Promise.allSettled([
  generateDevelopmentalProfiling(...),
  generateCdiCoaching(...)
]);

// After
const [profilingSettled, coachingSettled] = await Promise.allSettled([
  generateDevelopmentalProfiling(...),
  isCDI ? generateCdiCoaching(...) : Promise.resolve(null)
]);
```

**Why:** Running CDI coaching on PDI sessions is semantically wrong (generates irrelevant play-based coaching), wastes the slowest call in the pipeline (~30s), and adds complexity when debugging PDI issues.

### 1.2 Make Combined Feedback non-blocking
**File:** `server/services/pcitAnalysisService.cjs` (~line 642)

**Problem:** If Combined Feedback throws, the entire session is marked FAILED — even though transcript, tags, coaching, and milestones may have completed successfully.

**Change:** Wrap `generateCDIFeedback()` call in try/catch. Log the error but don't fail the session. Review Feedback already handles failures gracefully.

**Why:** A failure in one supplementary call shouldn't destroy the whole session. The user loses all their data for the session.

### 1.3 Cache utterances in memory
**File:** `server/services/pcitAnalysisService.cjs`

**Problem:** `getUtterances(sessionId)` called 4 times during analysis:
- Line 813: Initial fetch
- Line 895: After role update
- Line 1034: For profiling
- Line 1083: For feedback

**Change:** After role/tag updates, mutate the in-memory array instead of refetching from DB. Pass the array through to downstream functions.

**Why:** Unnecessary DB round-trips make the code harder to reason about (are we getting stale data? fresh data?) and add latency. A single in-memory array with clear mutation points is easier to follow.

### 1.4 Route Weekly Report through callAI()
**File:** `server/services/weeklyReportService.cjs`

**Problem:** Weekly report calls `callClaudeForFeedback()` directly, bypassing `callAI()`. This means it ignores the `AI_PROVIDER` setting.

**Change:** Replace direct `callClaudeForFeedback()` call with `callAI()`.

**Why:** Inconsistent routing means you can't test the full pipeline with a single env var switch. Makes debugging harder.

---

## Phase 2: Simplify Call Structure (prompt changes required)

### 2.1 Merge Role Identification + PCIT Coding into 1 call
**Files:**
- `server/services/pcitAnalysisService.cjs`
- `server/prompts/roleIdentification.txt`
- `server/prompts/dpicsCoding.txt`
- New: `server/prompts/roleAndCoding.txt` (combined prompt)

**Current:** 2 sequential calls — Role ID must finish before PCIT Coding starts. The transcript is sent twice.

**Proposed:** Single prompt that:
1. Identifies speaker roles (ADULT/CHILD)
2. Codes all adult utterances with DPICS tags + feedback

**New prompt structure:**
```
System: [DPICS coding guidelines]

User:
You will receive a list of utterances. Do two tasks:

Task 1 — Role Identification:
Classify each speaker as ADULT or CHILD.

Task 2 — PCIT Coding:
For each ADULT utterance, assign a DPICS code and feedback.

Return JSON:
{
  "speaker_identification": { ... },
  "coding_results": [ {id, code, feedback}, ... ]
}

Utterances:
[JSON array]
```

**Why:** Two sequential calls that process the same transcript is unnecessary complexity. The Role ID result is only used to filter utterances for coding — a single prompt can do both.

**Risk:** Larger combined prompt may reduce coding accuracy. Test with 5+ sessions and compare results against current 2-call approach before shipping.

### 2.2 Eliminate CDI Coaching Format call
**Files:**
- `server/services/pcitAnalysisService.cjs` — `generateCdiCoaching()`
- `server/prompts/cdiCoaching.txt`

**Current:** 2 calls:
1. Gemini Pro generates ~2000-word free-form coaching report
2. callAI picks 3 sections and formats for mobile

**Proposed:** Modify the Gemini Pro prompt to directly output 3 structured coaching cards + tomorrowGoal in JSON format. Skip the format call entirely.

**Change to prompt:**
```
... (existing coaching context)

Output ONLY valid JSON:
{
  "coachingSummary": "2-3 sentence session overview",
  "sections": [
    { "title": "Section Title", "content": "Formatted text with **bold** and • bullets" }
  ],
  "tomorrowGoal": "Specific actionable goal"
}
```

**Why:** The format call exists because the original coaching prompt outputs free-form text. If we can get structured output directly, the format call is just unnecessary complexity and a potential failure point.

**Risk:** Gemini Pro may produce less polished formatting than the dedicated format call. Test output quality.

---

## Phase 3: PDI-Specific Improvements

### 3.1 PDI-specific Combined Feedback prompt
**Files:**
- New: `server/prompts/pdiCombinedFeedback.txt`
- `server/services/pcitAnalysisService.cjs` — `generateCDIFeedback()`

**Problem:** Combined Feedback prompt asks about "play session", "what game they played", "top moment of connection" — wrong framing for discipline sessions.

**Proposed:** Create a PDI variant that asks about:
- Top discipline moment (effective command sequence)
- Feedback on maintaining calm authority
- Child's response to structure
- Activity context (mealtime, cleanup, etc.)

**Change:**
```javascript
// In generateCDIFeedback or a new generatePDIFeedback
const prompt = isCDI
  ? generateCombinedFeedbackPrompt(counts, utterances, childName)
  : generatePDICombinedFeedbackPrompt(counts, utterances, childName);
```

### 3.2 Consider skipping Review Feedback for PDI
The review prompt focuses on desirable CDI skills (LP, BD, RF, RQ) and undesirable skills. For PDI, the Two Choices analysis already provides per-command-sequence feedback. The review step may be redundant for PDI.

---

## Phase 4: Standardization

### 4.1 Consolidate formatting functions
**File:** `server/services/pcitAnalysisService.cjs`

Merge `formatUtterancesForPrompt()` and `formatUtterancesForPsychologist()` into one function with options:
```javascript
function formatUtterances(utterances, { includeSilence = true, includeTags = false } = {})
```

**Why:** Two functions that do almost the same thing with slightly different formatting is a maintenance burden and source of subtle bugs.

### 4.2 Route Milestone Detection through callAI()
**File:** `server/services/milestoneDetectionService.cjs`

Replace direct `callGeminiFlash()` with `callAI()` for consistent provider switching and error handling.

**Why:** Same as 1.4 — all AI calls should go through the same routing for consistency.

### 4.3 Add structured logging for all AI calls
Add call name, provider, token counts, and latency to every `callAI()` invocation for monitoring in production.

**Why:** Without this, debugging production issues requires guessing which call failed or was slow.

---

## Impact Summary

| Phase | Change | Why |
|-------|--------|-----|
| 0.1 | Strip dead prompt fields | Remove confusing dead code from prompts |
| 0.2 | Slim API response | Remove dead fields that mislead developers |
| 0.3 | Stop storing pcitCoding blob | Eliminate duplicate data source |
| 1.1 | Skip CDI coaching for PDI | Fix wrong behavior (play coaching on discipline) |
| 1.2 | Non-blocking feedback | Fix fragile failure mode |
| 1.3 | Cache utterances | Simplify data flow, remove redundant DB reads |
| 1.4 | Weekly report via callAI | Consistent AI routing |
| 2.1 | Merge Role ID + Coding | Remove unnecessary sequential dependency |
| 2.2 | Eliminate coaching format | Remove unnecessary intermediate call |
| 3.1 | PDI-specific feedback | Fix wrong content framing for discipline |
| 4.1-4.3 | Standardize | Consistent patterns across the pipeline |

### Call flow after cleanup:

**CDI (6 calls, down from 8):**
```
1. Role ID + PCIT Coding (merged)     ─── callAI
2. Developmental Profiling             ─── callAI  (parallel)
3. CDI Coaching (structured output)    ─── callGeminiStreaming (parallel)
4. Combined Feedback (slim prompt)     ─── callAI
5. Review Feedback                     ─── callAI
6. Milestone Detection                 ─── callAI  (non-blocking)
```

**PDI (5 calls, down from 9):**
```
1. Role ID + PCIT Coding (merged)     ─── callAI
2. Developmental Profiling             ─── callAI  (parallel)
3. PDI Combined Feedback               ─── callAI  (parallel)
4. Review Feedback                     ─── callAI
5. PDI Two Choices Flow                ─── callAI
6. Milestone Detection                 ─── callAI  (non-blocking)
```

---

## Testing Strategy

Each phase should be tested with the e2e script on at least 3 sessions:

```bash
# CDI session
node scripts/e2e-report.cjs --session <cdi-session-id> --skip-transcription

# PDI session
node scripts/e2e-report.cjs --session <pdi-session-id> --skip-transcription
```

Compare output quality (competencyAnalysis fields, coaching cards, tag counts) between old and new pipelines before deploying.
