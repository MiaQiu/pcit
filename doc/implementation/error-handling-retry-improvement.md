# Error Handling & Retry Improvement Plan

## Background

Analysis of `analyzePCITCoding` and `processRecordingWithRetry` revealed four high-priority gaps in the error handling and retry architecture:

1. Steps 9–10 (child profiling, competency analysis, CDI/PDI coaching) silently swallow all errors and mark the session `COMPLETED` with `null` data — user sees a broken report with no retry triggered
2. Each retry reruns all 10 steps from scratch — Steps 1–8 that already succeeded are wastefully repeated and risk overwriting good data
3. No distinction between retryable (transient network) and permanent (bad data, missing user) failures at the pipeline level — permanent errors waste 3 retry attempts before failing
4. `transcribeRecording` sits outside the retry scope — a transient transcription error goes straight to permanent failure with no retry

---

## Priority 1 — Silent COMPLETED with broken data

### Problem

Steps 9 and 10 are wrapped in try-catch blocks that swallow all errors:

```
Step 9 (child profiling):    try { ... } catch { console.error(...) }  // no throw
Step 10 (competency):        try { ... } catch { console.error(...) }  // no throw
```

If these fail, `childProfilingResult` and `competencyAnalysis` remain `null`. The final `session.update` still runs and `processRecordingWithRetry` marks the session `COMPLETED`. The user gets a report missing coaching cards, feedback, and about-child observations, with no indication anything went wrong and no retry triggered.

### Schema changes

Add two new optional fields to the `Session` model in `schema.prisma`:

```prisma
enrichmentStatus   EnrichmentStatus  @default(PENDING)
enrichmentError    String?
```

Add new enum:

```prisma
enum EnrichmentStatus {
  PENDING       // not yet attempted
  COMPLETED     // all enrichment steps succeeded
  PARTIAL       // some sub-steps failed, partial data saved
  FAILED        // all enrichment sub-steps failed
}
```

Run migration: `npx prisma migrate dev --name add-enrichment-status`

### Code changes

**`pcitAnalysisService.cjs` — Steps 9 & 10**

After the final `session.update` (which writes `pcitCoding`, `tagCounts`, `overallScore`), evaluate the enrichment outcome and set `enrichmentStatus`:

- `COMPLETED` — `competencyAnalysis` is non-null AND (`childProfilingResult` is non-null OR CDI coaching is non-null)
- `PARTIAL` — at least one is non-null but not all
- `FAILED` — both are null

Write `enrichmentStatus` and `enrichmentError` (a brief summary of what failed) in the same final `session.update` call.

**`processingService.cjs` — success path**

After `analyzePCITCoding` returns, check the session's `enrichmentStatus`. If `PARTIAL` or `FAILED`, do not suppress — log a structured warning that includes `sessionId` so it is queryable:

```
⚠️ [ENRICHMENT-INCOMPLETE] Session {id} completed with enrichmentStatus=PARTIAL — coachingCards=null, competencyAnalysis=present
```

**New background repair job — `server/services/enrichmentRepairService.cjs`**

A scheduled job (or admin-triggerable script) that:
1. Finds sessions where `analysisStatus = 'COMPLETED'` AND `enrichmentStatus IN (PARTIAL, FAILED)`
2. Re-fetches utterances, tagCounts, and roleIdentificationJson from the session row (already stored — no re-transcription or re-coding needed)
3. Re-runs only Steps 9–10 (`generateDevelopmentalProfiling`, `generateCdiCoaching`/`generatePDITwoChoicesAnalysis`, `generateAboutChild`, `generateCDIFeedback`)
4. Writes results and updates `enrichmentStatus` to `COMPLETED`

This decouples enrichment retries from the main pipeline retry entirely.

**Mobile/API (`recordings.cjs` — GET analysis endpoint)**

Update the response to include `enrichmentStatus` so the mobile app can show a "Some insights are still loading" message when `enrichmentStatus` is `PARTIAL` or `FAILED`, rather than showing an empty coaching section.

---

## Priority 2 — Retry reruns all steps

### Problem

`processRecordingWithRetry` calls `analyzePCITCoding` as a single unit. On retry, all 10 steps run again from scratch regardless of what succeeded on the previous attempt. Role identification and PCIT coding (the two most expensive LLM calls) are re-run even if they already wrote valid results to the DB.

### Schema changes

Add checkpoint booleans to `Session` in `schema.prisma`:

```prisma
roleIdDone     Boolean  @default(false)
pcitCodingDone Boolean  @default(false)
```

Run migration: `npx prisma migrate dev --name add-pipeline-checkpoints`

### Code changes

**`pcitAnalysisService.cjs`**

After each expensive step completes and writes to DB, set the corresponding checkpoint in the same DB update call:

- After `updateUtteranceRoles` + `session.update({ roleIdentificationJson })` → also set `roleIdDone: true`
- After `updateUtteranceTags` → also set `pcitCodingDone: true`

At the start of `analyzePCITCoding`, read these flags from the session row (already fetched in Step 1):

```js
if (!session.roleIdDone) {
  // run role identification LLM call + updateUtteranceRoles
} else {
  console.log('[ANALYSIS] Skipping role identification — already completed');
  // read roleIdentificationJson from session for downstream use
}

if (!session.pcitCodingDone) {
  // run PCIT coding LLM call + updateUtteranceTags + tagCounts tallying
} else {
  console.log('[ANALYSIS] Skipping PCIT coding — already completed');
  // read tagCounts from session for downstream use
}
```

Steps 9–10 are already handled by Priority 1 (separate enrichment path). Steps 1–2 (DB reads, quality gate) are fast and idempotent — no checkpoint needed.

**`processRecordingWithRetry` — checkpoint reset on new session**

When `attemptNumber === 0`, ensure `roleIdDone` and `pcitCodingDone` are `false` (they default to `false` in schema — no action needed). On retry (attempt > 0), checkpoints persist — the skip logic above handles it.

---

## Priority 3 — No distinction between retryable and permanent failures

### Problem

`processRecordingWithRetry` only distinguishes `SessionQualityError` (skip retries) from everything else (retry up to 3 times). Errors that are clearly permanent — missing user record, corrupt encrypted data, empty PCIT coding results — still burn all 3 retry attempts before giving up.

### Code changes

**New error class in `pcitAnalysisService.cjs`**

```js
class PermanentFailureError extends Error {
  constructor(message, userMessage) {
    super(message);
    this.name = 'PermanentFailureError';
    this.userMessage = userMessage || 'An error occurred while analyzing your recording.';
  }
}
```

Export alongside `SessionQualityError`.

**Throw `PermanentFailureError` from:**

| Location | Condition | Message |
|----------|-----------|---------|
| After user fetch | `user === null` | 'User record not found' |
| `decryptSensitiveData` call | any exception | 'Failed to decrypt child data' |
| After PCIT coding | `codingResults.length === 0` | 'PCIT coding returned empty results' |
| After role identification | `adultSpeakers.length === 0` after valid LLM response (not a parse error) | 'No adult speakers identified' |

**`processingService.cjs` — `processRecordingWithRetry`**

Catch `PermanentFailureError` the same way as `SessionQualityError`:

```js
if (error instanceof SessionQualityError || error instanceof PermanentFailureError) {
  throw error;  // skip retries
}
```

**`recordings.cjs` — `startBackgroundProcessing`**

In the catch block, add a branch for `PermanentFailureError`:

```js
if (err instanceof SessionQualityError || err instanceof PermanentFailureError) {
  await notifyQualityRejection(sessionId, userId, err);
} else {
  await notifyProcessingFailure(sessionId, userId, err);
}
```

`notifyQualityRejection` already handles the user-facing message correctly — `PermanentFailureError` carries a `userMessage` in the same shape.

---

## Priority 4 — Transcription outside retry scope

### Problem

`startBackgroundProcessing` runs `transcribeRecording` before calling `processRecordingWithRetry`. A transient network failure during transcription goes straight to `notifyProcessingFailure` — no retries at all.

```js
async function startBackgroundProcessing(...) {
  try {
    await transcribeRecording(...)        // ← no retry
    await prisma.session.update(...)
    await processRecordingWithRetry(...)  // ← retried
  } catch (err) { ... }
}
```

### Code changes

**`processingService.cjs` — move transcription inside `processRecordingWithRetry`**

Move the `transcribeRecording` call and the `analysisStatus → PROCESSING` update into `processRecordingWithRetry`, at the top of the try block, before `analyzePCITCoding`:

```
processRecordingWithRetry():
  try:
    if attemptNumber > 0: update retryCount, lastRetriedAt
    if !session.transcribedAt:             ← new checkpoint (see below)
      await transcribeRecording(...)
    await prisma.session.update({ analysisStatus: 'PROCESSING' })
    await analyzePCITCoding(...)
    ...success path...
  catch:
    if SessionQualityError or PermanentFailureError: throw
    if retries remaining: delay + recurse
    else: throw
```

**Transcription checkpoint**

`transcribeRecording` already sets `transcribedAt` on the session when it completes (check to confirm). Use this as the checkpoint — if `transcribedAt` is already set, skip transcription on retry. This prevents double-transcription of the same audio.

If `transcribedAt` is not currently written by `transcribeRecording`, add it as part of this change.

**`recordings.cjs` — `startBackgroundProcessing` simplification**

After moving transcription into `processRecordingWithRetry`, `startBackgroundProcessing` becomes:

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

Pass `storagePath` and `durationSeconds` as parameters to `processRecordingWithRetry` so it can call `transcribeRecording` internally.

---

## Implementation order

Do these in sequence — each builds on the previous:

1. **Priority 3 first** — add `PermanentFailureError`. Standalone, no schema changes, lowest risk. Immediately stops wasting retries on permanent errors.

2. **Priority 4 second** — move transcription into retry scope. Requires Priority 3 to be in place so `PermanentFailureError` works correctly inside the enlarged retry boundary.

3. **Priority 2 third** — add checkpoints. Requires Priority 4 since `processRecordingWithRetry` now owns transcription and needs to know whether to skip it on retry.

4. **Priority 1 last** — add `enrichmentStatus` + repair job. Largest change (schema migration, new service file, mobile API change). Depends on stable retry boundaries established by 2, 3, 4.

---

## Files affected

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `enrichmentStatus`, `enrichmentError`, `roleIdDone`, `pcitCodingDone` fields; add `EnrichmentStatus` enum |
| `server/services/pcitAnalysisService.cjs` | Add `PermanentFailureError`; throw from permanent failure points; add checkpoint writes; add `enrichmentStatus` evaluation; remove internal catches from sub-functions |
| `server/services/processingService.cjs` | Catch `PermanentFailureError`; move transcription call inside `processRecordingWithRetry`; accept `storagePath`/`durationSeconds` params |
| `server/routes/recordings.cjs` | Simplify `startBackgroundProcessing`; pass new params; update GET analysis response to include `enrichmentStatus` |
| `server/services/enrichmentRepairService.cjs` | New file — repair job for PARTIAL/FAILED enrichment sessions |
