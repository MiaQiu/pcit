# Database Schema Documentation

**Database**: `pcit`
**Host**: `136.114.122.94:5432`
**User**: `postgres`
**Project**: steadfast-cable-478808-u4
**Created**: November 20, 2024

---

## Tables Overview

This database contains 4 main tables:
1. **User** - User authentication and profile data
2. **Session** - PCIT therapy session records
3. **RiskAuditLog** - Immutable audit log for risk detection
4. **RefreshToken** - JWT refresh token management

---

## Table: `User`

Stores user authentication credentials and profile information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (UUID) | PRIMARY KEY, DEFAULT uuid() | Unique user identifier |
| `email` | String | UNIQUE, NOT NULL | User's email address (used for login) |
| `passwordHash` | String | NOT NULL | bcrypt hashed password (cost factor 12) |
| `name` | String | NOT NULL | User's full name |
| `therapistId` | String | NULLABLE | Optional therapist ID for clinical case management |
| `childName` | String | NULLABLE | Optional child's name |
| `createdAt` | DateTime | DEFAULT now() | Account creation timestamp |

**Indexes:**
- `email` - For fast login lookups
- `therapistId` - For therapist-based queries

**Relationships:**
- Has many `Session` records (CASCADE delete)
- Has many `RiskAuditLog` records

---

## Table: `Session`

Stores PCIT therapy session metadata and AI analysis results.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (UUID) | PRIMARY KEY, DEFAULT uuid() | Unique session identifier |
| `userId` | String | FOREIGN KEY → User.id, NOT NULL | Owner of the session (CRITICAL for access control) |
| `mode` | SessionMode | ENUM, NOT NULL | Session type: "CDI" or "PDI" |
| `storagePath` | String | NOT NULL | Path to audio file in Google Cloud Storage |
| `durationSeconds` | Int | NOT NULL | Session duration in seconds |
| `transcript` | String (Text) | NOT NULL | Full transcript from ElevenLabs |
| `aiFeedbackJSON` | Json | NOT NULL | Structured feedback from Claude AI |
| `pcitCoding` | Json | NOT NULL | Detailed PCIT behavior coding data |
| `tagCounts` | Json | NOT NULL | Summary of tag counts (praise, echo, narration, etc.) |
| `masteryAchieved` | Boolean | DEFAULT false | Whether PCIT mastery criteria met |
| `riskScore` | Int | DEFAULT 0 | Risk score (0=low, 10=critical) |
| `flaggedForReview` | Boolean | DEFAULT false | Whether session needs clinical review |
| `coachAlertSent` | Boolean | DEFAULT false | Whether coach email alert was sent |
| `coachAlertSentAt` | DateTime | NULLABLE | Timestamp of coach alert |
| `createdAt` | DateTime | DEFAULT now() | Session creation timestamp |

**Indexes:**
- `userId` - For user's session list
- `createdAt` - For chronological sorting
- `mode` - For filtering by CDI/PDI
- `flaggedForReview` - For finding sessions needing review

**Relationships:**
- Belongs to `User` (CASCADE delete)

**Session Modes:**
- `CDI` - Child-Directed Interaction
- `PDI` - Parent-Directed Interaction

---

## Table: `RiskAuditLog`

Dedicated, immutable audit log for duty-to-warn compliance. Records all risk detections.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (UUID) | PRIMARY KEY, DEFAULT uuid() | Unique log entry identifier |
| `userId` | String | FOREIGN KEY → User.id, NOT NULL | User involved in the incident |
| `sessionId` | String | NULLABLE | Reference to triggering session |
| `timestamp` | DateTime | DEFAULT now() | When risk was detected |
| `triggerSource` | String | NOT NULL | Source of detection (e.g., "Claude Analysis", "Manual User Report") |
| `riskLevel` | String | NOT NULL | Risk severity (e.g., "IMMINENT_HARM", "high", "medium", "low") |
| `triggerExcerpt` | String | NULLABLE | **ENCRYPTED** excerpt that triggered the flag |
| `actionTaken` | String | NOT NULL | Action taken (e.g., "Displayed Hotline", "Escalated to Clinician") |

**Indexes:**
- `userId` - For user-specific audit trails
- `riskLevel` - For filtering by severity
- `timestamp` - For chronological queries

**Relationships:**
- Belongs to `User`

**Security Notes:**
- `triggerExcerpt` is encrypted at application level using AES-256-CBC
- This table is **IMMUTABLE** - records should never be deleted or modified
- Critical for PDPA compliance and duty-to-warn protocols

---

## Table: `RefreshToken`

Manages JWT refresh tokens for secure authentication.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (UUID) | PRIMARY KEY, DEFAULT uuid() | Unique token identifier |
| `userId` | String | UNIQUE, NOT NULL | User who owns this token (one token per user) |
| `tokenHash` | String | UNIQUE, NOT NULL | SHA-256 hash of the refresh token |
| `expiresAt` | DateTime | NOT NULL | Token expiration timestamp (typically 7 days) |
| `createdAt` | DateTime | DEFAULT now() | Token creation timestamp |

**Indexes:**
- `tokenHash` - For fast token verification

**Security Notes:**
- Tokens are hashed using SHA-256 before storage
- Only one active refresh token per user (enforced by UNIQUE constraint)
- Expired tokens should be cleaned up periodically

---

## Enums

### `SessionMode`
- `CDI` - Child-Directed Interaction
- `PDI` - Parent-Directed Interaction

---

## Security Features

### Data Protection
1. **Encryption at Rest**: PostgreSQL hosted on Google Cloud with disk-level encryption
2. **Encryption in Transit**: All connections use SSL/TLS (sslmode=require)
3. **Application-Level Encryption**: `RiskAuditLog.triggerExcerpt` encrypted with AES-256-CBC
4. **Password Hashing**: bcrypt with cost factor 12
5. **Token Hashing**: Refresh tokens hashed with SHA-256

### Access Control
- All queries enforce `WHERE userId = authenticated_user_id`
- JWT middleware verifies access tokens
- Cascade delete ensures data cleanup when users are deleted

### Data Minimization
- Raw audio NOT stored in database (only GCS path)
- Only essential metadata retained
- Audit logs retain minimal PHI

---

## Backup and Recovery

### Google Cloud SQL Features
- Automated daily backups
- Point-in-time recovery
- High availability configuration available

### GCS Bucket
- Versioning enabled for file recovery
- Geographic redundancy (asia-southeast1)
- Lifecycle rules for retention management

---

## Connection Information

```env
DATABASE_URL="postgresql://postgres:c2UF%3As%3EHcIbDE5~%7C@136.114.122.94:5432/pcit?sslmode=require"
```

**Decoded Password**: `c2UF:s>HcIbDE5~|`

---

## Migration History

### 20251120073046_init
- Initial schema creation
- Created User, Session, RiskAuditLog, RefreshToken tables
- Established relationships and indexes
- Defined SessionMode enum

---

**Last Updated**: November 20, 2024
**Schema Version**: 1.0.0
