# Nora — High-Level System Architecture

> Extracted from `lld.md` — sections relevant to a system architecture diagram.

---

## 1. Component Map

```
┌──────────────────────────────────────────────────────────────────┐
│  Clients                                                         │
│                                                                  │
│  ┌─────────────────────┐    ┌──────────────────────────────────┐ │
│  │  Nora Mobile App    │    │  Admin Portal                    │ │
│  │  React Native/Expo  │    │  React + Vite (Vercel)           │ │
│  │  iOS + Android      │    │  admin.hinora.co                 │ │
│  └──────────┬──────────┘    └───────────────┬──────────────────┘ │
└─────────────┼─────────────────────────────────┼──────────────────┘
              │ HTTPS/REST                       │ HTTPS/REST
              ▼                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  API Server                                                      │
│  Node.js / Express  ·  AWS App Runner (Docker)                  │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐  ┌─────────┐  │
│  │  Auth      │  │ Recordings │  │  Coach Chat  │  │ Lessons │  │
│  │  Sessions  │  │ Processing │  │  (long-poll) │  │ Reports │  │
│  └────────────┘  └─────┬──────┘  └──────┬───────┘  └─────────┘  │
│                        │                │                        │
│              ┌─────────▼────────────────▼──────────┐            │
│              │  LLM Gateway                         │            │
│              │  Claude Sonnet 4.6 (prod primary)    │            │
│              │  Gemini 2.0 Flash (dev primary)      │            │
│              │  claude-sonnet-4-6 (fallback)        │            │
│              └──────────────────────────────────────┘            │
└──────┬───────────────┬──────────────┬──────────────┬────────────┘
       │               │              │              │
       ▼               ▼              ▼              ▼
  PostgreSQL        AWS S3        ElevenLabs     RevenueCat
  AWS RDS            Audio         Scribe v2      Webhooks
  (Prisma ORM)      Storage       Transcription  Subscriptions
```

---

## 2. Main User Journey — Audio Processing

```
Mobile          API Server              External Services
  │                │                          │
  │─ Upload audio ►│─ Store audio ────────────► AWS S3
  │                │─ Create Session (PENDING) ► PostgreSQL
  │◄─ sessionId ───│                          │
  │                │                          │
  │                │  [background]            │
  │                │─ Transcribe ─────────────► ElevenLabs Scribe v2
  │                │◄─ transcript ─────────────│
  │                │─ PCIT coding ────────────► LLM Gateway (Gemini)
  │                │◄─ pcitCoding, tagCounts ──│
  │                │─ Enrich ─────────────────► LLM Gateway (Gemini)
  │                │◄─ coachingCards, etc. ────│
  │                │─ Milestone detection      │
  │                │─ Update Session (DONE) ──► PostgreSQL
  │                │─ Push notification ──────► Expo Push Service
  │◄─ push notif ──│                          │
```

---

## 3. LLM Gateway

```
Caller (any service)
       │
       ▼
  llmCall(prompt, options)
       │
       ├── primary: Gemini 2.0 Flash ──► Google AI API
       │     structured JSON output
       │     retry ×3 (1s / 2s backoff)
       │
       └── fallback: Claude Sonnet ────► Anthropic API
             (on all retries exhausted)
```

All AI calls in the system route through this single gateway — PCIT coding, enrichment, coach chat, lesson evaluation, weekly reports, translations.

---

## 4. Coach Chat — Real-Time Pattern

```
Mobile                  API Server              LLM
  │                         │                    │
  │─ POST /coach/chat ──────►│                   │
  │                         │─ stream ───────────► Gemini
  │                         │◄─ token stream ─────│
  │                         │─ publish to chatBus │
  │                         │─ save to DB ────────► PostgreSQL
  │                         │                    │
  │─ GET /coach/events ─────►│                   │
  │  (long-poll, 25s hold)  │                    │
  │◄─ new message ──────────│                    │
```

Admin portal can inject `psychologist` role messages into the same stream, and can abort an in-flight LLM generation via `agentBus`.

---

## 5. Infrastructure

| Layer | Production (ap-southeast-1 / Singapore) | Dev (us-east-1 / N. Virginia) |
|-------|----------------------------------------|-------------------------------|
| API server | AWS App Runner | AWS App Runner |
| Database | AWS RDS PostgreSQL (`nora-prod…ap-southeast-1.rds.amazonaws.com`, DB: `nora`) | AWS RDS PostgreSQL (`nora-db-dev…us-east-1.rds.amazonaws.com`, DB: `nora_dev`) |
| Audio storage | AWS S3 `nora-audio-059364397483-prod` | AWS S3 `nora-audio-059364397483-sg` |
| Support attachments | AWS S3 `nora-support` (ap-southeast-1) | same |
| Secrets | AWS Secrets Manager → App Runner env injection | AWS Secrets Manager (us-east-1) |
| Admin portal | Vercel (`admin.hinora.co`) | Local Vite |
| Mobile | EAS Build → App Store / Play Store | Expo Go / DevRunner build |
| LLM (primary) | Claude Sonnet 4.6 (`AI_PROVIDER`) | Gemini 2.0 Flash |
| LLM (fallback) | `claude-sonnet-4-6` | same |
| Transcription | ElevenLabs Scribe v2 | same |
| Subscriptions | RevenueCat | RevenueCat sandbox |
| Push notifications | Expo Push Service | same |
| Speaker diarisation | Python service (sidecar) | same |
