# Audio Processing & Report Generation Flow

This document describes how recorded audio is processed and how reports are generated in the PCIT/Nora system.

## High-Level Pipeline

```
Audio Upload → Transcription (v1/v2/two-pass) → Speaker Identification → PCIT Coding → Child Profiling → Milestone Detection → Report Generation
```

```
MOBILE APP
    ↓
1. Audio Upload (S3)
    ↓
2. Transcription (ElevenLabs)
    ↓
3. Speaker Role Identification (Claude)
    ↓
4. PCIT Coding & Analysis (Claude)
    ↓
5. Child Profiling & Coaching Cards (Gemini Pro — streaming)
    ↓
5b. Milestone Detection (Gemini Flash — non-blocking)
    ↓
6. Report Generation & CDI/PDI Feedback
    ↓
MOBILE APP (Display Report)
```

---

## Phase 1: Audio Upload & Storage

**File:** `server/routes/recordings.cjs` (lines 119-277)

### Direct S3 Upload (Recommended)

1. **Initialize Upload:** `POST /api/recordings/upload/init`
   - Creates session record with `analysisStatus: PENDING`
   - Generates presigned S3 URL for direct client-side upload
   - Returns `sessionId`, `uploadUrl`, `uploadKey`, `expiresIn`

2. **Complete Upload:** `POST /api/recordings/upload/complete`
   - Verifies file exists in S3
   - Updates session with `storagePath` (S3 key)
   - Triggers background processing

### Supported Audio Formats
- audio/mp4, audio/aac, audio/mpeg, audio/wav, audio/webm, audio/m4a, audio/x-m4a
- Max file size: 50MB

### Initial Database State
```javascript
Session {
  id: sessionId,
  userId: userId,
  mode: 'CDI' | 'PDI',
  storagePath: 's3://bucket/path',
  durationSeconds: number,
  transcript: '',
  aiFeedbackJSON: {},
  pcitCoding: {},
  tagCounts: {},
  analysisStatus: 'PENDING',
  createdAt: timestamp
}
```

---

## Phase 2: Transcription

**File:** `server/services/transcriptionService.cjs`

**Triggered by:** `startBackgroundProcessing()` in recordings.cjs (lines 92-109)

### Transcription Modes

Set via `TRANSCRIPTION_MODE` environment variable (default: `v2`):

| Mode | Model(s) | Description |
|------|----------|-------------|
| `v1` | scribe_v1 only | Better 3-speaker diarization |
| `v2` | scribe_v2 only | Better text quality (default) |
| `two-pass` | scribe_v2 + scribe_v1 | Best of both: v2 text quality with v1 diarization |

### Steps

1. **Download Audio:** Fetch audio file from S3 using AWS SDK (`GetObjectCommand`)

2. **ElevenLabs Transcription:**
   - API Endpoint: `https://api.elevenlabs.io/v1/speech-to-text?include_timestamps=true`
   - Shared parameters for both models:

   ```javascript
   FormData {
     file: audioBuffer,
     model_id: 'scribe_v1' | 'scribe_v2',
     diarize: 'true',
     diarization_threshold: 0.1,
     temperature: 0,
     tag_audio_events: 'true',
     timestamps_granularity: 'word',
     keyterms: [childName]
   }
   ```

### Single-Pass Mode (`v1` or `v2`)

Calls the selected model once, parses utterances with `parseElevenLabsTranscript()`, and stores results.

### Two-Pass Mode (`two-pass`)

Runs both models and merges their strengths:

1. **Pass 1 — scribe_v2:** Transcribe for high-quality text. Parse into utterances.
2. **Pass 2 — scribe_v1:** Transcribe for superior speaker diarization. Extract word-level speaker IDs.
3. **Merge:** Assign v1 speakers to v2 utterances using **majority-vote overlap**:
   - For each v2 utterance, find all v1 words that overlap its time range
   - Sum overlap duration per v1 speaker
   - Assign the speaker with the most overlap time
   - If no overlap found, fall back to the nearest v1 word by timestamp

### Diarization Divergence Detection

After merging, the system compares v1 and v2 diarization and flags significant divergence:

- **Speaker count differs** between v1 and v2
- **>20% of utterances** are reassigned to a different speaker

If divergence is detected, a `_diarizationNote` is attached to the stored JSON:
```javascript
{
  divergenceDetected: true,
  v2SpeakerCount: 2,
  v1SpeakerCount: 3,
  speakerCountDiffers: true,
  reassignedUtterances: 5,
  totalUtterances: 20,
  reassignedPct: 25,
  v1ToV2SpeakerMap: { speaker_0: 'speaker_1', ... },
  summary: ['Speaker count differs: v2=2, v1=3', '5/20 utterances (25%) reassigned...']
}
```

### Post-Transcription (all modes)

3. **Parse & Store:**
   - Store raw JSON to `session.elevenLabsJson` (v2 JSON in two-pass mode)
   - Create formatted transcript text
   - Update `session.transcript`, `session.transcribedAt`, and `session.transcriptionService` (e.g. `elevenlabs-two-pass`)

4. **Create Utterance Records:** (`server/utils/utteranceUtils.cjs:23-38`)
   ```javascript
   Utterance {
     id: UUID,
     sessionId: string,
     speaker: 'speaker_0', 'speaker_1', etc.,
     text: string,
     startTime: float (seconds),
     endTime: float (seconds),
     role: null,      // populated in phase 3
     pcitTag: null,   // populated in phase 4
     order: int,
     feedback: string
   }
   ```

5. **Extract Silent Slots:** (`server/utils/utteranceUtils.cjs:85-137`)
   - Identifies gaps ≥3 seconds between utterances
   - Creates pseudo-utterances for coaching opportunities
   ```javascript
   Utterance {
     speaker: '__SILENT__',
     text: '[silent moment]',
     feedback: coaching message (duration-based)
   }
   ```

**Status Update:** `session.analysisStatus: 'PROCESSING'`

---

## Phase 3: Speaker Role Identification

**File:** `server/services/pcitAnalysisService.cjs` (lines 739-830)

**Prompt File:** `server/prompts/roleIdentification.txt`

### Process

1. Claude analyzes each speaker's utterances to classify as `ADULT` or `CHILD`

2. **Classification Indicators:**
   - **Child:** Requests, emotional expressions, play vocabulary, approval-seeking
   - **Adult:** Commands, praise, teaching questions, behavior management

3. **API Call:**
   ```javascript
   POST https://api.anthropic.com/v1/messages
   {
     model: 'claude-sonnet-4-5-20250929',
     max_tokens: 2048,
     temperature: 0.3
   }
   ```

4. **Response Format:**
   ```javascript
   {
     speaker_identification: {
       speaker_0: {
         role: 'CHILD',
         confidence: 0.95,
         reasoning: string
       },
       speaker_1: { role: 'ADULT', ... }
     }
   }
   ```

5. **Database Update:** (`server/utils/utteranceUtils.cjs:58-71`)
   - Update all utterances with `role: 'adult' | 'child'`
   - Store `session.roleIdentificationJson`

---

## Phase 4: PCIT Analysis & Coding

**File:** `server/services/pcitAnalysisService.cjs` (lines 838-950)

**Prompt File:** `server/prompts/dpicsCoding.txt`

### DPICS Coding System

Claude codes parent/adult utterances using the DPICS (Dyadic Parent-Child Interaction Coding System):

| Code | Name | Category | Example |
|------|------|----------|---------|
| LP | Labeled Praise | Desirable | "Good job building that tower" |
| UP | Unlabeled Praise | Desirable | "Great!" |
| BD | Behavioral Description | Desirable | "You are putting the red block on top" |
| RF/RQ | Reflection | Desirable | Repeating child's words back |
| NTA | Negative Talk | Undesirable | Criticism, fault-finding |
| DC | Direct Command | Undesirable | "Put that there" |
| IC | Indirect Command | Undesirable | "Can you...?" |
| Q | Question | Undesirable | Non-reflection questions |
| ID | Identification | Neutral | Idle, off-task |
| AK | Acknowledgment | Neutral | Brief responses |

### API Call
```javascript
POST https://api.anthropic.com/v1/messages
{
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 8192,
  temperature: 0,  // Deterministic coding
  system: dpicsSystemPrompt
}
```

### Response Format
```javascript
[
  { id: 0, code: 'LP', feedback: 'Great job praising your child!' },
  { id: 2, code: 'BD', feedback: 'Nice description of what they\'re doing.' }
]
```

### Tag Count Calculation
```javascript
tagCounts = {
  echo: count(RF, RQ),
  labeled_praise: count(LP),
  unlabeled_praise: count(UP),
  praise: LP + UP,
  narration: count(BD),
  direct_command: count(DC),
  indirect_command: count(IC),
  command: DC + IC,
  question: count(Q),
  criticism: count(NTA),
  neutral: count(ID) + count(AK)
}
```

---

## Phase 5: Child Profiling & Coaching Cards (Gemini — Single Call)

**File:** `server/services/pcitAnalysisService.cjs`

**Function:** `generateChildProfiling()`

**Prompt File:** `server/prompts/childProfiling.txt`

### Purpose

A single Gemini call that replaces the old three-call pipeline (Phases 5/5b/5c). Produces:
1. **Developmental observations** across 5 clinical domains → stored in `ChildProfiling` table
2. **Coaching cards** for parents → stored in `Session.coachingCards`

### Streaming Infrastructure

**Function:** `callGeminiStreaming()`

Due to the Gemini 3 Pro Preview model's extended thinking time (30-60s), the system uses SSE streaming:

```javascript
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:streamGenerateContent?alt=sse
{
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: {
    temperature: 0.5,
    maxOutputTokens: 8192
  }
}
// timeout: 300,000ms (5 minutes)
```

### Child Information Used

Retrieved from the User model:
- **childName:** Decrypted from encrypted storage
- **childAgeMonths:** Precise age in months
- **childGender:** From enum (BOY, GIRL, OTHER) → formatted as "boy", "girl", "child"
- **issue:** User-reported presenting concern

### Prompt Template Variables

| Variable | Source |
|----------|--------|
| `{{CHILD_NAME}}` | Decrypted `user.childName` |
| `{{CHILD_AGE_MONTHS}}` | Calculated from `childBirthday` / `childBirthYear` |
| `{{CHILD_GENDER}}` | `formatGender(user.childGender)` |
| `{{CHILD_ISSUE}}` | `user.issue` |
| `{{SESSION_METRICS}}` | Tag counts from PCIT coding |
| `{{TRANSCRIPT}}` | Formatted via `formatUtterancesForPsychologist()` |

### Output JSON Structure

```javascript
{
  "session_metadata": {
    "subject": "child name",
    "age_months": 36,
    "overall_impression": "1-2 sentence summary"
  },
  "developmental_observation": {
    "summary": "2-3 sentence developmental snapshot",
    "domains": [
      {
        "category": "Language",           // or Cognitive, Social, Emotional, Connection
        "framework": "Brown's Stages",    // clinical framework used
        "developmental_status": "brief status",
        "current_level": "specific level",
        "benchmark_for_age": "what is typical",
        "detailed_observations": [
          { "insight": "observation title", "evidence": "transcript quote" }
        ]
      }
      // ... 5 domains total
    ]
  },
  "pcit_coaching_cards": [
    {
      "card_id": 1,
      "title": "actionable title",
      "icon_suggestion": "emoji",
      "insight": "what was observed and why it matters",
      "suggestion": "what to do differently",
      "scenario": {
        "context": "setup",
        "instead_of": "what parent said",
        "try_this": "what to say instead"
      }
    }
    // ... 2-4 cards
  ]
}
```

### 5 Developmental Domains

| Category | Clinical Framework |
|----------|--------------------|
| Language | Brown's Stages of Language Development |
| Cognitive | Piaget's Preoperational Stage / Brown's Concepts |
| Social | Halliday's Interactional Function |
| Emotional | Halliday's Personal Function / Emotional Regulation |
| Connection | Biringen's Emotional Availability Scales |

### Child Record Creation

Before saving profiling results, the pipeline finds or creates a `Child` record:

```javascript
// Find existing Child for this user, or create one
let child = await prisma.child.findFirst({ where: { userId } });
if (!child) {
  child = await prisma.child.create({
    data: { userId, name: childName, birthday, gender, conditions }
  });
}
```

This ensures every `ChildProfiling` and `ChildMilestone` record is linked to a `Child`.

### Database Storage

**Child table** (one row per child):
```javascript
Child {
  id: UUID,
  userId: string,
  name: string,                       // decrypted from user.childName
  birthday: DateTime?,
  gender: ChildGender?,
  conditions: string?,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**ChildProfiling table** (one row per session):
```javascript
ChildProfiling {
  id: UUID,
  userId: string,
  sessionId: string (unique),
  childId: string,                    // → Child.id
  summary: string,                    // developmental_observation.summary
  domains: JSON,                      // developmental_observation.domains array
  metadata: JSON,                     // session_metadata
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**Session.coachingCards** field:
```javascript
session.coachingCards = [ ... ]  // pcit_coaching_cards array
```

### Backward Compatibility

The report endpoint transforms new data into old formats for older mobile app versions:
- `childPortfolioInsights` ← derived from `session.coachingCards` via `transformCoachingCardsToPortfolioInsights()`
- `aboutChild` ← derived from `childProfiling.domains` via `transformDomainsToAboutChild()`

Falls back to existing `session.childPortfolioInsights` / `session.aboutChild` for sessions processed before this change.

### Configuration

Requires `GEMINI_API_KEY` environment variable. If not configured, this phase is skipped gracefully.

### Performance

| | Before | After |
|---|--------|-------|
| AI calls | 3 sequential (Gemini + Gemini multi-turn + Claude) | 1 Gemini call |
| API dependencies | Gemini + Anthropic | Gemini only |

---

## Phase 5b: Milestone Detection (Gemini Flash — Non-Blocking)

**File:** `server/services/milestoneDetectionService.cjs`

**Function:** `detectAndUpdateMilestones(childId, sessionId)`

### Purpose

After each session's ChildProfiling is saved, maps the developmental observations (domains JSON) to `MilestoneLibrary` entries and creates/updates `ChildMilestone` records. Runs as a non-blocking step — errors here never prevent the session from reaching COMPLETED.

### API Call

Uses Gemini 2.0 Flash (non-streaming, fast and cheap):

```javascript
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
{
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 4096
  }
}
```

### Detection Logic

The prompt provides Gemini with:
- Child's age in months
- The profiling `domains` JSON (from Phase 5)
- All `MilestoneLibrary` entries (key, category, stage, title, detectionMode, age range)
- Existing milestones with status (so AI skips ACHIEVED ones)

#### First Profiling — Baseline Assessment

When a child has no existing `ChildMilestone` records (first session), the prompt additionally asks Gemini to identify **baseline achieved** milestones: basic milestones clearly already mastered given the child's age and observed abilities. These are created directly as `ACHIEVED`.

Example: A 29-month-old using multi-word sentences → Stage I language milestones are baseline achieved.

#### Subsequent Sessions — Threshold Progression

| Condition | Action |
|-----------|--------|
| No existing record | Create `ChildMilestone` with status `EMERGING` |
| Existing `EMERGING` + seen in > `thresholdValue` sessions | Promote to `ACHIEVED` |
| Existing `ACHIEVED` | Skip (never downgrade) |

### Response Format

```javascript
{
  "detected_milestones": [
    { "milestone_key": "language_brown_stage2_ing", "evidence_summary": "..." }
  ],
  // Only on first profiling:
  "baseline_achieved": [
    { "milestone_key": "language_brown_stage1_semantic", "evidence_summary": "..." }
  ]
}
```

### Pipeline Integration

Called inside the ChildProfiling upsert try-block in `pcitAnalysisService.cjs`:

```javascript
// STEP 10: Milestone Detection (non-blocking)
try {
  const { detectAndUpdateMilestones } = require('./milestoneDetectionService.cjs');
  const milestoneResult = await detectAndUpdateMilestones(child.id, sessionId);
} catch (milestoneError) {
  console.error('Milestone detection error (non-blocking):', milestoneError.message);
}
```

### Database Storage

**ChildMilestone table** (one row per child-milestone pair):
```javascript
ChildMilestone {
  id: UUID,
  childId: string,                    // → Child.id
  milestoneId: string,                // → MilestoneLibrary.id
  status: 'EMERGING' | 'ACHIEVED',
  firstObservedAt: DateTime,
  achievedAt: DateTime?,              // set when promoted to ACHIEVED
  createdAt: timestamp,
  updatedAt: timestamp
}
// Unique constraint: [childId, milestoneId]
```

**MilestoneLibrary table** (reference data, ~36 rows):
```javascript
MilestoneLibrary {
  id: UUID,
  key: string (unique),              // e.g. 'language_brown_stage1_semantic'
  category: string,                  // e.g. 'Language', 'Cognitive', 'Social'
  groupingStage: string,             // e.g. 'Brown Stage I'
  displayTitle: string,
  detectionMode: string,
  thresholdValue: int,               // sessions needed for EMERGING → ACHIEVED
  medianAgeMonths: int,
  mastery90AgeMonths: int,
  sourceReference: string,
  actionTip: string?
}
```

### Return Value

```javascript
{ detected: N, newEmerging: N, newAchieved: N }
```

---

## Phase 6: Report Generation & Competency Analysis

**File:** `server/services/pcitAnalysisService.cjs` (lines 955-1152)

### CDI Mode (Child-Directed Interaction) - Multi-Prompt Approach

**Orchestrator:** `generateCDIFeedback()` (lines 555-595)

The CDI feedback uses a two-prompt approach for higher quality output:

#### Prompt 1: Combined Feedback

**Function:** `generateCombinedFeedbackPrompt()` (lines 440-477)

Generates:
- Top moment identification (best interaction quote + utterance number)
- Warm, encouraging feedback (100 words max)
- Child's reaction insights
- Reminder about positive impact
- Example utterance number for highlighting

**Response Format:**
```javascript
{
  topMoment: { quote: "exact quote", utteranceNumber: 5 },
  Feedback: "personalized feedback paragraph",
  exampleUtteranceNumber: 7,
  ChildReaction: "insights about child's response",
  reminder: "encouraging reminder"
}
```

#### Prompt 2: Review Feedback

**Function:** `generateReviewFeedbackPrompt()` (lines 503-546)

Reviews and revises feedback for individual utterances and silence slots:

**Helper:** `formatUtterancesWithFeedback()` (lines 485-497)

**Response Format:**
```javascript
[
  { id: 3, feedback: "revised feedback", additional_tip: "extra coaching tip" },
  { id: 7, feedback: "revised feedback for silence slot" }
]
```

#### Database Update

**Function:** `updateRevisedFeedback()` (lines 1050-1051)

Saves revised feedback to individual utterance records with `additional_tip` field.

#### Final CDI Result
```javascript
competencyAnalysis = {
  topMoment: 'exact quote',
  topMomentUtteranceNumber: 5,
  feedback: 'paragraph',
  example: 7,  // utterance number
  childReaction: 'insights',
  reminder: 'encouragement',
  revisedFeedback: [...]  // array of per-utterance revisions
}
```

### PDI Mode (Parent-Directed Interaction)

**Function:** `generatePDICompetencyPrompt()` (lines 604-667)

Analyzes command effectiveness:
- Total Effective Commands: Direct + Positive + Specific
- Total Ineffective Commands: Indirect + Negative + Vague + Chained
- Target: 75%+ effective

**Additional PDI Fields:**
```javascript
{
  summary: 'brief session summary',
  celebration: 'what went well',
  transition: 'transition guidance',
  tips: 'improvement tips'
}
```

### Nora Score Calculation

**File:** `server/utils/scoreConstants.cjs`

**CDI Scoring:**
- Labeled Praise (goal: 10+)
- Reflections (goal: 10+)
- Behavioral Description (goal: 10+)
- Penalties for: Questions, Commands, Criticisms

**PDI Scoring:**
- Direct Commands (75%+ of total commands)
- Effective vs Ineffective command ratio

### Final Storage
```javascript
session.update({
  pcitCoding: { ... },
  tagCounts: { ... },
  competencyAnalysis: {
    topMoment: 'exact quote',
    topMomentUtteranceNumber: int,
    feedback: 'paragraph',
    example: int,
    childReaction: 'insights',
    tips: 'improvement tips',
    reminder: 'encouragement'
  },
  coachingCards: [...],           // From Phase 5 (coaching cards)
  overallScore: int,
  analysisStatus: 'COMPLETED'
})

// Separate tables:
ChildProfiling.upsert({
  userId, sessionId, childId: child.id,
  summary: '...',
  domains: [...],                 // 5 developmental domains
  metadata: { ... }               // session_metadata
})

// Non-blocking — errors do not affect session status:
detectAndUpdateMilestones(child.id, sessionId)
// → Creates/updates ChildMilestone records
```

---

## Phase 7: Report Retrieval

**Endpoint:** `GET /api/recordings/:id/analysis`

**File:** `server/routes/recordings.cjs` (lines 545-707)

### Status Handling
- `analysisStatus === 'FAILED'`: Return error
- No transcript: Return 202 "Transcription in progress"
- No PCIT coding: Return 202 "PCIT analysis in progress"
- `analysisStatus === 'COMPLETED'`: Return full report

### Report Structure
```javascript
{
  id: sessionId,
  mode: 'CDI' | 'PDI',
  durationSeconds: int,
  status: 'completed',
  noraScore: int,
  skills: [
    { label: 'Praise (Labeled)', progress: int },
    { label: 'Echo', progress: int },
    { label: 'Narrate', progress: int }
  ],
  areasToAvoid: [
    { label: 'Questions', count: int },
    { label: 'Commands', count: int },
    { label: 'Criticism', count: int }
  ],
  topMoment: 'exact quote',
  topMomentUtteranceNumber: int,
  feedback: 'personalized feedback',
  exampleIndex: int,
  childReaction: 'insights',
  tips: 'improvement tips',
  transcript: [ ... ],
  competencyAnalysis: { ... },
  developmentalObservation: {  // From ChildProfiling table (Phase 5)
    summary: 'developmental snapshot',
    domains: [
      {
        category: 'Language',
        framework: "Brown's Stages",
        developmental_status: '...',
        current_level: '...',
        benchmark_for_age: '...',
        detailed_observations: [{ insight: '...', evidence: '...' }]
      }
      // ... 5 domains
    ]
  },
  coachingCards: [  // From Session.coachingCards (Phase 5)
    {
      card_id: 1,
      title: 'actionable title',
      icon_suggestion: 'emoji',
      insight: '...',
      suggestion: '...',
      scenario: { context: '...', instead_of: '...', try_this: '...' }
    }
  ],
  // Backward compat (transforms from new data, or falls back to legacy fields):
  childPortfolioInsights: [...],
  aboutChild: [...]
}
```

---

## Phase 8: Phase Progression (CONNECT → DISCIPLINE)

**File:** `server/services/processingService.cjs` (lines 21-86)

### Purpose

Checks if user should advance from CONNECT phase to DISCIPLINE phase after completing a session.

### Criteria for Advancement

1. User is currently in CONNECT phase
2. Completed Day 15 of CONNECT lessons
3. Achieved a score of 100 in any session

### Process

1. After successful analysis completion, check progression criteria
2. If criteria met, update `user.currentPhase` to `DISCIPLINE`
3. Send celebration push notification to user

---

## Error Handling & Retry

**File:** `server/services/processingService.cjs`

### Automatic Retry Logic
- **Max Attempts:** 3
- **Delay Between Attempts:** 0s, 5s, 15s

### On Success
1. Update `session.analysisStatus: 'COMPLETED'`
2. Check phase progression (see Phase 9)
3. Send push notification "Your report is ready!"

### On Failure (all retries exhausted)
1. Update `session.analysisStatus: 'FAILED'`
2. Set `session.permanentFailure: true`
3. Send user failure notification
4. Auto-report to team via Slack webhook (lines 146-202)

### Slack Error Reporting
```javascript
{
  text: "Processing failed for session {id}",
  attachments: [{
    color: "danger",
    fields: [
      { title: "User", value: userId },
      { title: "Error", value: errorMessage },
      { title: "Retry Count", value: retryCount }
    ]
  }]
}
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `server/routes/recordings.cjs` | Upload & report API endpoints |
| `server/services/transcriptionService.cjs` | ElevenLabs transcription |
| `server/services/pcitAnalysisService.cjs` | Claude & Gemini analysis, DPICS coding, Child record creation |
| `server/services/milestoneDetectionService.cjs` | Gemini Flash milestone detection, EMERGING → ACHIEVED logic |
| `server/services/processingService.cjs` | Orchestration, retry logic, phase progression |
| `server/utils/utteranceUtils.cjs` | Utterance database operations |
| `server/utils/scoreConstants.cjs` | Nora score calculation |
| `server/prompts/roleIdentification.txt` | Speaker role detection prompt |
| `server/prompts/dpicsCoding.txt` | DPICS coding system prompt |
| `server/prompts/childProfiling.txt` | Child profiling & coaching cards prompt |
| `prisma/schema.prisma` | Database schema (Session, Utterance, Child, ChildProfiling, ChildMilestone, MilestoneLibrary) |
| `scripts/backfill-child-profiling.cjs` | Migration: re-run profiling + milestone detection on existing sessions |
| `scripts/migrate-child-records.cjs` | Migration: create Child records, backfill childId |

---

## Configuration Reference

| Setting | Value | Notes |
|---------|-------|-------|
| Transcription Mode | `TRANSCRIPTION_MODE` env var | `v1`, `v2` (default), or `two-pass` |
| ElevenLabs scribe_v1 | Better diarization | Used in `v1` and `two-pass` modes |
| ElevenLabs scribe_v2 | Better text quality | Used in `v2` and `two-pass` modes |
| Diarization Threshold | 0.1 | Speaker separation sensitivity |
| Divergence Threshold | 20% reassigned | Flags diarization mismatch in two-pass |
| Claude Model | `claude-sonnet-4-5-20250929` | Role ID, PCIT coding, CDI/PDI feedback |
| Gemini Model (Profiling) | `gemini-3-pro-preview` | Child profiling (Phase 5, streaming) |
| Gemini Model (Milestones) | `gemini-2.0-flash` | Milestone detection (Phase 5b, non-streaming) |
| Gemini Endpoint (Profiling) | Streaming (SSE) | Prevents timeout during thinking |
| Gemini Endpoint (Milestones) | Non-streaming `generateContent` | Fast model, no streaming needed |
| Gemini Timeout | 300,000ms (5 min) | Extended for reasoning model |
| Gemini Temp (Profiling) | 0.5 | Balanced creativity/consistency |
| Gemini Temp (Milestones) | 0.2 | Low temperature for consistent detection |
| Max Tokens (Profiling) | 8192 | Detailed analysis |
| Max Tokens (Milestones) | 4096 | Structured JSON response |
| Claude Temp (Coding) | 0 | Deterministic PCIT coding |
| Claude Temp (Feedback) | 0.7 | Creative feedback |

---

## Database Schema (Key Tables)

### Session Table
- **Basic info:** id, userId, mode, durationSeconds, createdAt
- **Processing:** analysisStatus (PENDING/PROCESSING/COMPLETED/FAILED)
- **Audio:** storagePath (S3 key), elevenLabsJson (raw transcription)
- **Analysis:** transcript, roleIdentificationJson, pcitCoding, competencyAnalysis
- **AI Insights:** coachingCards (from child profiling), childPortfolioInsights (legacy), aboutChild (legacy)
- **Scoring:** tagCounts, overallScore

### Child Table
- **Reference:** userId
- **Content:** name, birthday, gender, conditions
- **Relations:** → ChildProfiling[], ChildMilestone[]

### ChildProfiling Table
- **Reference:** userId, sessionId (unique), childId → Child
- **Content:** summary, domains (JSON — 5 developmental domain objects)
- **Metadata:** metadata (JSON — session_metadata from Gemini)

### ChildMilestone Table
- **Reference:** childId → Child, milestoneId → MilestoneLibrary
- **Unique constraint:** [childId, milestoneId]
- **Content:** status (EMERGING | ACHIEVED), firstObservedAt, achievedAt
- **Lifecycle:** Created as EMERGING on first detection → promoted to ACHIEVED after threshold sessions. First profiling also creates baseline ACHIEVED milestones for age-appropriate entries.

### MilestoneLibrary Table
- **Reference data:** ~36 rows, seeded
- **Content:** key (unique), category, groupingStage, displayTitle, detectionMode, thresholdValue, medianAgeMonths, mastery90AgeMonths, sourceReference, actionTip

### Utterance Table
- **Reference:** sessionId, order (sequence)
- **Content:** speaker, text, startTime, endTime
- **Classification:** role (adult/child), pcitTag, noraTag
- **Feedback:** feedback, additionalTip, revisedFeedback
