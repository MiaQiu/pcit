# Nora — Low Level Design

**Version:** 1.1  
**Date:** 2026-05-15  
**Project:** PCIT / Nora — AI-powered Parent-Child Interaction Therapy coaching app

---

## 1. System Overview

Nora helps parents practice PCIT (Parent-Child Interaction Therapy) at home. Parents record play sessions with their child, and the system transcribes the audio, codes behaviour per PCIT methodology (CDI/PDI), generates structured feedback, and tracks skill mastery over time.

### 1.1 Top-Level Component Map

```
┌───────────────────────────────────────────────────────────────────┐
│  Clients                                                          │
│  ┌──────────────────┐   ┌───────────────────────────────────────┐ │
│  │  Nora Mobile     │   │  Admin Portal (React + Vite)          │ │
│  │  (React Native / │   │  admin.hinora.co                      │ │
│  │   Expo)          │   │  Clinician oversight, report review,  │ │
│  │  iOS + Android   │   │  chat intervention                    │ │
│  └────────┬─────────┘   └──────────────────┬────────────────────┘ │
└───────────┼──────────────────────────────────┼────────────────────┘
            │ HTTPS/REST                        │ HTTPS/REST
            ▼                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│  API Server  (Node.js / Express — server.cjs)                     │
│  AWS App Runner · prod: ap-southeast-1 · dev: us-east-1          │
│                                                                   │
│  Routes: auth, sessions, recordings, coach, lessons, modules,     │
│          learning, surveys, support, referral, webhooks, admin    │
│  Middleware: requireAuth (JWT), rate-limit, helmet, CORS          │
│  LLM Gateway → Claude Sonnet 4.6 (prod primary) /                │
│               Gemini 2.0 Flash (dev primary) / fallback each way  │
│  Services: processing, pcitAnalysis, enrichment, milestone,       │
│            weeklyReport, translation, textInputEvaluation         │
└──────┬────────────┬────────────┬────────────────────┬────────────┘
       │            │            │                    │
       ▼            ▼            ▼                    ▼
 PostgreSQL      AWS S3       ElevenLabs          RevenueCat
  (Prisma)      Audio         Scribe v2           Webhooks
  AWS RDS       Storage       Transcription       Subscription
  (per-region)  (per-region)  Service             Events
```

---

## 2. Repository Layout

```
pcit/
├── server.cjs                  # Express entry point
├── server/
│   ├── routes/                 # One file per resource domain
│   │   ├── auth.cjs            # Login, register, refresh, social
│   │   ├── recordings.cjs      # Upload, status, delete
│   │   ├── sessions.cjs        # Session CRUD, feedback
│   │   ├── coach.cjs           # AI coach chat (long-poll)
│   │   ├── lessons.cjs         # Lesson content delivery
│   │   ├── modules.cjs         # Module listing
│   │   ├── learning.cjs        # Progress, weekly reports
│   │   ├── admin.cjs           # Admin-only endpoints
│   │   ├── webhooks.cjs        # RevenueCat webhook
│   │   └── ...
│   ├── services/
│   │   ├── processingService.cjs       # Audio pipeline orchestrator
│   │   ├── transcriptionService.cjs    # ElevenLabs wrapper
│   │   ├── pcitAnalysisService.cjs     # PCIT coding via LLM
│   │   ├── enrichmentRepairService.cjs # Post-analysis enrichment
│   │   ├── milestoneDetectionService.cjs
│   │   ├── weeklyReportService.cjs
│   │   ├── recommendationService.cjs
│   │   ├── priorityEngine.cjs
│   │   ├── chatBus.cjs                 # Long-poll pub/sub
│   │   ├── agentBus.cjs                # In-flight LLM abort registry
│   │   ├── pushNotifications.cjs
│   │   └── storage.cjs / storage-s3.cjs
│   ├── llm/
│   │   ├── gateway.cjs                 # Single LLM entry point
│   │   ├── models.cjs                  # Model registry + routing
│   │   ├── providers/
│   │   │   ├── gemini.cjs
│   │   │   └── anthropic.cjs
│   │   ├── logger.cjs
│   │   ├── repair.cjs                  # jsonrepair fallback
│   │   └── sanitize.cjs
│   ├── middleware/
│   ├── prompts/                        # LLM prompt templates
│   ├── utils/
│   └── jobs/
├── nora-mobile/                # React Native (Expo) app
│   ├── App.tsx
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── navigation/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── ...
├── admin/                      # React + Vite admin portal
├── prisma/
│   └── schema.prisma
├── python-services/
│   └── diarization/            # Speaker diarization ML service
└── scripts/                    # One-off operational scripts
```

---

## 3. Authentication Subsystem

### 3.1 Token Model

| Token | Storage | TTL | Algorithm |
|-------|---------|-----|-----------|
| Access JWT | Mobile memory / HTTP header | 180d (`JWT_ACCESS_EXPIRY`) | HS256, `JWT_ACCESS_SECRET` |
| Refresh token | `RefreshToken` table (hash only) | 180d (`JWT_REFRESH_EXPIRY`) | SHA-256 stored |
| Password reset | `PasswordResetToken` table | 1 hour | random UUID, `used` flag |

### 3.2 Authentication Flow

```
Mobile                     Server                  DB
  │                           │                     │
  │── POST /api/auth/login ──►│                     │
  │   { email, password }     │                     │
  │                           │── SELECT User ─────►│
  │                           │◄── User record ─────│
  │                           │ bcrypt.compare()     │
  │                           │── UPSERT RefreshToken►│
  │◄── { accessToken,         │                     │
  │      refreshToken }       │                     │
  │                           │                     │
  │── GET /api/* ────────────►│                     │
  │   Authorization: Bearer   │ verify JWT          │
  │   <accessToken>           │ attach req.user      │
```

- `requireAuth` middleware: verifies JWT, injects `req.user = { id, email, subscriptionStatus, ... }`
- Social auth (Google/Apple) handled via `social-auth.cjs`; generates same JWT pair on success

### 3.3 Password Security

- Hash: `bcrypt`, cost factor **12**
- Reset: time-limited token emailed; single-use via `used` flag

---

## 4. Audio Recording & Processing Pipeline

### 4.1 End-to-End Flow

```
Mobile                     Server                 External Services
  │                           │                         │
  │  1. Record audio locally  │                         │
  │     (expo-av)             │                         │
  │                           │                         │
  │─ POST /api/recordings ───►│                         │
  │  multipart/form-data      │                         │
  │  { audio, mode, duration }│                         │
  │                           │─ Upload to GCS/S3 ─────►│
  │                           │  storagePath recorded   │
  │                           │─ INSERT Session ────────►DB
  │                           │  analysisStatus=PENDING │
  │◄── { sessionId } ─────────│                         │
  │                           │                         │
  │  2. Polling / Push        │                         │
  │                           │ [async background job]  │
  │                           │─ ElevenLabs Scribe v2 ──►│
  │                           │◄─ transcript JSON ───────│
  │                           │─ UPDATE Session ─────────►DB
  │                           │  transcribedAt, status  │
  │                           │                         │
  │                           │─ pcitAnalysisService ──►│
  │                           │  LLM Gateway (Gemini)   │
  │                           │◄─ pcitCoding, tags ──────│
  │                           │─ enrichmentService ─────►│
  │                           │  coachingCards, etc.    │
  │                           │─ milestoneDetection ────►│
  │                           │─ UPDATE Session ─────────►DB
  │                           │  analysisStatus=COMPLETED│
  │                           │                         │
  │                           │─ Push notification ─────►│
  │◄── "Report ready" push ───│  Expo push service      │
```

### 4.2 Session Analysis Status Machine

```
PENDING → PROCESSING → COMPLETED
                    ↘ FAILED (retryCount < max → retry with backoff)
                              ↘ permanentFailure = true
```

Retry logic in `processingService.cjs`: exponential backoff, max 3 retries. On permanent failure: DB flag set + user push notification + team email alert.

### 4.3 PCIT Coding Tags

| Tag | Meaning | Mode |
|-----|---------|------|
| `PRAISE` | Labelled or unlabelled praise | CDI |
| `ECHO` | Verbal imitation | CDI |
| `NARRATE` | Behavioural description | CDI |
| `CORRECTIONS` | Unnecessary correction | CDI |
| `LEADING` | Leading question | CDI |
| `COMMAND` | Direct/indirect command | PDI |

`pcitCoding` JSON stores per-utterance tags. `tagCounts` JSON is the roll-up summary used for charts.

### 4.4 Enrichment Pipeline

After core PCIT coding, `enrichmentRepairService` runs additional LLM passes:
- `coachingSummary` — narrative paragraph
- `coachingCards` — swipeable card content
- `milestoneCelebrations` — milestone unlocks to display
- `childPortfolioInsights` — child development snapshot
- `aboutChild` — inferred child profile

`enrichmentStatus` tracks: `PENDING → COMPLETED | PARTIAL | FAILED`

---

## 5. LLM Gateway

### 5.1 Model Registry (`server/llm/models.cjs`)

The default model for all gateway calls is set by `AI_PROVIDER` env var:
- **Prod**: `AI_PROVIDER=claude-sonnet-4-6` → Claude Sonnet 4.6 is the primary for every call
- **Dev**: `AI_PROVIDER` unset → defaults to `gemini-2.0-flash`

`FALLBACK_MODEL` (defaults to `claude-sonnet-4-6`) is used when the primary fails all retries. `GEMINI_STREAMING_MODEL` (defaults to `gemini-3.1-pro-preview`) overrides the model for streaming calls (CDI/PDI coaching).

| Key | Primary Model | Fallback |
|-----|--------------|---------|
| `gemini-2.0-flash` (dev default) | `gemini-2.0-flash` | `claude-sonnet-4-6` |
| `claude-sonnet-4-6` (prod default) | `claude-sonnet-4-6` | — |
| `gemini-3.1-pro-preview` (streaming) | `gemini-3.1-pro-preview` | `FALLBACK_MODEL` |

### 5.2 Call Lifecycle

```
llmCall(prompt, options)
  │
  ├─ resolveModel(key) → { primary, fallback, provider }
  │
  ├─ attempt primary (up to 3 retries, 1s / 2s backoff)
  │    ├─ Gemini: structured output via responseSchema (OpenAPI subset)
  │    │          prevents malformed JSON at token level
  │    └─ Claude: Anthropic Messages API
  │
  ├─ on all retries exhausted → switch to fallback model
  │
  ├─ JSON parsing: JSON.parse → jsonrepair fallback
  │
  ├─ sanitize output (PII scrub, length checks)
  │
  └─ logLLMCall({ model, latency, tokens, flags })
```

### 5.3 Streaming (Coach Chat)

`geminiStreamCall` used for coach chat SSE. `agentBus.cjs` holds `AbortController` refs per `userId` so the admin portal can abort an in-flight generation.

---

## 6. AI Coaching Chat

### 6.1 Architecture

```
Mobile                    Server                     LLM
  │                          │                        │
  │─ GET /api/coach/history ►│── DB query ───────────►DB
  │◄─ [{role, text, ts}] ────│                        │
  │                          │                        │
  │─ POST /api/coach/chat ──►│                        │
  │  { message }             │                        │
  │                          │─ build context ────────►│
  │                          │  (sessions, child data)│
  │                          │─ geminiStreamCall ─────►│
  │                          │◄─ token stream ─────────│
  │                          │─ chatBus.publish() ─────►long-poll subscribers
  │                          │─ INSERT CoachChatMessage►DB
  │◄─ GET /api/coach/events  │                        │
  │   (long-poll, 25s hold)  │                        │
```

### 6.2 Long-Poll Protocol

- Client sends `GET /api/coach/events?since=<ISO>` after each message
- Server checks DB for rows newer than `since`; if found, returns immediately
- If not found, subscribes to `chatBus` and holds connection up to 25 seconds
- Client immediately re-polls on each received event

### 6.3 Context Window Construction

System prompt includes:
- User's child name, conditions, age
- Last N PCIT sessions (tag counts, mastery status)
- Current lesson progress
- Recent coaching chat history (sliding window)

---

## 7. Learning System

### 7.1 Content Model

```
Module (e.g. FOUNDATION, COOPERATION)
  └── Lesson (dayNumber within module)
        ├── LessonSegment[] (ordered content blocks)
        │     ContentType: TEXT | EXAMPLE | TIP | SCRIPT | CALLOUT | TEXT_INPUT
        └── Quiz (one per lesson, optional)
              └── QuizOption[] (multiple choice)
```

### 7.2 Progress Tracking

```
UserLessonProgress
  userId + lessonId (unique)
  status: NOT_STARTED | IN_PROGRESS | COMPLETED
  currentSegment, totalSegments
  timeSpentSeconds, completedAt
```

Text input segments (`TEXT_INPUT`) are evaluated by `textInputEvaluationService` via LLM; result stored in `TextInputResponse`.

### 7.3 Skill Mastery (`UserSkillProgress`)

Tracks per-(userId, childId):
- `masteredCorrections`, `masteredLeading`, `masteredPraise`, `masteredEcho`
- `cleanCorrectionsSessions`, `cleanLeadingSessions` — consecutive session counters
- Mastery flags are monotonically set (never reset)

### 7.4 i18n

Every content table (`Lesson`, `LessonSegment`, `Quiz`, `Module`) has a parallel `*Translation` table keyed by `(id, locale)`. `autoTranslated` / `reviewed` flags distinguish machine vs. human-reviewed content. `translationService.cjs` drives automated translation via LLM.

---

## 8. Weekly Reports

### 8.1 Report Pages

| Page | Content |
|------|---------|
| 1 | Headline (AI-generated, child-specific) |
| 2 | Emotional bank account: praise/echo/narrate counts, trend |
| 3 | Parent growth narrative + micro-win metrics |
| 4 | Top session moments (audio clips with timestamps) |
| 5 | Child spotlight + growth snapshots |
| 6 | Next week's focus (heading + why explanation) |
| 7 | Quick mood check-in (user response) |

### 8.2 Generation Flow

```
weeklyReportService.generateReport(userId, childId, weekStart)
  │
  ├─ Aggregate sessions in week (count, tagCounts, utterances)
  ├─ Compute trend vs prior week
  ├─ Select top 3 moments (high-praise utterances with audio offsets)
  ├─ LLM pass 1: headline, parentGrowthNarrative, noraObservation
  ├─ LLM pass 2: childSpotlight, growthSnapshots, focusHeading
  └─ UPSERT WeeklyReport (unique: userId + weekStartDate)
```

`visibility: false` by default; admin toggles to publish to parent.

---

## 9. Child Profiling & Milestone Detection

### 9.1 Milestone Library

`MilestoneLibrary` contains clinically-sourced developmental milestones:
- `category`: e.g. `communication`, `motor`, `social`
- `detectionMode`: `auto` (inferred from session) or `manual`
- `thresholdValue`: number of detections before status → `ACHIEVED`
- `medianAgeMonths`, `mastery90AgeMonths`: age norms

### 9.2 Detection Flow

`milestoneDetectionService.cjs` runs after each session analysis:
1. Scan utterances and AI output for milestone signals
2. Upsert `ChildMilestone` (increment `detectionCount`)
3. Set `status = ACHIEVED` when `detectionCount >= threshold`
4. Append achievement to `milestoneCelebrations` JSON on Session

### 9.3 Child Issue Priority (`ChildIssuePriority`)

Computed from WACB survey scores + user-reported issues. Maps to `ClinicalLevel` × `InterventionStrategy` pairs, ranked 1–N. Used by `priorityEngine.cjs` to personalise lesson recommendations.

---

## 10. Subscription & Paywall

### 10.1 Plans

| Plan | Status | Access |
|------|--------|--------|
| `FREE` / `INACTIVE` | No subscription | Limited features |
| `TRIAL` | `TRIAL` | Full access, trial period |
| `PREMIUM` | `ACTIVE` | Full access |

### 10.2 RevenueCat Integration

- Mobile SDK initialises with platform-specific product IDs (iOS App Store / Google Play)
- Purchase events → RevenueCat → webhook `POST /api/webhooks/revenuecat`
- Server validates webhook signature, upserts `SubscriptionEvent`, updates `User` subscription fields
- `subscriptionStatus`, `subscriptionPlan`, `subscriptionEndDate`, `trialEndDate` are source of truth on the server

---

## 11. Risk Detection & Duty-to-Warn

### 11.1 Risk Scoring

PCIT analysis LLM returns `riskScore` (0–10):
- 0–3: low
- 4–6: medium
- 7–9: high
- 10: `IMMINENT_HARM`

### 11.2 Audit Log

`RiskAuditLog` is **immutable** (no DELETE/UPDATE). Columns:
- `triggerExcerpt`: AES-256-CBC encrypted at application level
- `actionTaken`: documents what the system did (hotline displayed, therapist alerted)

### 11.3 Escalation

- `riskScore >= 7`: `flaggedForReview = true`, alert email to supervising therapist (`coachAlertSent`)
- `IMMINENT_HARM`: immediate crisis resources shown in app, mandatory escalation path

---

## 12. Admin Portal

React + Vite SPA at `admin.hinora.co`.

### 12.1 Key Capabilities

- User management (view, tag, subscription override)
- Session review (flag resolution, psychologist feedback injection)
- Coach chat monitoring + intervention (`psychologist` role messages)
- Weekly report publish/unpublish (`visibility` toggle)
- Support request queue
- Lesson/module content management

### 12.2 Psychologist Injection

Admin sends `POST /api/admin/coach/inject`:
```json
{ "userId": "...", "text": "I noticed you've been..." }
```
Inserted as `CoachChatMessage` with `role = "psychologist"`. Mobile renders as a distinct bubble. This allows licensed psychologists to intervene in the AI coaching stream.

---

## 13. Push Notifications

### 13.1 Token Storage

`User.pushToken` (Expo push token), `User.pushTokenUpdatedAt`. Upserted on app open / login.

### 13.2 Notification Types

| Type | Trigger |
|------|---------|
| `report_ready` | Session analysis completed |
| `report_failed` | Permanent analysis failure |
| `milestones_unlocked` | New milestone(s) achieved |
| `weekly_report` | Weekly report published |
| Custom | Admin push via portal |

Delivery via Expo Push Notification API (`pushNotifications.cjs`).

---

## 14. Database Schema Summary

### 14.1 Core Tables

| Table | Purpose |
|-------|---------|
| `User` | Auth, profile, subscription state, streak |
| `Session` | PCIT session audio metadata + analysis results |
| `Utterance` | Per-speaker utterances with PCIT tags |
| `Child` | Child profile (name, DOB, gender, conditions) |
| `ChildProfiling` | Per-session child developmental snapshot |
| `ChildMilestone` | Milestone achievement tracking |
| `MilestoneLibrary` | Reference milestone definitions |
| `ChildIssuePriority` | Ranked clinical issue/strategy pairs |

### 14.2 Learning Tables

| Table | Purpose |
|-------|---------|
| `Module` / `ModuleTranslation` | Learning module definitions |
| `Lesson` / `LessonTranslation` | Lesson metadata |
| `LessonSegment` / `LessonSegmentTranslation` | Content blocks |
| `Quiz` / `QuizOption` / `QuizTranslation` | Quiz definitions |
| `QuizResponse` | User quiz answers |
| `TextInputResponse` | Open-ended answer + AI evaluation |
| `UserLessonProgress` | Lesson completion state |
| `UserSkillProgress` | PCIT skill mastery flags |
| `LearningProgress` | Flash-card deck unlock state |

### 14.3 Engagement & Compliance Tables

| Table | Purpose |
|-------|---------|
| `CoachChatMessage` | Chat history |
| `WeeklyReport` | AI-generated weekly parent report |
| `RiskAuditLog` | Immutable duty-to-warn audit trail |
| `SubscriptionEvent` | RevenueCat webhook events |
| `Phq2Survey` | PHQ-2 depression screening responses |
| `WacbSurvey` | WACB behavioural survey responses |
| `SupportRequest` | In-app support tickets |
| `Referral` | Referral tracking (code, status) |
| `RefreshToken` | JWT refresh token (hashed) |
| `PasswordResetToken` | Password reset tokens |
| `ThirdPartyRequest` | Idempotency log for 3rd-party API calls |
| `ModuleHistory` | Which module categories user has viewed |
| `AppConfig` | Key-value server config overrides |
| `Keyword` | Glossary terms for learning content |

---

## 15. API Surface (Selected Endpoints)

### Auth — `/api/auth`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Create account |
| POST | `/login` | Email/password login → JWT pair |
| POST | `/refresh` | Rotate access + refresh tokens |
| POST | `/logout` | Revoke refresh token |
| POST | `/google`, `/apple` | Social auth |
| POST | `/forgot-password` | Send reset email |
| POST | `/reset-password` | Consume token, set new password |

### Recordings — `/api/recordings`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Upload audio, create Session |
| GET | `/status/:sessionId` | Poll analysis status |
| DELETE | `/:sessionId` | Delete session + GCS file |

### Sessions — `/api/sessions`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List user's sessions |
| GET | `/:id` | Full session detail (feedback, coding) |
| GET | `/:id/utterances` | Utterance list with PCIT tags |
| POST | `/:id/feedback` | Submit user feedback on report |

### Coach — `/api/coach`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/history` | Full chat history |
| GET | `/events?since=` | Long-poll for new messages |
| POST | `/chat` | Send message, trigger LLM response |
| DELETE | `/history` | Clear chat history |

### Lessons — `/api/lessons`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List lessons with user progress |
| GET | `/:id` | Lesson detail + segments |
| POST | `/:id/progress` | Update progress (segment, status) |
| POST | `/:id/quiz` | Submit quiz answer |
| POST | `/:segmentId/text-input` | Submit text input answer |

### Learning — `/api/learning`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/weekly-report` | Get current weekly report |
| POST | `/weekly-report/mood` | Submit mood check-in |
| GET | `/skill-progress` | Skill mastery flags |
| GET | `/child-milestones` | Child milestone achievements |

---

## 16. Security Design

### 16.1 Encryption

| Data | Mechanism |
|------|-----------|
| Passwords | bcrypt, cost 12 |
| Refresh tokens | SHA-256 hash stored |
| `RiskAuditLog.triggerExcerpt` | AES-256-CBC, app-level |
| DB connections | TLS (`sslmode=require`) |
| Audio at rest | GCS/S3 server-side AES-256 |

### 16.2 Access Control

- Every DB query filtered by `userId = req.user.id`
- Admin routes gated by `req.user.tag === 'admin'` check in middleware
- RevenueCat webhooks verified by HMAC signature before processing

### 16.3 Rate Limiting

`express-rate-limit` applied globally; stricter limits on auth endpoints. `trust proxy 1` set for correct IP detection behind Cloud Run.

### 16.4 Input Validation

- File upload: MIME type and size checked before GCS write
- JSON bodies: validated at route layer
- LLM outputs: `sanitizeOutput()` and `jsonrepair` to handle model hallucinations

---

## 17. Infrastructure

### 17.1 Environments

| Component | Prod (ap-southeast-1 / Singapore) | Dev (us-east-1 / N. Virginia) |
|-----------|----------------------------------|-------------------------------|
| API Server | AWS App Runner (`wpwpawhz29.ap-southeast-1.awsapprunner.com`) | AWS App Runner (`p2tgddmyxt.us-east-1.awsapprunner.com`) |
| Database | AWS RDS PostgreSQL — `nora-prod.cjy4ccwg2d5q.ap-southeast-1.rds.amazonaws.com`, DB: `nora` | AWS RDS PostgreSQL — `nora-db-dev.cst6ygywo6de.us-east-1.rds.amazonaws.com`, DB: `nora_dev` |
| Audio / image storage | AWS S3 `nora-audio-059364397483-prod` (ap-southeast-1) | AWS S3 `nora-audio-059364397483-sg` (ap-southeast-1) |
| Support attachments | AWS S3 `nora-support` (ap-southeast-1) | same |
| Container registry | AWS ECR (ap-southeast-1) | AWS ECR (us-east-1) |
| Secrets | AWS Secrets Manager → App Runner env injection | AWS Secrets Manager (us-east-1) |
| Admin portal | Vercel (`admin.hinora.co`) | Local Vite |
| Mobile distribution | EAS Build → App Store + Play Store | Expo Go / DevRunner build |
| LLM (primary) | Claude Sonnet 4.6 (`AI_PROVIDER=claude-sonnet-4-6`) | Gemini 2.0 Flash (default) |
| LLM (fallback) | `claude-sonnet-4-6` (`FALLBACK_MODEL`) | same |
| LLM (streaming) | `gemini-3.1-pro-preview` (`GEMINI_STREAMING_MODEL`) | same |
| Transcription | ElevenLabs Scribe v2 | same |
| Subscriptions | RevenueCat | RevenueCat sandbox |
| Push notifications | Expo Push Notification Service | same |
| DB tunnel (local) | `./scripts/start-prod-db-tunnel.sh` → localhost:5433 | `./scripts/start-db-tunnel.sh` → localhost:5432 |

### 17.2 Container Startup (`entrypoint.sh`)

On every deployment App Runner runs:
```sh
npx prisma generate       # generates Prisma client
npx prisma migrate deploy # applies pending migrations (idempotent)
node server.cjs           # starts the server
```

Schema migrations are applied automatically on container start — no manual migration step needed at deploy time.

### 17.3 Python Services

`python-services/diarization/` — speaker diarisation ML service (separate process). Called by `mlDiarizationService.cjs` via HTTP. Provides speaker-turn boundaries that improve transcript quality before PCIT coding.

---

## 18. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Long-poll instead of WebSocket for coach chat | Simpler to deploy on Cloud Run (stateless); works reliably on mobile with network transitions |
| Gemini primary / Claude fallback in LLM gateway | Cost optimisation; Claude as safety net when Gemini returns malformed or low-quality output |
| Structured output (responseSchema) for Gemini | Prevents JSON parse failures at token level; reduces `jsonrepair` invocations |
| Immutable `RiskAuditLog` | PDPA / duty-to-warn compliance; records cannot be modified or deleted |
| Per-user refresh token (UNIQUE constraint) | Single-device session model; rotating refresh invalidates prior sessions automatically |
| `enrichmentStatus` separate from `analysisStatus` | Allows core PCIT report to be shown immediately while enrichment runs in background |
| `UserSkillProgress` mastery flags never reset | Mastery is clinically meaningful; once achieved, regression is tracked differently |
| `WeeklyReport.visibility` admin gate | Reports need clinical review before being surfaced to parents |
