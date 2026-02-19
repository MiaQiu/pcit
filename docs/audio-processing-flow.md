# Audio Processing & Report Generation Flow

This document describes how recorded audio is processed and how reports are generated in the PCIT/Nora system.

## High-Level Pipeline

```
Audio Upload → Transcription (v1/v2/two-pass) → Speaker Identification → PCIT Coding → Developmental Profiling + CDI Coaching (parallel) → Milestone Detection → Report Generation
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
5. Child Profiling (parallel):
   ├─ 5a. Developmental Profiling (Claude Sonnet)
   └─ 5b. CDI Coaching Report (Gemini Pro → Claude Sonnet format)
    ↓
5c. Milestone Detection (Gemini Flash — non-blocking)
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
   - Accepts `mode` from request body (`'CDI'` or `'PDI'`, defaults to `'CDI'`)
   - Creates session record with the requested mode and `analysisStatus: PENDING`
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

1. AI analyzes each speaker's utterances to classify as `ADULT` or `CHILD`

2. **Classification Indicators:**
   - **Child:** Requests, emotional expressions, play vocabulary, approval-seeking
   - **Adult:** Commands, praise, teaching questions, behavior management

3. **API Call:** Via `callAI()` (routes to Gemini Flash or Claude Sonnet based on `AI_PROVIDER`):
   ```javascript
   callAI(roleIdentificationPrompt, { maxTokens: 2048, temperature: 0.3 })
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

AI codes parent/adult utterances using the DPICS (Dyadic Parent-Child Interaction Coding System):

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
Via `callAI()` (routes to Gemini Flash or Claude Sonnet based on `AI_PROVIDER`):
```javascript
callAI(userPrompt, {
  maxTokens: 8192,
  temperature: 0,  // Deterministic coding
  systemPrompt: dpicsSystemPrompt,
  responseType: 'array'
})
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

## Phase 5: Child Profiling & Coaching (Parallel)

**File:** `server/services/pcitAnalysisService.cjs`

Two independent AI calls run in parallel via `Promise.allSettled()`. Either can fail without blocking the other.

### Shared Helper: `buildProfilingVariables()`

Builds template variables used by both prompts:

| Variable | Source |
|----------|--------|
| `{{CHILD_NAME}}` | Decrypted `user.childName` |
| `{{CHILD_AGE_MONTHS}}` | Calculated from `childBirthday` / `childBirthYear` |
| `{{CHILD_GENDER}}` | `formatGender(user.childGender)` |
| `{{PRIMARY_ISSUE}}` | User-reported issues from `ChildIssuePriority` (e.g., "tantrums"), falls back to clinical level |
| `{{PRIMARY_STRATEGY}}` | Intervention strategy (e.g., "differential attention") |
| `{{PRIMARY_DETAILS}}` | Detail string with user-reported issues + WACB signals |
| `{{OTHER_ISSUES}}` | Formatted list of secondary priority issues |
| `{{SESSION_METRICS}}` | Tag counts from PCIT coding |
| `{{TRANSCRIPT}}` | Formatted via `formatUtterancesForPsychologist()` |

### Clinical Priority Data

Retrieved from `Child` + `ChildIssuePriority` tables:

```javascript
const clinicalPriority = {
  primaryIssue: child.primaryIssue,       // ClinicalLevel enum (e.g., DE_ESCALATE)
  primaryStrategy: child.primaryStrategy, // InterventionStrategy enum
  issuePriorities: [                      // From ChildIssuePriority table
    {
      priorityRank: 1,
      clinicalLevel: 'DE_ESCALATE',
      strategy: 'DIFFERENTIAL_ATTENTION',
      fromUserIssue: true,
      userIssues: '["tantrums"]',         // ← actual issue label used in prompts
      fromWacb: false,
      wacbQuestions: null,
      wacbScore: null
    }
  ]
};
```

### Phase 5a: Developmental Profiling

**Function:** `generateDevelopmentalProfiling()`

**Prompt File:** `server/prompts/developmentalProfiling.txt`

Produces developmental observations across 5 clinical domains using the Milestone Library framework.

**API Call:** Via `callAI()` (routes to Gemini Flash or Claude Sonnet based on `AI_PROVIDER`):
```javascript
callAI(prompt, { maxTokens: 8192, temperature: 0.5 })
```

**Output JSON:**
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
  }
}
```

**5 Developmental Domains:**

| Category | Clinical Framework |
|----------|--------------------|
| Language | Brown's Stages of Language Development |
| Cognitive | Piaget's Preoperational Stage / Brown's Concepts |
| Social | Halliday's Interactional Function |
| Emotional | Halliday's Personal Function / Emotional Regulation |
| Connection | Biringen's Emotional Availability Scales |

### Phase 5b: CDI Coaching Report (Gemini Pro → callAI format)

**Function:** `generateCdiCoaching()`

**Prompt Files:**
- `server/prompts/cdiCoaching.txt` — Gemini Pro generates free-form coaching report
- `server/prompts/cdiCoachingFormat.txt` — `callAI()` formats into sections

**Two-step process:**

1. **Gemini Pro** (streaming, unchanged) generates a free-form coaching report (~200 words):
   ```javascript
   callGeminiStreaming([userMessage], {
     temperature: 0.5,
     maxOutputTokens: 8192,
     timeout: 300000  // 5 minutes
   })
   ```

2. **callAI()** selects sections from the report, adds formatting (`**bold**`, `•` bullets), and extracts tomorrow's goal:
   ```javascript
   callAI(formatPrompt, { maxTokens: 2048, temperature: 0 })
   ```

**Formatting output:**
```javascript
{
  "sections": [
    { "title": "Session Overview", "content": "Formatted text with **bold** and • bullets" },
    { "title": "What Went Well", "content": "..." },
    { "title": "Area to Improve", "content": "..." }
  ],
  "tomorrowGoal": "Give 5 specific praises (e.g., ...)"
}
```

### Parallel Execution

```javascript
const [profilingSettled, coachingSettled] = await Promise.allSettled([
  generateDevelopmentalProfiling(utterances, childInfo, tagCounts, childSpeaker),
  generateCdiCoaching(utterances, childInfo, tagCounts, childSpeaker)
]);
// Merge results — either can succeed independently
childProfilingResult = {
  developmentalObservation: profilingResult?.developmentalObservation || null,
  metadata: profilingResult?.metadata || null,
  coachingSummary: coachingResult?.coachingSummary || null,
  coachingCards: coachingResult?.coachingCards || null,
  tomorrowGoal: coachingResult?.tomorrowGoal || null
};
```

### Child Record Creation

Before saving profiling results, the pipeline finds or creates a `Child` record:

```javascript
let child = await prisma.child.findFirst({ where: { userId } });
if (!child) {
  child = await prisma.child.create({
    data: { userId, name: childName, birthday, gender, conditions }
  });
}
```

### Database Storage

**ChildProfiling table** (one row per session — from developmental profiling):
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

**Session fields** (from CDI coaching):
```javascript
session.coachingSummary = "Full Gemini coaching report text"
session.coachingCards = {
  sections: [                         // Claude-formatted sections
    { title: "Section Title", content: "Formatted **markdown** text" }
  ],
  tomorrowGoal: "Specific goal for next session"
}
```

### Backward Compatibility

The report endpoint handles both new and legacy `coachingCards` formats:
- **New format:** `coachingCards.sections` (object with sections array)
- **Legacy format:** `coachingCards` (flat array of CoachingCard objects)

Old mobile app transforms:
- `childPortfolioInsights` ← derived from legacy `coachingCards` via `transformCoachingCardsToPortfolioInsights()`
- `aboutChild` ← derived from `childProfiling.domains` via `transformDomainsToAboutChild()`

### Configuration

Requires `GEMINI_API_KEY` (always needed for coaching and milestones). When `AI_PROVIDER=claude-sonnet`, also requires `ANTHROPIC_API_KEY`. Each call degrades gracefully if its key is missing.

---

## Phase 5c: Milestone Detection (Gemini Flash — Non-Blocking)

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
- The profiling `domains` JSON (from Phase 5a)
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

PDI sessions run the **same CDI multi-prompt feedback flow** above (top moment, revised utterance feedback, etc.), then additionally run a **Two Choices Flow analysis**.

#### PDI Two Choices Flow Analysis

**Function:** `generatePDITwoChoicesAnalysis()` in `pcitAnalysisService.cjs`

**Prompt File:** `server/prompts/pdiTwoChoicesFlow.txt`

Evaluates the parent on 4 discipline skills from the "Two Choices Flow" framework (Command → Wait → Choice → Wait → Follow-Through):

| Skill | What It Measures |
|-------|-----------------|
| **Effective Commands** | Clear, direct, positively-stated, age-appropriate commands |
| **Wait Time** | ~5 second pause after commands/choices before escalating |
| **Choice Delivery** | Calm, structured "You can [comply] or [consequence]" |
| **Follow-Through** | Consistent, calm enforcement of stated consequences |

**Response Format:**
```javascript
{
  "pdiSkills": [
    {
      "skill": "Effective Commands",
      "performance": "Good",        // Excellent | Good | Fair | Needs Practice | Not Observed
      "feedback": "Your commands were mostly clear and direct.",
      "details": "specific transcript references"
    },
    // ... 4 skills total
  ]
}
```

**Storage:** Saved to `session.competencyAnalysis.pdiSkills` (nested in existing JSON field — no schema migration needed).

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
    reminder: 'encouragement',
    // PDI sessions only:
    pdiSkills: [
      { skill: 'Effective Commands', performance: 'Good', feedback: '...', details: '...' },
      { skill: 'Wait Time', performance: 'Excellent', feedback: '...', details: '...' },
      { skill: 'Choice Delivery', performance: 'Excellent', feedback: '...', details: '...' },
      { skill: 'Follow-Through', performance: 'Fair', feedback: '...', details: '...' }
    ]
  },
  coachingCards: { sections: [...], tomorrowGoal: '...' },  // From Phase 5b (CDI coaching)
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
  pdiSkills: [...] | null,       // PDI Two Choices Flow (4 skills) — null for CDI
  developmentalObservation: {  // From ChildProfiling table (Phase 5a)
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
  coachingCards: [  // From Session.coachingCards (Phase 5b)
    // New format: formatted coaching sections
    { title: 'Section Title', content: 'Formatted **markdown** text with • bullets' }
    // Legacy format: structured CoachingCard objects (for older sessions)
  ],
  // Backward compat (transforms from new data, or falls back to legacy fields):
  childPortfolioInsights: [...],
  aboutChild: [...]
}
```

---

## Phase 8: Discipline Mode Gating & Phase Progression

### Discipline Mode Unlock (Client-Side Gating)

**Files:** `server/routes/auth.cjs` (`GET /api/auth/me`), `nora-mobile/src/components/RecordingGuideCard.tsx`, `nora-mobile/src/screens/RecordScreen.tsx`

The Discipline recording tab on the Record screen is locked until the user achieves a qualifying Connection (CDI) session.

**Unlock Criterion:** `overallScore >= 80` in any completed CDI session.

**Server:** The `GET /api/auth/me` endpoint queries for a qualifying session and includes `disciplineUnlocked: boolean` in the response:

```javascript
const hasQualifyingScore = await prisma.session.findFirst({
  where: { userId, mode: 'CDI', overallScore: { gte: 80 }, analysisStatus: 'COMPLETED' },
  select: { id: true }
});
// Added to response: disciplineUnlocked: !!hasQualifyingScore
```

**Mobile:** `RecordingGuideCard` reads `user.disciplineUnlocked` from the `/api/auth/me` response. When locked, a lock overlay is shown with the message: "Reach a Nora Score of 80 in a single Connection session to unlock Discipline coaching." The Record button is also disabled when discipline is selected but locked.

### Phase Progression (CONNECT → DISCIPLINE)

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
| `server/routes/recordings.cjs` | Upload (accepts `mode` from client) & report API endpoints |
| `server/routes/auth.cjs` | Auth endpoints; `/me` returns `disciplineUnlocked` |
| `nora-mobile/src/contexts/UploadProcessingContext.tsx` | Manages upload state; passes `mode` to server |
| `server/services/transcriptionService.cjs` | ElevenLabs transcription |
| `server/services/pcitAnalysisService.cjs` | AI analysis (`callAI()` routes to Gemini Flash/Claude Sonnet via `AI_PROVIDER`), DPICS coding, Child record creation |
| `server/services/milestoneDetectionService.cjs` | Gemini Flash milestone detection, EMERGING → ACHIEVED logic |
| `server/services/processingService.cjs` | Orchestration, retry logic, phase progression |
| `server/utils/utteranceUtils.cjs` | Utterance database operations |
| `server/utils/scoreConstants.cjs` | Nora score calculation |
| `server/prompts/roleIdentification.txt` | Speaker role detection prompt |
| `server/prompts/dpicsCoding.txt` | DPICS coding system prompt |
| `server/prompts/developmentalProfiling.txt` | Developmental profiling prompt (5 clinical domains + milestone library) |
| `server/prompts/cdiCoaching.txt` | CDI coaching report prompt (free-form, Gemini) |
| `server/prompts/cdiCoachingFormat.txt` | Coaching report formatting prompt (section selection, Claude) |
| `server/prompts/pdiTwoChoicesFlow.txt` | PDI Two Choices Flow discipline analysis prompt |
| `prisma/schema.prisma` | Database schema (Session, Utterance, Child, ChildProfiling, ChildMilestone, MilestoneLibrary) |
| `scripts/backfill-child-profiling.cjs` | Migration: re-run profiling + milestone detection on existing sessions |
| `scripts/migrate-child-records.cjs` | Migration: create Child records, backfill childId |

---

## Configuration Reference

| Setting | Value | Notes |
|---------|-------|-------|
| **Transcription** | | |
| Transcription Mode | `TRANSCRIPTION_MODE` env var | `v1`, `v2` (default), or `two-pass` |
| ElevenLabs scribe_v1 | Better diarization | Used in `v1` and `two-pass` modes |
| ElevenLabs scribe_v2 | Better text quality | Used in `v2` and `two-pass` modes |
| Diarization Threshold | 0.1 | Speaker separation sensitivity |
| Divergence Threshold | 20% reassigned | Flags diarization mismatch in two-pass |
| **AI Provider** | | |
| `AI_PROVIDER` env var | `gemini-flash` (default) or `claude-sonnet` | Controls 6 analysis calls via `callAI()` |
| Gemini Flash Model | `gemini-2.0-flash` | Used when `AI_PROVIDER=gemini-flash` (default) |
| Claude Sonnet Model | `claude-sonnet-4-5-20250929` | Used when `AI_PROVIDER=claude-sonnet` |
| **Fixed Models (not affected by AI_PROVIDER)** | | |
| Gemini Pro (Coaching) | `gemini-3-pro-preview` | CDI coaching report (Phase 5b, streaming) |
| Gemini Flash (Milestones) | `gemini-2.0-flash` | Milestone detection (Phase 5c, non-streaming) |
| **Endpoints** | | |
| Gemini Endpoint (Coaching) | Streaming (SSE) | Prevents timeout during thinking |
| Gemini Endpoint (Milestones) | Non-streaming `generateContent` | Fast model, no streaming needed |
| Gemini Endpoint (callAI) | Non-streaming `generateContent` | Used for 6 analysis calls |
| **Temperature / Token Settings** | | |
| Gemini Timeout (Coaching) | 300,000ms (5 min) | Extended for reasoning model |
| Temp (Role ID) | 0.3 | Via `callAI()` |
| Temp (PCIT Coding) | 0 | Deterministic coding, via `callAI()` |
| Temp (Dev Profiling) | 0.5 | Balanced creativity/consistency, via `callAI()` |
| Temp (Coaching Format) | 0 | Deterministic formatting, via `callAI()` |
| Temp (Combined Feedback) | 0.7 | Creative feedback, via `callAI()` |
| Temp (Review Feedback) | 0.5 | Via `callAI()` |
| Temp (PDI Two Choices) | 0.7 | Via `callAI()` |
| Temp (Gemini Pro Coaching) | 0.5 | Fixed, not via `callAI()` |
| Temp (Milestones) | 0.2 | Fixed, not via `callAI()` |
| Max Tokens (Role ID) | 2048 | Via `callAI()` |
| Max Tokens (PCIT Coding) | 8192 | Via `callAI()` |
| Max Tokens (Dev Profiling) | 8192 | Via `callAI()` |
| Max Tokens (Coaching Format) | 2048 | Via `callAI()` |
| Max Tokens (Gemini Pro Coaching) | 8192 | Fixed |
| Max Tokens (Milestones) | 4096 | Fixed |

---

## Database Schema (Key Tables)

### Session Table
- **Basic info:** id, userId, mode, durationSeconds, createdAt
- **Processing:** analysisStatus (PENDING/PROCESSING/COMPLETED/FAILED)
- **Audio:** storagePath (S3 key), elevenLabsJson (raw transcription)
- **Analysis:** transcript, roleIdentificationJson, pcitCoding, competencyAnalysis
- **AI Insights:** coachingSummary (full coaching report text), coachingCards (formatted sections + tomorrowGoal JSON), childPortfolioInsights (legacy), aboutChild (legacy)
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
