# Error Handling Implementation - Detailed Answers

---

## 1. Rollout Strategy: Phased vs All-at-Once

### **Option A: All Phases at Once (Recommended)**

**Pros:**
- ✅ Faster time to full implementation (3 days total)
- ✅ No integration issues between phases
- ✅ Users get full benefit immediately
- ✅ Single testing cycle
- ✅ No need to maintain two error handling systems

**Cons:**
- ⚠️ Larger changeset = higher risk if issues occur
- ⚠️ Harder to pinpoint which change caused issues
- ⚠️ More files to test at once

**Testing Strategy:**
1. **Day 1-2:** Implement all changes
2. **Day 3:** Comprehensive testing
   - Unit tests for new utilities
   - Integration tests for API endpoints
   - Manual testing of all error scenarios
   - Staging deployment for 24hrs
3. **Day 4:** Production deployment with monitoring

---

### **Option B: Incremental Phased Rollout**

**Phase 1 → Test → Phase 2 → Test → Phase 3 → Test**

**Pros:**
- ✅ Lower risk per deployment
- ✅ Easier to identify issues
- ✅ Can gather user feedback between phases
- ✅ Can pause if problems arise

**Cons:**
- ⚠️ Longer total timeline (5-7 days)
- ⚠️ Multiple deployment cycles
- ⚠️ More complex testing (need to test backward compatibility)
- ⚠️ Users experience gradual improvements

**Testing Strategy per Phase:**

#### **Phase 1 Testing (Foundation)**
**Goal:** Verify error responses are standardized

**Backend Tests:**
```bash
# Test error responses
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid","password":"weak"}'

# Expected response:
{
  "error": "Email must be a valid email address",
  "code": "VALIDATION_ERROR"
}
```

**Manual Test Checklist:**
- [ ] Signup with existing email → See "Email already registered" with code `CONFLICT`
- [ ] Login with wrong password → See "Incorrect email or password" with code `UNAUTHORIZED`
- [ ] Access protected route without token → See "Please log in" with code `UNAUTHORIZED`
- [ ] Upload file too large → See file size error with code `UPLOAD_ERROR`
- [ ] Trigger server error → See generic message with code `INTERNAL_ERROR`
- [ ] Check logs show structured format
- [ ] Verify 404 handler works

**Mobile Tests:**
- [ ] Login with wrong credentials → See improved error message
- [ ] Signup with existing email → See clear conflict message
- [ ] Upload recording offline → See network error (if network monitor added)
- [ ] All errors return from API with new format

**Success Criteria:**
- ✅ All API errors return standardized format `{ error, code, userMessage }`
- ✅ Error logs include full context (userId, path, method, timestamp)
- ✅ Global error handler catches unhandled errors
- ✅ No breaking changes to existing functionality

**Deployment:**
1. Deploy to staging
2. Run automated test suite
3. Manual testing (2-3 hours)
4. Monitor for 24 hours
5. Deploy to production if stable
6. Monitor error logs for anomalies

---

#### **Phase 2 Testing (User Experience)**
**Goal:** Verify improved user-facing errors and UX

**Manual Test Checklist:**
- [ ] Toast notifications appear for non-critical errors
- [ ] Network status bar shows when offline
- [ ] Turn off wifi → See "No internet connection" message
- [ ] Upload with network on → See progress
- [ ] Turn off network mid-upload → See appropriate error
- [ ] Analysis timeout → See improved message with options
- [ ] Retry upload after failure → Works correctly
- [ ] Exponential backoff → Verify timing increases

**Test Exponential Backoff:**
```typescript
// Manually test polling delays
// Attempt 1: ~1 second
// Attempt 2: ~1.5 seconds
// Attempt 3: ~2.25 seconds
// Attempt 4: ~3.4 seconds
// Attempt 5: ~5 seconds
// Attempt 6+: 10 seconds (max)
```

**Success Criteria:**
- ✅ Users see clear, actionable error messages
- ✅ Network errors clearly identified
- ✅ Toast notifications work smoothly
- ✅ Polling is more efficient (less server load)

**Deployment:**
1. Build and deploy mobile app update
2. Test on iOS and Android devices
3. Monitor crash reports (Crashlytics)
4. Gather user feedback
5. Monitor API load (should decrease with backoff)

---

#### **Phase 3 Testing (Monitoring)**
**Goal:** Verify error tracking and monitoring

**Manual Test Checklist:**
- [ ] Trigger server error → Check Sentry dashboard
- [ ] Verify error includes context (userId, path, tags)
- [ ] Check structured logs are formatted correctly
- [ ] Run error analytics queries → Get results
- [ ] Set up Sentry alerts

**Success Criteria:**
- ✅ Errors appear in Sentry within 1 minute
- ✅ Error context includes user info and tags
- ✅ Structured logs are queryable
- ✅ Analytics queries return useful data

**Deployment:**
1. Configure Sentry DSN in production
2. Deploy updated backend
3. Trigger test error to verify Sentry
4. Set up alerts for high error rates
5. Create dashboard for error metrics

---

### **Comparison: Phased vs All-at-Once**

| Aspect | All-at-Once | Phased |
|--------|-------------|--------|
| **Timeline** | 3-4 days | 5-7 days |
| **Risk per deploy** | Higher | Lower |
| **Testing complexity** | Medium | Higher (compatibility) |
| **User impact** | Immediate full benefit | Gradual improvement |
| **Rollback complexity** | Medium | Lower |
| **Monitoring effort** | 1 cycle | 3 cycles |
| **Integration issues** | Lower | Higher |

---

### **My Recommendation: All Phases at Once**

**Reasoning:**
1. Changes are tightly coupled (error classes used by all phases)
2. Testing is cleaner (don't need backward compatibility)
3. Faster delivery of complete solution
4. We have good rollback strategy (global error handler can be disabled)
5. Changes are mostly additive (low risk of breaking existing features)

**Mitigation for "All-at-Once" Risk:**
- Deploy to staging first for 24-hour soak test
- Have feature flag for global error handler (can disable if issues)
- Keep old Alert.alert code alongside toast (can switch back)
- Monitor closely for first 48 hours after production deploy

---

## 2. Error Monitoring: Sentry (Confirmed)

✅ **Using Sentry** for backend error monitoring.

### **Sentry Setup**

**Installation:**
```bash
cd server
npm install @sentry/node
```

**Configuration:**
```javascript
// server/server.cjs
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Release tracking
    release: process.env.GIT_COMMIT_SHA || 'unknown',

    // Error filtering
    beforeSend(event, hint) {
      // Don't send validation errors (400) to Sentry
      if (event.exception?.values?.[0]?.value?.includes('VALIDATION_ERROR')) {
        return null;
      }
      return event;
    },
  });

  console.log('[Sentry] Initialized for error monitoring');
}
```

**Environment Variables:**
```bash
# .env.production
SENTRY_DSN=https://your-dsn@sentry.io/your-project-id
GIT_COMMIT_SHA=abc123  # For release tracking
```

**Error Capture in Global Handler:**
```javascript
app.use((err, req, res, next) => {
  // Log to console
  console.error('[ERROR]', { ... });

  // Send to Sentry (only 500+ errors)
  if (process.env.SENTRY_DSN && (!err.statusCode || err.statusCode >= 500)) {
    Sentry.captureException(err, {
      user: req.user ? {
        id: req.user.id,
        email: req.user.email
      } : undefined,
      tags: {
        path: req.path,
        method: req.method,
        errorCode: err.code,
        environment: process.env.NODE_ENV
      },
      extra: {
        body: req.body,
        query: req.query,
        params: req.params
      }
    });
  }

  // Send response...
});
```

**What Gets Sent to Sentry:**
- 500+ server errors only (not 400 validation errors)
- User context (id, email)
- Request context (path, method, body)
- Error tags (errorCode, environment)
- Stack traces
- Release version

**Sentry Alerts:**
- Email when error rate > 10/hour
- Slack notification for critical errors
- Weekly error summary report

---

## 3. Failed Recordings: Definition & Retry Strategy

### **What is a "Failed Recording"?**

There are **three types of failures**:

#### **Type 1: Recording Failure (Client-side)**
**When it happens:**
- User denies microphone permission
- Microphone is in use by another app
- Audio recording API fails
- Device runs out of storage

**Current state:** Recording never starts or stops mid-recording

**User sees:** "Failed to start recording. Please check microphone permissions and try again."

**Can retry?** Yes, user can tap record button again

**No database record created** (nothing to retry from UI)

---

#### **Type 2: Upload Failure (Network/Transfer)**
**When it happens:**
- Network disconnects during upload
- Request times out
- S3 upload fails
- File corrupted during transfer

**Current state:**
- Recording file exists on device
- No database record created (upload failed before backend received it)
- OR database record created but `audioUrl` is null

**User sees:** "Upload failed. Please check your connection and try again."

**Can retry?** Yes! This is what we should enable.

**Database state:**
```sql
-- Option A: No record (upload failed before reaching backend)
-- Nothing in database

-- Option B: Partial record (upload started but S3 failed)
Session {
  id: "abc123"
  userId: "user123"
  audioUrl: null  -- Upload failed
  transcript: null
  transcriptionStatus: "FAILED"
  analysisStatus: "PENDING"
  createdAt: "2025-12-29T10:00:00Z"
}
```

---

#### **Type 3: Processing Failure (Backend)**
**When it happens:**
- Transcription API fails (ElevenLabs error)
- PCIT analysis fails (Claude API error)
- Database write fails
- Timeout after 2 minutes of polling

**Current state:**
- Recording successfully uploaded to S3
- Database record exists with error details

**User sees:** "We encountered an error while analyzing your recording. Please try recording again."

**Can retry?** YES! This is the most important retry scenario.

**Database state:**
```sql
Session {
  id: "abc123"
  userId: "user123"
  audioUrl: "https://s3.../audio.m4a"  -- File exists!
  transcript: null  -- OR transcript exists but analysis failed
  transcriptionStatus: "COMPLETED" or "FAILED"
  analysisStatus: "FAILED"  -- Analysis failed
  analysisError: "PCIT analysis error: Claude API timeout"
  analysisFailedAt: "2025-12-29T10:05:00Z"
  createdAt: "2025-12-29T10:00:00Z"
}
```

---

### **Retry Strategy: Which Failures Can Be Retried?**

| Failure Type | Can Retry? | How? | Data Preserved? |
|--------------|------------|------|-----------------|
| **Recording failure** | ✅ Yes | Tap record again | ❌ No (must re-record) |
| **Upload failure** | ✅ Yes | Retry upload button | ✅ Yes (audio file on device) |
| **Processing failure** | ✅ YES | **Retry processing button** | ✅ YES (audio in S3) |

---

### **Proposed: Retry Failed Recordings from UI**

#### **Scenario: Processing Failed**

**What user sees on HomeScreen:**

```
╔════════════════════════════════════╗
║  📊 Your Recordings                ║
╠════════════════════════════════════╣
║  ✓ Dec 28, 2:30 PM - 5:23          ║
║     Mostly PRIDE! behaviors        ║
║                                    ║
║  ❌ Dec 29, 10:00 AM - 3:45        ║
║     Analysis Failed                ║
║     [🔄 Retry] [🗑️ Delete]        ║
║                                    ║
║  ✓ Dec 27, 4:15 PM - 8:12          ║
║     Great progress this week!      ║
╚════════════════════════════════════╝
```

**When user taps "🔄 Retry":**
1. Re-run transcription + analysis on existing S3 audio
2. Show "Reprocessing your recording..." loading state
3. Poll for completion (same as upload flow)
4. Update UI with report when done

---

#### **Implementation:**

**Database Schema Change:**
```prisma
// prisma/schema.prisma
model Session {
  // ... existing fields

  retryCount      Int       @default(0)
  lastRetriedAt   DateTime?

  // Track retry history
  retryHistory    Json?     // Array of retry attempts with timestamps
}
```

**New API Endpoint:**
```javascript
// server/routes/recordings.cjs

// POST /api/recordings/:id/retry
// Retry failed recording analysis
router.post('/:id/retry', authenticateToken, async (req, res) => {
  const { id } = req.params;

  // Get session
  const session = await prisma.session.findUnique({ where: { id } });

  if (!session) {
    throw new NotFoundError('Recording');
  }

  // Check ownership
  if (session.userId !== req.user.id) {
    throw new ForbiddenError();
  }

  // Check if can retry
  if (!session.audioUrl) {
    throw new ValidationError('Cannot retry - audio file not found');
  }

  if (session.analysisStatus === 'COMPLETED') {
    throw new ValidationError('Recording already completed successfully');
  }

  if (session.retryCount >= 3) {
    throw new ValidationError('Maximum retry attempts reached (3)');
  }

  // Reset status for retry
  await prisma.session.update({
    where: { id },
    data: {
      transcriptionStatus: 'PENDING',
      analysisStatus: 'PENDING',
      analysisError: null,
      analysisFailedAt: null,
      retryCount: { increment: 1 },
      lastRetriedAt: new Date(),
      retryHistory: {
        push: {
          attempt: session.retryCount + 1,
          retriedAt: new Date().toISOString(),
          previousError: session.analysisError
        }
      }
    }
  });

  // Trigger background reprocessing
  processRecordingInBackground(id);

  res.json({
    message: 'Retry started',
    status: 'processing'
  });
});
```

**Mobile UI Component:**
```typescript
// nora-mobile/src/components/FailedRecordingCard.tsx

interface FailedRecordingCardProps {
  recording: {
    id: string;
    createdAt: string;
    durationSeconds: number;
    analysisError: string;
    retryCount: number;
  };
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
}

export const FailedRecordingCard: React.FC<FailedRecordingCardProps> = ({
  recording,
  onRetry,
  onDelete
}) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry(recording.id);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.errorBadge}>
        <Text style={styles.errorIcon}>❌</Text>
        <Text style={styles.errorText}>Analysis Failed</Text>
      </View>

      <Text style={styles.date}>
        {formatDate(recording.createdAt)}
      </Text>

      <Text style={styles.duration}>
        Duration: {formatDuration(recording.durationSeconds)}
      </Text>

      {recording.retryCount > 0 && (
        <Text style={styles.retryInfo}>
          Retried {recording.retryCount} time(s)
        </Text>
      )}

      <Text style={styles.errorMessage}>
        {recording.analysisError || 'Processing failed'}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.retryButton]}
          onPress={handleRetry}
          disabled={isRetrying || recording.retryCount >= 3}
        >
          {isRetrying ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={styles.buttonIcon}>🔄</Text>
              <Text style={styles.buttonText}>
                {recording.retryCount >= 3 ? 'Max retries' : 'Retry'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={() => onDelete(recording.id)}
        >
          <Text style={styles.buttonIcon}>🗑️</Text>
          <Text style={styles.buttonText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {recording.retryCount >= 3 && (
        <Text style={styles.maxRetryWarning}>
          Maximum retries reached. Please contact support or try recording again.
        </Text>
      )}
    </View>
  );
};
```

---

### **Retry Limits**

**Why limit retries?**
- Prevent infinite retry loops
- Reduce server costs
- Identify systemic issues

**Proposed limits:**
- **Max 3 retries per recording**
- **After 3 failures:** Show "Contact Support" option
- **Track retry count** in database for analytics

---

## 4. Error Tracking in Database

### **Current State**

You already track some errors:
```prisma
model Session {
  analysisStatus    AnalysisStatus  @default(PENDING)  // PENDING, COMPLETED, FAILED
  analysisError     String?         // Error message
  analysisFailedAt  DateTime?       // When it failed
}
```

### **Proposed: Enhanced Error Tracking**

#### **Schema Changes:**

```prisma
// prisma/schema.prisma

model Session {
  id                  String   @id @default(cuid())
  userId              String
  user                User     @relation(fields: [userId], references: [id])

  // ... existing fields

  // Enhanced error tracking
  transcriptionStatus TranscriptionStatus @default(PENDING)
  transcriptionError  String?
  transcriptionFailedAt DateTime?

  analysisStatus      AnalysisStatus @default(PENDING)
  analysisError       String?
  analysisErrorCode   String?         // NEW: Error code for categorization
  analysisFailedAt    DateTime?

  // Retry tracking
  retryCount          Int       @default(0)
  lastRetriedAt       DateTime?
  retryHistory        Json?     // Array of retry attempts

  // Performance tracking
  transcriptionDurationMs Int?   // How long transcription took
  analysisDurationMs      Int?   // How long analysis took

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

enum TranscriptionStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

enum AnalysisStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

// NEW: Error log table for detailed tracking
model ErrorLog {
  id            String   @id @default(cuid())

  // Context
  userId        String?
  sessionId     String?
  session       Session? @relation(fields: [sessionId], references: [id])

  // Error details
  errorType     String   // "TRANSCRIPTION_ERROR", "ANALYSIS_ERROR", "UPLOAD_ERROR", etc.
  errorCode     String   // "TIMEOUT", "API_ERROR", "NETWORK_ERROR", etc.
  errorMessage  String   @db.Text
  stackTrace    String?  @db.Text

  // Request context
  endpoint      String?  // API endpoint where error occurred
  httpMethod    String?  // GET, POST, etc.
  httpStatus    Int?     // 400, 500, etc.

  // Additional metadata
  metadata      Json?    // Any additional context

  // Timestamps
  occurredAt    DateTime @default(now())

  @@index([userId])
  @@index([sessionId])
  @@index([errorType])
  @@index([errorCode])
  @@index([occurredAt])
}

// NEW: Error summary for analytics
model ErrorMetrics {
  id            String   @id @default(cuid())

  // Time bucket (hourly aggregation)
  hour          DateTime

  // Error counts by type
  errorType     String
  errorCode     String
  count         Int      @default(0)

  // Affected users
  affectedUsers Int      @default(0)

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([hour, errorType, errorCode])
  @@index([hour])
}
```

---

### **What Gets Tracked**

#### **Example 1: Transcription Failure**

```javascript
// When transcription fails
await prisma.session.update({
  where: { id: sessionId },
  data: {
    transcriptionStatus: 'FAILED',
    transcriptionError: 'ElevenLabs API timeout',
    transcriptionErrorCode: 'API_TIMEOUT',
    transcriptionFailedAt: new Date()
  }
});

// Also log to ErrorLog table
await prisma.errorLog.create({
  data: {
    userId: session.userId,
    sessionId: session.id,
    errorType: 'TRANSCRIPTION_ERROR',
    errorCode: 'API_TIMEOUT',
    errorMessage: 'ElevenLabs API request timed out after 30 seconds',
    stackTrace: error.stack,
    endpoint: '/api/transcription',
    httpMethod: 'POST',
    metadata: {
      audioUrl: session.audioUrl,
      audioDurationSeconds: session.durationSeconds,
      attemptNumber: 1
    },
    occurredAt: new Date()
  }
});
```

#### **Example 2: Analysis Failure**

```javascript
// When PCIT analysis fails
await prisma.session.update({
  where: { id: sessionId },
  data: {
    analysisStatus: 'FAILED',
    analysisError: 'Claude API returned empty response',
    analysisErrorCode: 'API_EMPTY_RESPONSE',
    analysisFailedAt: new Date()
  }
});

await prisma.errorLog.create({
  data: {
    userId: session.userId,
    sessionId: session.id,
    errorType: 'ANALYSIS_ERROR',
    errorCode: 'API_EMPTY_RESPONSE',
    errorMessage: 'Claude API returned 200 but body was empty',
    endpoint: '/api/recordings/:id/analyze',
    metadata: {
      transcriptLength: session.transcript?.length,
      modelUsed: 'claude-3-5-sonnet',
      retryCount: session.retryCount
    },
    occurredAt: new Date()
  }
});
```

---

### **Analytics Queries**

#### **Query 1: Error Rate by Type**
```sql
SELECT
  errorType,
  errorCode,
  COUNT(*) as occurrences,
  COUNT(DISTINCT userId) as affected_users,
  MIN(occurredAt) as first_seen,
  MAX(occurredAt) as last_seen
FROM ErrorLog
WHERE occurredAt >= NOW() - INTERVAL '7 days'
GROUP BY errorType, errorCode
ORDER BY occurrences DESC;
```

**Output:**
```
errorType             | errorCode        | occurrences | affected_users | first_seen           | last_seen
---------------------|------------------|-------------|----------------|---------------------|---------------------
ANALYSIS_ERROR        | API_TIMEOUT      | 45          | 23             | 2025-12-22 10:00:00 | 2025-12-29 15:30:00
TRANSCRIPTION_ERROR   | API_TIMEOUT      | 32          | 18             | 2025-12-23 08:15:00 | 2025-12-29 14:20:00
UPLOAD_ERROR          | NETWORK_ERROR    | 28          | 15             | 2025-12-22 12:00:00 | 2025-12-29 16:00:00
ANALYSIS_ERROR        | EMPTY_TRANSCRIPT | 12          | 8              | 2025-12-25 09:00:00 | 2025-12-28 10:00:00
```

---

#### **Query 2: User Error Rate**
```sql
SELECT
  u.email,
  COUNT(DISTINCT s.id) as total_recordings,
  COUNT(DISTINCT CASE WHEN s.analysisStatus = 'FAILED' THEN s.id END) as failed_recordings,
  ROUND(
    COUNT(DISTINCT CASE WHEN s.analysisStatus = 'FAILED' THEN s.id END) * 100.0 /
    NULLIF(COUNT(DISTINCT s.id), 0),
    2
  ) as failure_rate_percent
FROM User u
LEFT JOIN Session s ON s.userId = u.id
WHERE s.createdAt >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.email
HAVING COUNT(DISTINCT s.id) > 0
ORDER BY failure_rate_percent DESC
LIMIT 20;
```

**Output:**
```
email                  | total_recordings | failed_recordings | failure_rate_percent
-----------------------|------------------|-------------------|---------------------
user1@example.com      | 15               | 8                 | 53.33
user2@example.com      | 10               | 4                 | 40.00
user3@example.com      | 20               | 6                 | 30.00
```

---

#### **Query 3: Error Trends Over Time**
```sql
SELECT
  DATE_TRUNC('day', occurredAt) as error_date,
  errorType,
  COUNT(*) as error_count
FROM ErrorLog
WHERE occurredAt >= NOW() - INTERVAL '30 days'
GROUP BY error_date, errorType
ORDER BY error_date DESC, error_count DESC;
```

**Output:**
```
error_date   | errorType           | error_count
-------------|---------------------|------------
2025-12-29   | ANALYSIS_ERROR      | 12
2025-12-29   | TRANSCRIPTION_ERROR | 8
2025-12-29   | UPLOAD_ERROR        | 5
2025-12-28   | ANALYSIS_ERROR      | 15
2025-12-28   | UPLOAD_ERROR        | 10
```

---

#### **Query 4: Retry Success Rate**
```sql
SELECT
  retryCount,
  COUNT(*) as total_sessions,
  COUNT(CASE WHEN analysisStatus = 'COMPLETED' THEN 1 END) as successful,
  COUNT(CASE WHEN analysisStatus = 'FAILED' THEN 1 END) as failed,
  ROUND(
    COUNT(CASE WHEN analysisStatus = 'COMPLETED' THEN 1 END) * 100.0 /
    COUNT(*),
    2
  ) as success_rate_percent
FROM Session
WHERE retryCount > 0
GROUP BY retryCount
ORDER BY retryCount;
```

**Output:**
```
retryCount | total_sessions | successful | failed | success_rate_percent
-----------|----------------|------------|--------|---------------------
1          | 50             | 35         | 15     | 70.00
2          | 20             | 12         | 8      | 60.00
3          | 10             | 4          | 6      | 40.00
```

---

### **Dashboard Visualization**

Create an admin dashboard to visualize errors:

```typescript
// Example dashboard data structure
interface ErrorDashboard {
  // Summary cards
  summary: {
    totalErrors24h: number;
    totalErrors7d: number;
    errorRate: number;  // Percentage
    affectedUsers: number;
    trend: 'up' | 'down' | 'stable';
  };

  // Error breakdown
  errorsByType: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;

  // Timeline chart data
  errorTimeline: Array<{
    date: string;
    analysisErrors: number;
    transcriptionErrors: number;
    uploadErrors: number;
  }>;

  // Top errors
  topErrors: Array<{
    errorCode: string;
    errorMessage: string;
    occurrences: number;
    affectedUsers: number;
    lastSeen: string;
  }>;

  // Users with high error rates
  problematicUsers: Array<{
    email: string;
    failureRate: number;
    totalSessions: number;
  }>;
}
```

---

## 5. User Feedback: "Report Problem" Button

### **When to Show "Report Problem"**

Show on these screens:
1. **Error Alert Dialogs** - Add third button option
2. **Failed Recording Cards** - Alongside Retry/Delete
3. **Settings Screen** - General "Report a Problem" option

---

### **Implementation**

#### **Component: ReportProblemButton**

```typescript
// nora-mobile/src/components/ReportProblemButton.tsx

import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { reportingService } from '../services/reportingService';

interface ReportProblemButtonProps {
  errorContext: {
    errorType: string;
    errorMessage: string;
    errorCode?: string;
    sessionId?: string;
    timestamp: string;
  };
  style?: any;
}

export const ReportProblemButton: React.FC<ReportProblemButtonProps> = ({
  errorContext,
  style
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReport = () => {
    Alert.alert(
      'Report Problem',
      'Would you like to send this error report to our team? This helps us improve the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Description',
          onPress: () => promptForDescription()
        },
        {
          text: 'Send Report',
          onPress: () => submitReport(null)
        }
      ]
    );
  };

  const promptForDescription = () => {
    Alert.prompt(
      'Describe the Problem',
      'Please describe what you were doing when this error occurred (optional):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: (description) => submitReport(description)
        }
      ],
      'plain-text'
    );
  };

  const submitReport = async (userDescription: string | null) => {
    setIsSubmitting(true);

    try {
      await reportingService.submitErrorReport({
        ...errorContext,
        userDescription,
        deviceInfo: {
          platform: Platform.OS,
          version: Platform.Version,
          appVersion: '1.0.0'  // Get from package.json
        }
      });

      Alert.alert(
        'Thank You',
        'Your report has been sent. Our team will investigate this issue.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert(
        'Report Failed',
        'Failed to send report. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={handleReport}
      disabled={isSubmitting}
    >
      <Text style={styles.icon}>📧</Text>
      <Text style={styles.text}>
        {isSubmitting ? 'Sending...' : 'Report Problem'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  icon: {
    fontSize: 16,
    marginRight: 6,
  },
  text: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
});
```

---

#### **Service: ReportingService**

```typescript
// packages/nora-core/src/services/reportingService.ts

interface ErrorReport {
  errorType: string;
  errorMessage: string;
  errorCode?: string;
  sessionId?: string;
  timestamp: string;
  userDescription?: string | null;
  deviceInfo: {
    platform: string;
    version: string | number;
    appVersion: string;
  };
}

class ReportingService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async submitErrorReport(report: ErrorReport): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/error-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAccessToken()}`
      },
      body: JSON.stringify(report)
    });

    if (!response.ok) {
      throw new Error('Failed to submit error report');
    }
  }

  private async getAccessToken(): Promise<string> {
    // Get token from authService
    return ''; // Implement token retrieval
  }
}

export const reportingService = new ReportingService(
  process.env.API_BASE_URL || 'http://localhost:3000'
);
```

---

#### **Backend: Error Report Endpoint**

```javascript
// server/routes/error-reports.cjs

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.cjs');
const { prisma } = require('../db.cjs');
const { ValidationError } = require('../utils/errors.cjs');

// POST /api/error-reports
// Submit user error report
router.post('/', authenticateToken, async (req, res) => {
  const {
    errorType,
    errorMessage,
    errorCode,
    sessionId,
    timestamp,
    userDescription,
    deviceInfo
  } = req.body;

  // Validation
  if (!errorType || !errorMessage || !timestamp) {
    throw new ValidationError('Missing required fields');
  }

  // Create error report
  const errorReport = await prisma.userErrorReport.create({
    data: {
      userId: req.user.id,
      sessionId,
      errorType,
      errorMessage,
      errorCode,
      userDescription,
      deviceInfo,
      reportedAt: new Date(timestamp),
      status: 'NEW'
    }
  });

  // TODO: Send notification to team (Slack, email, etc.)
  // await notifyTeam(errorReport);

  res.status(201).json({
    message: 'Error report submitted successfully',
    reportId: errorReport.id
  });
});

module.exports = router;
```

---

#### **Database Schema for User Reports**

```prisma
// prisma/schema.prisma

model UserErrorReport {
  id              String   @id @default(cuid())

  // Reporter
  userId          String
  user            User     @relation(fields: [userId], references: [id])

  // Error context
  sessionId       String?
  session         Session? @relation(fields: [sessionId], references: [id])
  errorType       String
  errorMessage    String   @db.Text
  errorCode       String?

  // User input
  userDescription String?  @db.Text

  // Device context
  deviceInfo      Json?    // { platform, version, appVersion }

  // Workflow
  status          ReportStatus @default(NEW)  // NEW, INVESTIGATING, RESOLVED, WONT_FIX
  assignedTo      String?
  resolution      String?  @db.Text
  resolvedAt      DateTime?

  // Timestamps
  reportedAt      DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId])
  @@index([sessionId])
  @@index([status])
  @@index([reportedAt])
}

enum ReportStatus {
  NEW
  INVESTIGATING
  RESOLVED
  WONT_FIX
  DUPLICATE
}
```

---

#### **Usage in Error Alerts**

```typescript
// Example: Update RecordScreen upload error
catch (error) {
  console.error('Upload failed:', error);

  const errorContext = {
    errorType: 'UPLOAD_ERROR',
    errorMessage: error.message,
    errorCode: error.code,
    sessionId: undefined,  // No session yet
    timestamp: new Date().toISOString()
  };

  Alert.alert(
    'Upload Failed',
    handleApiError(error),
    [
      { text: 'Cancel', onPress: resetRecording, style: 'cancel' },
      { text: 'Retry', onPress: () => retryUpload() },
      {
        text: 'Report Problem',
        onPress: () => {
          // Show report dialog
          reportingService.submitErrorReport(errorContext);
        }
      }
    ]
  );
}
```

---

#### **Example: Failed Recording Card with Report Button**

```typescript
<View style={styles.actions}>
  <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
    <Text>🔄 Retry</Text>
  </TouchableOpacity>

  <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
    <Text>🗑️ Delete</Text>
  </TouchableOpacity>

  <ReportProblemButton
    errorContext={{
      errorType: 'ANALYSIS_ERROR',
      errorMessage: recording.analysisError,
      errorCode: recording.analysisErrorCode,
      sessionId: recording.id,
      timestamp: recording.analysisFailedAt
    }}
    style={styles.reportButton}
  />
</View>
```

---

### **Team Notifications**

When user submits error report, notify team:

```javascript
// server/utils/notifications.cjs

async function notifyTeam(errorReport) {
  // Option 1: Slack webhook
  if (process.env.SLACK_WEBHOOK_URL) {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🐛 New Error Report from ${errorReport.user.email}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Error Type:* ${errorReport.errorType}\n*Error:* ${errorReport.errorMessage}`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*User Description:* ${errorReport.userDescription || 'None provided'}`
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'View in Dashboard' },
                url: `https://admin.yourapp.com/error-reports/${errorReport.id}`
              }
            ]
          }
        ]
      })
    });
  }

  // Option 2: Email
  if (process.env.TEAM_EMAIL) {
    await sendEmail({
      to: process.env.TEAM_EMAIL,
      subject: `Error Report: ${errorReport.errorType}`,
      body: `
        User: ${errorReport.user.email}
        Error: ${errorReport.errorMessage}
        Description: ${errorReport.userDescription}
        Session: ${errorReport.sessionId}
        Reported: ${errorReport.reportedAt}
      `
    });
  }
}
```

---

## Summary of Answers

1. **Rollout Strategy:** ✅ **All-at-once recommended** (3 days vs 5-7 days phased)
   - Lower integration issues
   - Cleaner testing
   - Faster delivery
   - Good rollback strategy exists

2. **Error Monitoring:** ✅ **Sentry confirmed**
   - Backend error tracking
   - User context and tags
   - Alert configuration
   - Only 500+ errors sent

3. **Failed Recordings:** ✅ **Three types identified**
   - Recording failures (client) - retry by re-recording
   - Upload failures (network) - retry upload
   - **Processing failures (backend) - RETRY FROM UI ⭐**
     - Max 3 retries per recording
     - Track retry history in database
     - Show retry button on HomeScreen

4. **Error Tracking:** ✅ **Enhanced database schema**
   - `ErrorLog` table for detailed tracking
   - `ErrorMetrics` table for aggregation
   - Retry tracking in `Session` model
   - Analytics queries for insights
   - Dashboard visualizations

5. **User Feedback:** ✅ **"Report Problem" button**
   - Three-button error alerts
   - Optional user description
   - Stored in `UserErrorReport` table
   - Team notifications (Slack/Email)
   - Admin dashboard to manage reports

---

## Next Steps

Ready to proceed with implementation?

1. ✅ Schema migration for error tracking
2. ✅ Implement Phase 1 (Foundation)
3. ✅ Implement Phase 2 (UX)
4. ✅ Implement Phase 3 (Monitoring)
5. ✅ Add retry functionality for failed recordings
6. ✅ Add "Report Problem" feature

**Say "proceed" to begin implementation!**
