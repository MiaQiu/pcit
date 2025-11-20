# User Authentication & Database Integration Plan

## Overview

This plan outlines the implementation of user authentication and database persistence for the Happy Pillar PCIT therapy coaching application.

**Primary Goal:** Enforce PDPA-level security and Access Control by making the Backend API the single point of access to the database and object storage.

---

## 1. Technology Stack

| Component | Technology | Purpose in Secure Flow |
|-----------|------------|------------------------|
| Database | PostgreSQL | Stores all user metadata, session records, and AI analysis results |
| ORM | Prisma | Type-safe, secure query layer for PostgreSQL |
| API Server | Node.js/Express | Security gateway, orchestrates AI pipeline, validates JWTs |
| Authentication | JWT + bcrypt | Token issuance, password hashing (Cost Factor 12) |
| Object Storage | **Google Cloud Storage (GCS)** | Stores raw audio files only (Data Minimization) |
| Security Layer | API Middleware | Enforces user isolation (`WHERE user_id = authenticated_user_id`) |

---

## 2. Database Schema

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// User table for authentication and metadata
model User {
  id              String    @id @default(uuid())
  email           String    @unique
  passwordHash    String    // Hashed using bcrypt (factor 12)
  name            String
  therapistId     String?   // For clinical case management
  childName       String?
  createdAt       DateTime  @default(now())

  // Relationships
  sessions        Session[]
  riskLogs        RiskAuditLog[]

  @@index([email])
  @@index([therapistId])
}

// Stores metadata and analysis results for each PCIT session
model Session {
  id                  String      @id @default(uuid())
  userId              String      // CRITICAL for access control
  mode                SessionMode

  // Audio Data - ONLY store path, not raw audio (Data Minimization I.2)
  storagePath         String      // Path to raw audio in GCS
  durationSeconds     Int

  // AI Analysis Results (Core PHI)
  transcript          String      @db.Text
  aiFeedbackJSON      Json        // Structured JSON from Claude
  pcitCoding          Json        // Detailed coding data

  // Tag counts (denormalized for quick queries)
  tagCounts           Json        // CDI or PDI tag counts

  // Mastery tracking
  masteryAchieved     Boolean     @default(false)

  // Risk Flagging (II.1)
  riskScore           Int         @default(0)  // 0=low, 10=critical
  flaggedForReview    Boolean     @default(false)

  // Coach alerts
  coachAlertSent      Boolean     @default(false)
  coachAlertSentAt    DateTime?

  createdAt           DateTime    @default(now())

  user                User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([createdAt])
  @@index([mode])
  @@index([flaggedForReview])
}

enum SessionMode {
  CDI
  PDI
}

// Dedicated, IMMUTABLE table for Duty-to-Warn auditing (II.2)
model RiskAuditLog {
  id              String    @id @default(uuid())
  userId          String    // Identifies the user involved
  sessionId       String?   // Reference to triggering session
  timestamp       DateTime  @default(now())

  triggerSource   String    // e.g., "Claude Analysis", "Manual User Report"
  riskLevel       String    // e.g., "IMMINENT_HARM", "SUICIDAL_IDEATION"

  // MUST BE APPLICATION-LEVEL ENCRYPTED
  triggerExcerpt  String?   // Sensitive excerpt that triggered flag

  actionTaken     String    // e.g., "Displayed Hotline", "Escalated to Clinician"

  user            User      @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([riskLevel])
  @@index([timestamp])
}

// Refresh Tokens for JWT security
model RefreshToken {
  id          String    @id @default(uuid())
  userId      String    @unique
  tokenHash   String    @unique
  expiresAt   DateTime
  createdAt   DateTime  @default(now())

  @@index([tokenHash])
}
```

---

## 3. API Endpoints

All endpoints accessing sensitive data MUST require `Authorization: Bearer <AccessToken>` via JWT middleware.

### Authentication

| Method | Endpoint | Description | Security |
|--------|----------|-------------|----------|
| POST | `/api/auth/signup` | Create new user (bcrypt hashing) | Public |
| POST | `/api/auth/login` | Issues Access & Refresh tokens | Public |
| POST | `/api/auth/logout` | Revokes Refresh Token | Requires Auth |
| POST | `/api/auth/refresh` | Issues new Access Token | Secure Token |

### Sessions (CRITICAL)

| Method | Endpoint | Description | Security |
|--------|----------|-------------|----------|
| POST | `/api/sessions/upload` | **Handles audio upload to GCS, initiates AI pipeline** | Requires Auth |
| GET | `/api/sessions` | List sessions (enforce `WHERE userId = ...`) | Requires Auth |
| GET | `/api/sessions/:id` | Session detail (enforce `WHERE userId = ...`) | Requires Auth |
| GET | `/api/sessions/progress` | Progress dashboard data | Requires Auth |
| DELETE | `/api/sessions/:id` | Delete session and GCS file | Requires Auth |

### User Profile

| Method | Endpoint | Description | Security |
|--------|----------|-------------|----------|
| GET | `/api/users/profile` | Get user profile | Requires Auth |
| PUT | `/api/users/profile` | Update profile | Requires Auth |
| PUT | `/api/users/password` | Change password | Requires Auth |
| DELETE | `/api/users/account` | Delete account and all data | Requires Auth |

---

## 4. Cloud Object Storage (Google Cloud Storage)

### Why GCS for Audio Files

- **Data Minimization (I.2):** Database stores only `storagePath`, not raw audio
- **Scalability:** Handles large audio files efficiently
- **Security:** Server-side encryption, signed URLs for access
- **Cost:** Pay only for storage used

### Implementation

```javascript
// server/services/storage.js
const { Storage } = require('@google-cloud/storage');

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_KEY_FILE
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

// Upload audio file
async function uploadAudio(userId, sessionId, audioBuffer) {
  const filename = `audio/${userId}/${sessionId}.webm`;
  const file = bucket.file(filename);

  await file.save(audioBuffer, {
    metadata: {
      contentType: 'audio/webm',
      metadata: {
        userId,
        sessionId,
        uploadedAt: new Date().toISOString()
      }
    }
  });

  return filename; // Store this in database
}

// Generate signed URL for playback
async function getSignedUrl(storagePath) {
  const [url] = await bucket.file(storagePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000 // 15 minutes
  });
  return url;
}

// Delete audio file
async function deleteAudio(storagePath) {
  await bucket.file(storagePath).delete();
}
```

### GCS Bucket Configuration

- Enable **default encryption** (Google-managed or Customer-managed keys)
- Set **lifecycle rules** for data retention
- Configure **IAM** for least-privilege access
- Enable **audit logging**

---

## 5. Application-Level Encryption

For highly sensitive data like `triggerExcerpt` in RiskAuditLog:

```javascript
// server/utils/encryption.js
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 bytes
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
```

---

## 6. Implementation Phases

### Phase 1: Database Setup
**Focus: Encryption at Rest (I.2)**

- [ ] Install dependencies (prisma, bcrypt, jsonwebtoken, @google-cloud/storage)
- [ ] Initialize Prisma with revised schema
- [ ] Configure PostgreSQL with disk-level encryption (via hosting provider)
- [ ] Run initial migrations
- [ ] Set up environment variables for secrets

### Phase 2: Backend Authentication
**Focus: Strong Hashing (I.2), Access Control (I.2)**

- [ ] Implement Signup/Login/Logout endpoints
- [ ] Custom JWT generation with Access & Refresh tokens
- [ ] bcrypt hashing (Cost Factor 12)
- [ ] Create AuthMiddleware for JWT verification
- [ ] Add rate limiting
- [ ] Add input validation (Joi)

### Phase 3: AI Orchestration & Object Storage
**Focus: Data Minimization (I.2), Encryption in Transit (I.2)**

- [ ] **CRITICAL:** Implement `/api/sessions/upload` endpoint
- [ ] Integrate Google Cloud Storage client
- [ ] Upload raw audio to GCS, store only path in DB
- [ ] Orchestrate ElevenLabs transcription API
- [ ] Orchestrate Claude analysis API
- [ ] Store analysis results in Session record

### Phase 4: Session Processing & Risk Logging
**Focus: Duty-to-Warn Audit (II.2), Data Integrity**

- [ ] Implement risk detection from Claude output
- [ ] **IMMEDIATE, IMMUTABLE** write to RiskAuditLog on detection
- [ ] Application-level encryption for triggerExcerpt
- [ ] Update Session record with risk score
- [ ] Send coach alerts for flagged sessions

### Phase 5: Frontend & UI
**Focus: Access Control (I.2)**

- [ ] Create AuthContext
- [ ] Build Login/Signup screens
- [ ] Implement protected routes
- [ ] Build Session History screen
- [ ] Build Session Detail screen
- [ ] Ensure all requests use Access Token

### Phase 6: Testing & Security Audit
**Focus: All Validation Protocols (IV)**

- [ ] Unit tests for AuthMiddleware
- [ ] Integration tests for Prisma queries
- [ ] **Mandatory Security Audit** (Penetration Testing)
- [ ] **Fidelity Testing** (Human-in-the-Loop) on risk detection
- [ ] Performance testing

---

## 7. Dependencies to Install

```bash
# Backend
npm install @prisma/client bcrypt jsonwebtoken express-rate-limit helmet joi
npm install @google-cloud/storage  # For GCS
npm install -D prisma

# Frontend
npm install axios react-router-dom
```

---

## 8. Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/happypillar

# JWT Secrets
JWT_ACCESS_SECRET=your-256-bit-secret
JWT_REFRESH_SECRET=different-256-bit-secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Google Cloud Storage
GCP_PROJECT_ID=your-project-id
GCP_KEY_FILE=./gcp-service-account.json
GCS_BUCKET_NAME=happypillar-audio

# Application-Level Encryption (32 bytes hex)
ENCRYPTION_KEY=your-64-char-hex-string

# Frontend URL for CORS
FRONTEND_URL=http://localhost:5173

# Existing
ANTHROPIC_API_KEY=your-key
ELEVENLABS_API_KEY=your-key

# Email (for coach alerts)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-app-password
COACH_EMAIL=coach@example.com
```

Generate secrets:
```bash
# JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Encryption key (32 bytes = 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 9. File Structure

```
/Users/mia/happypillar/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── server/
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── validate.js
│   │   └── rateLimiter.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── sessions.js
│   │   └── pcit.js
│   ├── services/
│   │   ├── db.js          # Prisma client
│   │   └── storage.js     # GCS client
│   └── utils/
│       ├── password.js
│       ├── jwt.js
│       └── encryption.js  # App-level encryption
├── src/
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── hooks/
│   │   └── useAuth.js
│   ├── services/
│   │   ├── authService.js
│   │   └── sessionService.js
│   ├── screens/
│   │   ├── LoginScreen.jsx
│   │   ├── SignupScreen.jsx
│   │   ├── SessionHistoryScreen.jsx
│   │   └── SessionDetailScreen.jsx
│   └── components/
│       └── ProtectedRoute.jsx
├── gcp-service-account.json  # GCS credentials (DO NOT COMMIT)
└── .env
```

---

## 10. Security Protocol Enforcement (PDPA)

| Protocol | Implementation |
|----------|----------------|
| **Data Minimization (I.2)** | Session model stores only `storagePath`, raw audio lives in GCS |
| **Encryption at Rest (I.2)** | PostgreSQL hosting provider disk-level encryption; GCS default encryption |
| **Encryption in Transit (I.2)** | HTTPS everywhere; TLS for API calls |
| **Access Control (I.2)** | JWT middleware + mandatory `WHERE userId = ...` in all Prisma queries |
| **Strong Hashing (I.2)** | bcrypt (cost factor 12) for all password storage |
| **Duty-to-Warn Audit (II.2)** | Dedicated, immutable `RiskAuditLog` table; immediate write on detection |
| **Application-Level Encryption** | AES-256-CBC for `triggerExcerpt` in RiskAuditLog |

---

## 11. Risk Detection Flow

```
1. User uploads audio
   └─> Audio saved to GCS (storagePath stored in DB)

2. Backend calls ElevenLabs for transcription
   └─> Transcript stored in Session

3. Backend calls Claude for PCIT analysis
   └─> Check output for risk flags

4. IF risk detected:
   └─> IMMEDIATELY write to RiskAuditLog (immutable)
   └─> Encrypt triggerExcerpt
   └─> Set Session.riskScore and flaggedForReview
   └─> Send coach alert email

5. Update Session with analysis results
   └─> Return results to frontend
```

---

## 12. Quick Start Commands

```bash
# Initialize database
npx prisma init
npx prisma migrate dev --name init
npx prisma generate

# View database
npx prisma studio

# Reset database
npx prisma migrate reset

# Test GCS connection
node -e "const {Storage} = require('@google-cloud/storage'); new Storage().getBuckets().then(console.log)"
```

---

## 13. GCS Bucket Setup

```bash
# Create bucket (run once)
gsutil mb -l asia-southeast1 gs://happypillar-audio

# Enable versioning (optional, for recovery)
gsutil versioning set on gs://happypillar-audio

# Set lifecycle rule (delete after 1 year)
gsutil lifecycle set lifecycle.json gs://happypillar-audio

# lifecycle.json
{
  "rule": [{
    "action": {"type": "Delete"},
    "condition": {"age": 365}
  }]
}
```

---

Created: November 2024
Updated: November 2024 (Added PDPA regulatory requirements, GCS storage, RiskAuditLog)
