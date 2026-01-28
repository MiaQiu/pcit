# Audio Processing & Report Generation Flow

This document describes how recorded audio is processed and how reports are generated in the PCIT/Nora system.

## High-Level Pipeline

```
Audio Upload → Transcription → Speaker Identification → PCIT Coding → Psychologist Feedback → Report Generation
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
5. Psychologist Feedback (Gemini)
    ↓
6. Child Portfolio Insights (Gemini - Multi-turn)
    ↓
7. About Child Observations (Claude)
    ↓
8. Report Generation & CDI/PDI Feedback
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

### Steps

1. **Download Audio:** Fetch audio file from S3 using AWS SDK (`GetObjectCommand`)

2. **ElevenLabs Transcription:**
   - API Endpoint: `https://api.elevenlabs.io/v1/speech-to-text?include_timestamps=true`
   - Model: `scribe_v2`
   - Features: Speaker diarization enabled, word-level timestamps

   ```javascript
   FormData {
     file: audioBuffer,
     model_id: 'scribe_v2',
     diarize: 'true',
     diarization_threshold: 0.1,
     temperature: 0,
     timestamps_granularity: 'word',
     keyterms: [childName]
   }
   ```

3. **Parse & Store:**
   - Store raw JSON to `session.elevenLabsJson`
   - Parse utterances with `parseElevenLabsTranscript()`
   - Create formatted transcript text
   - Update `session.transcript` and `session.transcribedAt`

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

## Phase 5: Psychologist Feedback (Gemini)

**File:** `server/services/pcitAnalysisService.cjs` (lines 247-308)

**Function:** `generatePsychologistFeedback()`

### Purpose

Provides child psychology insights by analyzing the play session transcript through Google's Gemini AI model (thinking/reasoning model).

### Streaming Infrastructure

**Function:** `callGeminiStreaming()` (lines 113-218)

Due to the Gemini 3 Pro Preview model's extended thinking time (30-60 seconds of silent reasoning), the system uses streaming to prevent connection timeouts:

```javascript
// Streaming endpoint for thinking models
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:streamGenerateContent?alt=sse

// Configuration
{
  timeout: 300000,  // 5-minute timeout for complex analysis
  responseType: 'stream'
}
```

### Child Information Used

The system retrieves child data from the User model:
- **childName:** Decrypted from encrypted storage
- **childAge:** Calculated from `childBirthYear` or `childBirthday` (years)
- **childAgeMonths:** Precise age in months for younger children
- **childGender:** From enum (BOY, GIRL, OTHER) → formatted as "boy", "girl", "child"

### Helper Functions (lines 31-89)

```javascript
calculateChildAge(user)        // Returns age in years
calculateChildAgeInMonths(user) // Returns precise age in months
getChildSpeaker(roleJson)      // Extracts child speaker ID
formatGender(gender)           // Converts enum to readable text
formatUtterancesForPsychologist(utterances, childSpeaker) // Format for prompt
```

### Prompt Structure

```
This is the transcript from a 5-minute parent-child play session.
The child is {name}, a {ageMonths} month old {gender}.

**Transcript:**
{formatted utterances with speaker roles and PCIT tags}

**Session Metrics:**
{tagCounts summary}

As a child psychologist, please provide:
1. Feedback for Parents
2. Child Observations
3. Recommendations
```

### API Call
```javascript
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:streamGenerateContent?alt=sse
{
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 8192
  }
}
```

### Response Format
```javascript
{
  parentFeedback: "Constructive feedback on parent's interaction style...",
  childObservations: "Observations about child's behavior, communication, engagement...",
  recommendations: "Specific suggestions to enhance parent-child relationship...",
  childAge: 3,
  childGender: "boy",
  generatedAt: "2024-01-15T10:30:00.000Z"
}
```

### Return Value

Returns chat history array for multi-turn conversation in Phase 5b:
```javascript
[
  { role: 'user', parts: [{ text: initialPrompt }] },
  { role: 'model', parts: [{ text: psychologistResponse }] }
]
```

### Configuration

Requires `GEMINI_API_KEY` environment variable. If not configured, this phase is skipped gracefully.

---

## Phase 5b: Child Portfolio Insights (Gemini Multi-turn)

**File:** `server/services/pcitAnalysisService.cjs` (lines 310-430)

**Function:** `extractChildPortfolioInsights()`

### Purpose

Extracts detailed, actionable insights from the psychologist feedback using a multi-turn conversation approach. This builds on the chat history from Phase 5.

### Input

Takes the chat history array from Phase 5 (psychologist feedback) as input, continuing the conversation.

### Prompt (added to conversation)
```
we are building child portfolio. extract insights from the report.
1-3 key points about the child.
1-3 points for the parent to improve.
only pick the ones are most valuable and insightful. (if none, keep blank).
keep short and concise for mobile display.
```

### API Call (Multi-turn)
```javascript
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:streamGenerateContent?alt=sse
{
  contents: [
    ...previousChatHistory,
    { role: 'user', parts: [{ text: portfolioPrompt }] }
  ],
  generationConfig: {
    temperature: 0.3,  // Lower for consistency
    maxOutputTokens: 4096
  }
}
```

### Response Format
```javascript
[
  {
    "id": 1,
    "suggested_change": "Use more Labeled Praises",
    "analysis": "You used several unlabeled praises like 'Good job!' which are positive but less impactful...",
    "example_scenario": {
      "child": "(Builds a tall tower)",
      "parent": "Wow, you stacked those blocks so carefully! (Instead of: 'Good job!')"
    }
  },
  {
    "id": 2,
    "suggested_change": "Add more Behavioral Descriptions",
    "analysis": "Narrating what your child is doing helps them feel seen...",
    "example_scenario": {
      "child": "(Drives toy car around)",
      "parent": "You're driving the red car around the track!"
    }
  }
]
```

### Database Storage

Stored in dedicated `session.childPortfolioInsights` field:

```javascript
session.childPortfolioInsights = [
  {
    id: 1,
    suggested_change: "Use more Labeled Praises",
    analysis: {
      observation: "...",
      impact: "...",
      result: "..."
    },
    example_scenario: { child: "...", parent: "..." }
  },
  // ... more insights
]
```

---

## Phase 5c: About Child Observations (Claude)

**File:** `server/services/pcitAnalysisService.cjs` (lines 437-543)

**Function:** `extractAboutChild()`

### Purpose

Extracts child-specific observations from the psychologist feedback to build a "child portfolio" - insights about the child's development, behavior patterns, and characteristics.

### Input

Takes the chat history array from Phase 5 (psychologist feedback) and extracts the model's response text.

### Prompt Structure

```
You are analyzing a child psychologist's feedback from a parent-child play session.

Extract ONLY the "Observations of the Child" section - the insights about the child's
behavior, development, and characteristics observed during the session.

Format the observations as a JSON array, ranked by importance/significance.
```

### API Call
```javascript
POST https://api.anthropic.com/v1/messages
{
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 4096,
  temperature: 0.3
}
```

### Response Format
```javascript
[
  {
    "id": 1,
    "Title": "Little Scientist",
    "Description": "Bobby was exploring physics (gravity/pouring). He wasn't trying to be messy.",
    "Details": "His persistent desire to 'pour' reflects a 3-year-old's natural curiosity about cause and effect..."
  },
  {
    "id": 2,
    "Title": "Sensory Seeker",
    "Description": "Bobby loves the 'squishy' texture today!",
    "Details": "He is very focused on the tactile nature of the vitamins—calling them 'squishy, squishy'..."
  }
]
```

### Database Storage

Stored in dedicated `session.aboutChild` field:

```javascript
session.aboutChild = [
  { id: 1, Title: "...", Description: "...", Details: "..." },
  // ... more observations
]
```

---

## Phase 7: Report Generation & Competency Analysis

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
  childPortfolioInsights: [...],  // From Phase 5b (Coach's Corner tips)
  aboutChild: [...],              // From Phase 5c (child observations)
  overallScore: int,
  analysisStatus: 'COMPLETED'
})
```

---

## Phase 8: Report Retrieval

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
  childPortfolioInsights: [  // Coach's Corner tips (from Phase 5b)
    {
      id: 1,
      suggested_change: 'suggestion',
      analysis: { observation: '...', impact: '...', result: '...' },
      example_scenario: { child: '...', parent: '...' }
    }
  ],
  aboutChild: [  // Child observations (from Phase 5c)
    {
      id: 1,
      Title: 'Little Scientist',
      Description: 'short summary',
      Details: 'detailed explanation'
    }
  ]
}
```

---

## Phase 9: Phase Progression (CONNECT → DISCIPLINE)

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
| `server/services/pcitAnalysisService.cjs` | Claude & Gemini analysis, DPICS coding |
| `server/services/processingService.cjs` | Orchestration, retry logic, phase progression |
| `server/utils/utteranceUtils.cjs` | Utterance database operations |
| `server/utils/scoreConstants.cjs` | Nora score calculation |
| `server/prompts/roleIdentification.txt` | Speaker role detection prompt |
| `server/prompts/dpicsCoding.txt` | DPICS coding system prompt |
| `prisma/schema.prisma` | Database schema (Session, Utterance) |

---

## Configuration Reference

| Setting | Value | Notes |
|---------|-------|-------|
| Claude Model | `claude-sonnet-4-5-20250929` | Role ID, PCIT coding, CDI/PDI feedback |
| Gemini Model | `gemini-3-pro-preview` | Psychologist feedback, portfolio insights |
| Gemini Endpoint | Streaming (SSE) | Prevents timeout during thinking |
| Gemini Timeout | 300,000ms (5 min) | Extended for reasoning model |
| Gemini Temp (Psych) | 0.7 | Creative feedback |
| Gemini Temp (Portfolio) | 0.3 | Consistent extraction |
| Max Tokens (Psych) | 8192 | Detailed analysis |
| Max Tokens (Portfolio) | 4096 | Structured insights |
| Claude Temp (Coding) | 0 | Deterministic PCIT coding |
| Claude Temp (Feedback) | 0.7 | Creative feedback |

---

## Database Schema (Key Tables)

### Session Table
- **Basic info:** id, userId, mode, durationSeconds, createdAt
- **Processing:** analysisStatus (PENDING/PROCESSING/COMPLETED/FAILED)
- **Audio:** storagePath (S3 key), elevenLabsJson (raw transcription)
- **Analysis:** transcript, roleIdentificationJson, pcitCoding, competencyAnalysis
- **AI Insights:** childPortfolioInsights (Coach's Corner), aboutChild (child observations)
- **Scoring:** tagCounts, overallScore
- **Error tracking:** analysisError, analysisFailedAt, permanentFailure, retryCount

### Utterance Table
- **Reference:** sessionId, order (sequence)
- **Content:** speaker, text, startTime, endTime
- **Classification:** role (adult/child), pcitTag, noraTag
- **Feedback:** feedback, additionalTip, revisedFeedback
