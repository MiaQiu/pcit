# Error Handling & Retry Improvement Plan

## Background

Analysis of `analyzePCITCoding` and `processRecordingWithRetry` revealed four high-priority gaps in the error handling and retry architecture:

1. Steps 9–10 (child profiling, competency analysis, CDI/PDI coaching) silently swallow all errors and mark the session `COMPLETED` with `null` data — user sees a broken report with no retry triggered
2. Each retry reruns all 10 steps from scratch — Steps 1–8 that already succeeded are wastefully repeated and risk overwriting good data
3. No distinction between retryable (transient network) and permanent (bad data, missing user) failures at the pipeline level — permanent errors waste 3 retry attempts before failing
4. `transcribeRecording` sits outside the retry scope — a transient transcription error goes straight to permanent failure with no retry

---

## Existing architecture notes

These details affect the implementation of each priority:

**Step 9 uses `Promise.allSettled`**
The orchestration already uses `Promise.allSettled` for the three parallel sub-calls (developmental profiling, CDI coaching, about-child). However, each sub-function (`generateDevelopmentalProfiling`, `generateCdiCoaching`, `generateAboutChild`, `generatePDITwoChoicesAnalysis`) catches its own errors internally and returns `null`. This means `allSettled` always sees `fulfilled` — the `rejected` branches in `analyzePCITCoding` lines 1249–1256 are dead code and never fire.

**`generateCDIFeedback` inner structure**
- Call 1 (`combined-feedback`, line 813) — no try-catch, throws directly on failure
- Call 2 (`review-feedback`, lines 824–834) — has try-catch, logs and continues with empty `revisedFeedback`

**`transcribedAt` field already exists**
`prisma/schema.prisma` already has `transcribedAt DateTime?`. `transcriptionService.cjs` already sets it on success. Safe to use as a transcription checkpoint with no schema change.

**`startBackgroundProcessing` already receives `storagePath` and `durationSeconds`**
Both upload routes pass these to `startBackgroundProcessing`, which passes them to `transcribeRecording`. They just need to be forwarded further into `processRecordingWithRetry`.

---

## Priority 1 — Silent COMPLETED with broken data

### Problem

All Step 9 sub-functions (`generateDevelopmentalProfiling`, `generateCdiCoaching`, `generateAboutChild`) catch their own errors and return `null`. `generatePDITwoChoicesAnalysis` does the same. `generateCDIFeedback` Call 1 has no guard — if it throws, Step 10's outer catch swallows it. In all cases `childProfilingResult` and `competencyAnalysis` remain `null`, the session is marked `COMPLETED`, and the user sees a broken report with no indication anything went wrong.

### Schema changes

Add to `Session` model in `schema.prisma`:

```prisma
enrichmentStatus   EnrichmentStatus  @default(PENDING)
enrichmentError    String?
```

Add new enum:

```prisma
enum EnrichmentStatus {
  PENDING       // analysis not yet run
  COMPLETED     // all enrichment steps succeeded
  PARTIAL       // some sub-steps failed, partial data saved
  FAILED        // all enrichment sub-steps failed (competencyAnalysis and childProfilingResult both null)
}
```

Run: `npx prisma migrate dev --name add-enrichment-status`

### Code changes

**`pcitAnalysisService.cjs` — fix dead rejection paths in Step 9**

Remove the internal try-catch from each sub-function so they actually throw on failure, allowing `Promise.allSettled` to catch them properly:

- `generateDevelopmentalProfiling` — remove lines 464–477 catch block, let it throw
- `generateCdiCoaching` — remove lines 649–652 outer catch block (keep the inner format-call catch at lines 634–638 since partial result is useful)
- `generateAboutChild` — remove catch blocks at lines 538–541 and 585–588, let each step throw
- `generatePDITwoChoicesAnalysis` — remove lines 902–904 catch block, let it throw

With these removed, `Promise.allSettled` will now correctly populate `rejected` branches. The existing rejection handlers (lines 1249–1256) become live and will log errors correctly.

**`pcitAnalysisService.cjs` — Step 10 competency analysis**

Wrap `generateCDIFeedback` Call 1 (`combined-feedback`) in a try-catch consistent with Call 2:

```js
let feedbackData = null;
try {
  feedbackData = await llmCall(
    generateCombinedFeedbackPrompt(counts, utterances, childName),
    { label: 'combined-feedback', schema: SCHEMAS.COMBINED_FEEDBACK }
  );
} catch (feedbackErr) {
  console.error('⚠️ [CDI-FEEDBACK] Combined feedback failed:', feedbackErr.message);
}
if (!feedbackData) return { revisedFeedback: [] }; // partial result
```

**`pcitAnalysisService.cjs` — evaluate and write `enrichmentStatus`**

After the final `session.update` (which writes `pcitCoding`, `tagCounts`, `overallScore`), determine and write the enrichment outcome in the same update call:

```js
const hasFeedback  = competencyAnalysis !== null;
const hasProfiling = childProfilingResult !== null;

const enrichmentStatus =
  hasFeedback && hasProfiling ? 'COMPLETED' :
  hasFeedback || hasProfiling ? 'PARTIAL'   : 'FAILED';

const enrichmentError =
  enrichmentStatus !== 'COMPLETED'
    ? [!hasFeedback && 'competencyAnalysis', !hasProfiling && 'childProfiling']
        .filter(Boolean).join(', ') + ' failed'
    : null;

await prisma.session.update({
  where: { id: sessionId },
  data: {
    pcitCoding: { ... },
    tagCounts,
    competencyAnalysis,
    overallScore,
    ...,
    enrichmentStatus,
    enrichmentError
  }
});
```

**`processingService.cjs` — log enrichment outcome on success**

After `analyzePCITCoding` returns, re-fetch `enrichmentStatus` from the session and log a structured warning if not `COMPLETED`:

```js
const updated = await prisma.session.findUnique({
  where: { id: sessionId },
  select: { enrichmentStatus: true, enrichmentError: true }
});
if (updated.enrichmentStatus !== 'COMPLETED') {
  console.warn(`⚠️ [ENRICHMENT-INCOMPLETE] Session ${sessionId.substring(0, 8)} enrichmentStatus=${updated.enrichmentStatus} — ${updated.enrichmentError}`);
}
```

**New background repair job — `server/services/enrichmentRepairService.cjs`**

A script (admin-triggerable or scheduled) that:
1. Finds sessions where `analysisStatus = 'COMPLETED'` AND `enrichmentStatus IN ('PARTIAL', 'FAILED')`
2. Re-fetches `tagCounts`, `roleIdentificationJson`, and utterances from the session row — no re-transcription or re-coding needed
3. Re-runs only Steps 9–10 (`generateDevelopmentalProfiling`, `generateCdiCoaching` / `generatePDITwoChoicesAnalysis`, `generateAboutChild`, `generateCDIFeedback`)
4. Writes results and updates `enrichmentStatus` to `COMPLETED`

**`recordings.cjs` — GET /api/recordings/:id/analysis**

Add `enrichmentStatus` and `enrichmentError` to the session select and include them in the response object:

```js
// in prisma select:
enrichmentStatus: true,
enrichmentError: true,

// in response:
enrichmentStatus: session.enrichmentStatus,
enrichmentError: session.enrichmentError || null,
```

This allows the mobile app to show a "Some insights are still loading" state when `enrichmentStatus` is `PARTIAL` or `FAILED`, rather than showing empty coaching sections with no explanation.

**`admin.cjs` — session listing**

Add `enrichmentStatus` to the session fields selected and returned in the admin session list (around line 1362) for visibility into enrichment failures.

---

## Priority 2 — Retry reruns all steps

### Problem

`processRecordingWithRetry` calls `analyzePCITCoding` as a single unit. On retry, all 10 steps run again from scratch. Role identification and PCIT coding — the two most expensive LLM calls — re-run even if they already wrote valid results to the DB.

### Schema changes

Add checkpoint booleans to `Session` in `schema.prisma`:

```prisma
roleIdDone     Boolean  @default(false)
pcitCodingDone Boolean  @default(false)
```

Note: `transcribedAt DateTime?` already exists — it serves as the transcription checkpoint with no schema change needed.

Run: `npx prisma migrate dev --name add-pipeline-checkpoints`

### Code changes

**`pcitAnalysisService.cjs` — write checkpoints as steps complete**

Step 3–5 (role identification): add `roleIdDone: true` to the existing `session.update` that writes `roleIdentificationJson`:

```js
await prisma.session.update({
  where: { id: sessionId },
  data: { roleIdentificationJson, roleIdDone: true }
});
```

Step 8 (PCIT coding): add `pcitCodingDone: true` to the `updateUtteranceTags` call or the subsequent DB write. Since `updateUtteranceTags` is a utility, write the checkpoint in a separate `session.update` immediately after.

**`pcitAnalysisService.cjs` — skip completed steps on retry**

At the start of `analyzePCITCoding`, the session is already fetched. Use the checkpoint flags:

```js
if (!session.roleIdDone) {
  // run role identification LLM call + updateUtteranceRoles + session.update
} else {
  console.log(`[ANALYSIS] Skipping role identification — already completed`);
  roleIdentificationJson = session.roleIdentificationJson;
  // rebuild adultSpeakers from roleIdentificationJson
}

if (!session.pcitCodingDone) {
  // run PCIT coding LLM call + updateUtteranceTags + tagCounts tallying
} else {
  console.log(`[ANALYSIS] Skipping PCIT coding — already completed`);
  tagCounts = session.tagCounts; // already stored on session row
}
```

Steps 1–2 (DB reads, quality gate) are fast and idempotent — no checkpoint needed. Steps 9–10 are covered by `enrichmentStatus` from Priority 1.

**Checkpoint reset**

Checkpoints default to `false` in the schema. On a brand new session (attempt 0) they are always `false` — no reset needed. On retry they persist, enabling the skip logic above.

---

## Priority 3 — No distinction between retryable and permanent failures

### Problem

`processRecordingWithRetry` only distinguishes `SessionQualityError` (skip retries) from everything else (retry up to 3 times). Errors that are clearly permanent — missing user, corrupt encrypted data, empty PCIT coding results — still burn all 3 retry attempts before giving up.

### Code changes

**`pcitAnalysisService.cjs` — new error class**

Add alongside `SessionQualityError`:

```js
class PermanentFailureError extends Error {
  constructor(message, userMessage) {
    super(message);
    this.name = 'PermanentFailureError';
    this.userMessage = userMessage || 'An error occurred while analyzing your recording. Please try again.';
  }
}
```

Export it: `module.exports = { SessionQualityError, PermanentFailureError, analyzePCITCoding, ... }`

**`pcitAnalysisService.cjs` — throw `PermanentFailureError` from permanent failure points**

| Location | Condition | Message |
|----------|-----------|---------|
| After user fetch (line 947) | `user === null` | 'User record not found' |
| `decryptSensitiveData` call (line 948) | wrap in try-catch, catch → throw PermanentFailureError | 'Failed to decrypt child data' |
| After PCIT coding array check (line 1148) | `codingResults.length === 0` | 'PCIT coding returned empty results' |
| Role identification (line 1042) | `adultSpeakers.length === 0` after a valid LLM response (not parse error) | 'No adult speakers identified in recording' |

**`processingService.cjs` — import and handle `PermanentFailureError`**

```js
const { analyzePCITCoding, SessionQualityError, PermanentFailureError } = require('./pcitAnalysisService.cjs');
```

In `processRecordingWithRetry` catch block:

```js
if (error instanceof SessionQualityError || error instanceof PermanentFailureError) {
  throw error; // skip retries immediately
}
```

**`recordings.cjs` — `startBackgroundProcessing` catch block**

```js
if (err instanceof SessionQualityError || err instanceof PermanentFailureError) {
  await notifyQualityRejection(sessionId, userId, err);
} else {
  await notifyProcessingFailure(sessionId, userId, err);
}
```

`notifyQualityRejection` already reads `error.userMessage` for both the DB write and push notification — `PermanentFailureError` uses the same field name, so no changes needed to that function.

---

## Priority 4 — Transcription outside retry scope

### Problem

`startBackgroundProcessing` runs `transcribeRecording` before calling `processRecordingWithRetry`. A transient network failure during transcription bypasses all retry logic and goes straight to `notifyProcessingFailure`.

```js
async function startBackgroundProcessing(sessionId, userId, storagePath, durationSeconds) {
  try {
    await transcribeRecording(sessionId, userId, storagePath, durationSeconds)  // ← no retry
    await prisma.session.update({ data: { analysisStatus: 'PROCESSING' } })
    await processRecordingWithRetry(sessionId, userId, 0)                       // ← retried
  } catch (err) { ... }
}
```

### Code changes

**`processingService.cjs` — update `processRecordingWithRetry` signature**

Add `storagePath` and `durationSeconds` parameters:

```js
async function processRecordingWithRetry(sessionId, userId, storagePath, durationSeconds, attemptNumber = 0)
```

Move transcription and the `PROCESSING` status update inside the try block, before `analyzePCITCoding`, with a checkpoint skip:

```js
try {
  if (attemptNumber > 0) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { retryCount: attemptNumber, lastRetriedAt: new Date() }
    });
  }

  // Re-fetch session to read checkpoint flags (roleIdDone, pcitCodingDone, transcribedAt)
  const session = await prisma.session.findUnique({ where: { id: sessionId }, select: { transcribedAt: true, roleIdDone: true, pcitCodingDone: true } });

  if (!session.transcribedAt) {
    await transcribeRecording(sessionId, userId, storagePath, durationSeconds);
  } else {
    console.log(`[PROCESSING] Skipping transcription — already completed`);
  }

  await prisma.session.update({ where: { id: sessionId }, data: { analysisStatus: 'PROCESSING' } });

  await analyzePCITCoding(sessionId, userId);
  // ... success path unchanged
```

**`recordings.cjs` — update callers of `processRecordingWithRetry` and `startBackgroundProcessing`**

`startBackgroundProcessing` already receives `storagePath` and `durationSeconds`. Forward them to `processRecordingWithRetry`:

```js
await processRecordingWithRetry(sessionId, userId, storagePath, durationSeconds, 0);
```

Remove the now-redundant `transcribeRecording` call and `analysisStatus → PROCESSING` update from `startBackgroundProcessing`, since both now live inside `processRecordingWithRetry`.

`startBackgroundProcessing` simplifies to:

```js
async function startBackgroundProcessing(sessionId, userId, storagePath, durationSeconds) {
  try {
    await processRecordingWithRetry(sessionId, userId, storagePath, durationSeconds, 0);
  } catch (err) {
    if (err instanceof SessionQualityError || err instanceof PermanentFailureError) {
      await notifyQualityRejection(sessionId, userId, err);
    } else {
      await notifyProcessingFailure(sessionId, userId, err);
    }
  }
}
```

Both upload routes (lines 282, 380) already pass `storagePath` and `durationSeconds` to `startBackgroundProcessing` — no changes needed there.

---

## Implementation order

Do these in sequence — each builds on the previous:

1. **Priority 3 first** — add `PermanentFailureError`. Standalone change, no schema migration, lowest risk. Immediately stops wasting retries on permanent errors.

2. **Priority 4 second** — move transcription into retry scope. Requires Priority 3 so `PermanentFailureError` works correctly inside the enlarged retry boundary.

3. **Priority 2 third** — add pipeline checkpoints. Requires Priority 4 since `processRecordingWithRetry` now owns transcription and must know whether to skip it on retry. Requires schema migration.

4. **Priority 1 last** — add `enrichmentStatus` + repair job. Largest change (schema migration, new service file, API change, sub-function refactor). Depends on stable retry boundaries established by 2, 3, 4.

---

## Testing

Each priority must be tested and verified before moving to the next.

### After Priority 3 — `PermanentFailureError`

**Test A: Permanent errors skip retries**

Create `scripts/test-permanent-failure.cjs`. Mock three permanent failure conditions and confirm each one:
- Sets `analysisStatus = 'FAILED'` immediately (no retry delay)
- Sets `permanentFailure = true`
- Sets `analysisError` to the expected `userMessage`
- Does NOT update `retryCount` (stays at 0)
- Does NOT call `notifyProcessingFailure` (Slack alert) — only `notifyQualityRejection`

To trigger each condition manually against a real session:

```bash
# Trigger "user not found" — temporarily point the session at a non-existent userId
node -e "
  require('dotenv').config();
  const p = require('./server/services/db.cjs');
  p.session.update({ where: { id: 'SESSION_ID' }, data: { userId: 'non-existent-user' } })
    .then(() => console.log('done')).finally(() => p.\$disconnect());
"
node scripts/rerun-analysis.cjs SESSION_ID
# Expect: FAILED immediately, retryCount = 0, no retry delays in logs
```

```bash
# Trigger "empty coding results" — truncate all utterances for a session
node -e "
  require('dotenv').config();
  const p = require('./server/services/db.cjs');
  p.utterance.deleteMany({ where: { sessionId: 'SESSION_ID' } })
    .then(r => console.log('deleted', r.count)).finally(() => p.\$disconnect());
"
node scripts/rerun-analysis.cjs SESSION_ID
# Expect: FAILED at quality gate (no utterances), retryCount = 0
```

**Test B: Retryable errors still retry**

Confirm that a transient error (e.g. temporarily invalid `GEMINI_API_KEY`) still triggers 3 retry attempts:

```bash
GEMINI_API_KEY=invalid node scripts/rerun-analysis.cjs SESSION_ID
# Expect: 3 attempts visible in logs, then FAILED with retryCount = 2
```

**Verify in DB after each test:**
```bash
node -e "
  require('dotenv').config();
  const p = require('./server/services/db.cjs');
  p.session.findUnique({ where: { id: 'SESSION_ID' }, select: { analysisStatus: true, permanentFailure: true, retryCount: true, analysisError: true } })
    .then(r => console.log(JSON.stringify(r, null, 2))).finally(() => p.\$disconnect());
"
```

---

### After Priority 4 — Transcription inside retry scope

**Test A: Transcription failure is retried**

Temporarily break transcription by setting an invalid `SCRIBE_API_KEY` (or whichever transcription provider is configured), then trigger reprocessing from scratch:

```bash
# Reset a session to PENDING with no transcript
node -e "
  require('dotenv').config();
  const p = require('./server/services/db.cjs');
  p.session.update({ where: { id: 'SESSION_ID' }, data: { analysisStatus: 'PENDING', transcript: '', transcribedAt: null } })
    .then(() => console.log('reset')).finally(() => p.\$disconnect());
"

SCRIBE_API_KEY=invalid node scripts/reprocess-session.cjs SESSION_ID
# Expect: transcription retried 3 times (visible in logs), then FAILED
# retryCount should be 2 (not 0 as before)
```

**Test B: Transcription checkpoint skip on retry**

Manually set `transcribedAt` on a session that has a valid transcript, then run `reprocess-session.cjs` and confirm transcription is skipped:

```bash
node -e "
  require('dotenv').config();
  const p = require('./server/services/db.cjs');
  p.session.findUnique({ where: { id: 'SESSION_ID' }, select: { transcribedAt: true, transcript: true } })
    .then(r => console.log(r)).finally(() => p.\$disconnect());
"
# If transcribedAt is set, run:
node scripts/reprocess-session.cjs SESSION_ID
# Expect: log line "[PROCESSING] Skipping transcription — already completed"
# Expect: transcription service NOT called (no transcription log lines)
```

**Test C: Full end-to-end still works**

Run a full reprocess on a session with valid audio to confirm the overall flow still succeeds with transcription now inside the retry boundary:

```bash
node scripts/reprocess-session.cjs SESSION_ID
# Expect: COMPLETED, overallScore present
```

> **Note:** `reprocess-session.cjs` currently resets `transcribedAt: null` before running. After Priority 4 this script must also reset `transcribedAt: null` in its reset block (it already resets `transcript: ''`) — update the script accordingly.

---

### After Priority 2 — Pipeline checkpoints

**Test A: Role ID checkpoint skips on retry**

Manually set `roleIdDone = true` on a session that already has `roleIdentificationJson`, then run analysis and confirm role ID LLM call is skipped:

```bash
node -e "
  require('dotenv').config();
  const p = require('./server/services/db.cjs');
  p.session.update({ where: { id: 'SESSION_ID' }, data: { roleIdDone: true } })
    .then(() => console.log('done')).finally(() => p.\$disconnect());
"
node scripts/rerun-analysis.cjs SESSION_ID
# Expect: log "[ANALYSIS] Skipping role identification — already completed"
# Expect: no [ANALYSIS-STEP-3] log line
```

**Test B: PCIT coding checkpoint skips on retry**

```bash
node -e "
  require('dotenv').config();
  const p = require('./server/services/db.cjs');
  p.session.update({ where: { id: 'SESSION_ID' }, data: { roleIdDone: true, pcitCodingDone: true } })
    .then(() => console.log('done')).finally(() => p.\$disconnect());
"
node scripts/rerun-analysis.cjs SESSION_ID
# Expect: both role ID and PCIT coding skipped in logs
# Expect: analysis still completes with correct tagCounts (read from session row)
```

**Test C: Checkpoints are written on a fresh run**

Reset all checkpoints and run a full analysis. Verify checkpoints are written at the right points:

```bash
node -e "
  require('dotenv').config();
  const p = require('./server/services/db.cjs');
  p.session.update({ where: { id: 'SESSION_ID' }, data: { roleIdDone: false, pcitCodingDone: false } })
    .then(() => console.log('reset')).finally(() => p.\$disconnect());
"
node scripts/rerun-analysis.cjs SESSION_ID

# After run, verify flags are set:
node -e "
  require('dotenv').config();
  const p = require('./server/services/db.cjs');
  p.session.findUnique({ where: { id: 'SESSION_ID' }, select: { roleIdDone: true, pcitCodingDone: true, analysisStatus: true } })
    .then(r => console.log(r)).finally(() => p.\$disconnect());
"
# Expect: { roleIdDone: true, pcitCodingDone: true, analysisStatus: 'COMPLETED' }
```

**Test D: Simulate mid-pipeline failure then retry — confirm only remaining steps run**

1. Set `roleIdDone: true` (simulating role ID completed on attempt 1)
2. Set `GEMINI_API_KEY=invalid` to force PCIT coding to fail
3. Run analysis — expect it to fail at PCIT coding step, not re-run role ID
4. Restore `GEMINI_API_KEY`, run again — expect PCIT coding to run (checkpoint false) but role ID to be skipped

> **Note:** `reprocess-session.cjs` must be updated to reset `roleIdDone: false` and `pcitCodingDone: false` in its reset block alongside the other fields.

---

### After Priority 1 — `enrichmentStatus` + repair job

**Test A: `enrichmentStatus` is set correctly on a normal successful run**

```bash
node scripts/reprocess-session.cjs SESSION_ID

node -e "
  require('dotenv').config();
  const p = require('./server/services/db.cjs');
  p.session.findUnique({ where: { id: 'SESSION_ID' }, select: { enrichmentStatus: true, enrichmentError: true, competencyAnalysis: true, coachingCards: true, aboutChild: true } })
    .then(r => { console.log('enrichmentStatus:', r.enrichmentStatus); console.log('error:', r.enrichmentError); console.log('competencyAnalysis present:', !!r.competencyAnalysis); console.log('coachingCards present:', !!r.coachingCards); }).finally(() => p.\$disconnect());
"
# Expect: enrichmentStatus = 'COMPLETED', enrichmentError = null
```

**Test B: `enrichmentStatus = PARTIAL` when one enrichment sub-call fails**

Temporarily break one enrichment call (e.g. set an invalid Gemini key to break `generateCdiCoaching` while `generateCDIFeedback` can still run via Claude fallback, or vice versa), run analysis, and check status:

```bash
GEMINI_API_KEY=invalid node scripts/rerun-analysis.cjs SESSION_ID

node -e "
  require('dotenv').config();
  const p = require('./server/services/db.cjs');
  p.session.findUnique({ where: { id: 'SESSION_ID' }, select: { enrichmentStatus: true, enrichmentError: true, analysisStatus: true } })
    .then(r => console.log(r)).finally(() => p.\$disconnect());
"
# Expect: analysisStatus = 'COMPLETED', enrichmentStatus = 'PARTIAL' or 'FAILED'
# Expect: enrichmentError describes which sub-step failed
```

**Test C: `enrichmentStatus = FAILED` when all enrichment fails**

Break all LLM calls (invalid API keys for both Gemini and Anthropic), run analysis, confirm the session is still `COMPLETED` (Steps 1–8 succeeded) but `enrichmentStatus = FAILED`:

```bash
GEMINI_API_KEY=invalid ANTHROPIC_API_KEY=invalid node scripts/rerun-analysis.cjs SESSION_ID
# Expect: analysisStatus = 'COMPLETED' (PCIT coding succeeded via existing session data)
# Expect: enrichmentStatus = 'FAILED'
# Expect: competencyAnalysis = null, coachingCards = null
```

**Test D: GET /api/recordings/:id/analysis returns `enrichmentStatus`**

Using `test-feedback-upload.cjs` or a direct curl against the running server:

```bash
curl -s -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/recordings/SESSION_ID/analysis \
  | jq '{ status: .analysisStatus, enrichment: .enrichmentStatus, enrichmentError: .enrichmentError }'
# Expect: enrichmentStatus and enrichmentError present in response
```

**Test E: Repair job fixes PARTIAL sessions**

```bash
# First create a PARTIAL session (from Test B above), then run repair:
node server/services/enrichmentRepairService.cjs

# Verify:
node -e "
  require('dotenv').config();
  const p = require('./server/services/db.cjs');
  p.session.findUnique({ where: { id: 'SESSION_ID' }, select: { enrichmentStatus: true, coachingCards: true, competencyAnalysis: true } })
    .then(r => console.log(r)).finally(() => p.\$disconnect());
"
# Expect: enrichmentStatus = 'COMPLETED', coachingCards present
```

**Test F: Structured warning log appears for PARTIAL sessions**

After a PARTIAL run, check server logs for:
```
⚠️ [ENRICHMENT-INCOMPLETE] Session {id} enrichmentStatus=PARTIAL — competencyAnalysis failed
```

---

### Regression test after all priorities

Run the full existing test suite to confirm nothing is broken:

```bash
# Gateway retry logic (no API calls, safe to run anytime)
node scripts/test-gateway-retry.cjs

# Full pipeline with a real audio file (requires API keys and DB)
node scripts/test-child-profiling.cjs /path/to/audio.m4a USER_ID

# Full end-to-end reprocess of an existing session
node scripts/reprocess-session.cjs SESSION_ID
```

Verify the final DB state after the full pipeline test:
```bash
node -e "
  require('dotenv').config();
  const p = require('./server/services/db.cjs');
  p.session.findUnique({
    where: { id: 'SESSION_ID' },
    select: { analysisStatus: true, enrichmentStatus: true, enrichmentError: true, overallScore: true, roleIdDone: true, pcitCodingDone: true, retryCount: true, transcribedAt: true }
  }).then(r => console.log(JSON.stringify(r, null, 2))).finally(() => p.\$disconnect());
"
# Expect:
# analysisStatus: 'COMPLETED'
# enrichmentStatus: 'COMPLETED'
# enrichmentError: null
# overallScore: <non-null number>
# roleIdDone: true
# pcitCodingDone: true
# retryCount: 0
# transcribedAt: <non-null date>
```

---

## Files affected

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `enrichmentStatus`, `enrichmentError`, `roleIdDone`, `pcitCodingDone` fields; add `EnrichmentStatus` enum. `transcribedAt` already exists — no change. |
| `server/services/pcitAnalysisService.cjs` | Add `PermanentFailureError`; throw from permanent failure points; wrap `decryptSensitiveData`; guard `generateCDIFeedback` Call 1; remove internal catches from sub-functions; write checkpoint flags; evaluate and write `enrichmentStatus` |
| `server/services/processingService.cjs` | Import `PermanentFailureError`; catch it alongside `SessionQualityError`; accept `storagePath`/`durationSeconds` params; move `transcribeRecording` and `PROCESSING` update inside retry body; add transcription checkpoint skip; log enrichment outcome |
| `server/routes/recordings.cjs` | Remove `transcribeRecording` and `PROCESSING` update from `startBackgroundProcessing`; pass `storagePath`/`durationSeconds` to `processRecordingWithRetry`; add `enrichmentStatus`/`enrichmentError` to GET analysis response |
| `server/routes/admin.cjs` | Add `enrichmentStatus` to session list fields |
| `server/services/enrichmentRepairService.cjs` | New file — repair job for PARTIAL/FAILED enrichment sessions |
