# Error Logging: Custom ErrorLog Table vs Sentry

**Created:** 2025-12-29

---

## Quick Comparison

| Feature | Custom ErrorLog Table | Sentry |
|---------|----------------------|--------|
| **Location** | Your Postgres database | External SaaS service |
| **Cost** | Free (just database storage) | Free tier: 5K errors/month, then $26+/month |
| **Setup** | Prisma model + queries | Install SDK + configure DSN |
| **Query Flexibility** | Full SQL access | Limited API + web dashboard |
| **Business Data Integration** | ✅ Direct joins (Session, User) | ❌ Must correlate manually |
| **Real-time Alerts** | ❌ Must build yourself | ✅ Built-in (email, Slack, PagerDuty) |
| **Error Grouping** | ❌ Manual (SQL GROUP BY) | ✅ Automatic smart grouping |
| **UI Dashboard** | ❌ Must build yourself | ✅ Professional UI included |
| **Source Maps** | ❌ No support | ✅ Shows original source code |
| **Performance Monitoring** | ❌ No | ✅ APM included |
| **Data Privacy** | ✅ All data stays in your system | ⚠️ Data sent to third party |
| **Retention** | ✅ Forever (or your choice) | 90 days (free tier), longer on paid |
| **Analytics** | ✅ Custom SQL queries | ⚠️ Limited by their UI/API |
| **Compliance** | ✅ HIPAA/GDPR friendly | ⚠️ Requires BAA/DPA |

---

## Detailed Breakdown

### **1. Custom ErrorLog Table**

**What it is:**
- A Postgres table in your own database
- You manually insert error records
- Query with SQL
- Full control over schema and retention

**Schema:**
```prisma
model ErrorLog {
  id            String   @id @default(cuid())

  // Your business context
  userId        String?
  sessionId     String?
  session       Session? @relation(fields: [sessionId], references: [id])

  // Error details
  errorType     String
  errorCode     String
  errorMessage  String   @db.Text
  stackTrace    String?  @db.Text

  // Request context
  endpoint      String?
  httpMethod    String?

  // Custom metadata (any JSON you want)
  metadata      Json?

  occurredAt    DateTime @default(now())

  @@index([userId])
  @@index([sessionId])
  @@index([errorType])
}
```

**Example usage:**
```javascript
// When error occurs
await prisma.errorLog.create({
  data: {
    userId: user.id,
    sessionId: session.id,
    errorType: 'TRANSCRIPTION_ERROR',
    errorCode: 'API_TIMEOUT',
    errorMessage: error.message,
    stackTrace: error.stack,
    endpoint: '/api/transcription',
    metadata: {
      audioUrl: session.audioUrl,
      durationSeconds: session.durationSeconds,
      attemptNumber: 2
    }
  }
});

// Query errors
const errorsByType = await prisma.errorLog.groupBy({
  by: ['errorType', 'errorCode'],
  _count: true,
  where: {
    occurredAt: {
      gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    }
  },
  orderBy: {
    _count: {
      errorType: 'desc'
    }
  }
});
```

**Strengths:**
- ✅ **Full SQL power** - Complex joins, aggregations, analytics
- ✅ **Business context** - Join with Session, User, Lesson tables
- ✅ **Free** - No external service costs
- ✅ **Privacy** - Data never leaves your infrastructure
- ✅ **Custom fields** - Add any fields you want
- ✅ **Forever retention** - Keep data as long as you want
- ✅ **HIPAA/GDPR compliant** - No third-party data sharing

**Example: Advanced Query**
```sql
-- Find users with high error rates
SELECT
  u.email,
  COUNT(DISTINCT s.id) as total_sessions,
  COUNT(DISTINCT el.id) as total_errors,
  ROUND(COUNT(DISTINCT el.id)::numeric / COUNT(DISTINCT s.id) * 100, 2) as error_rate
FROM "User" u
LEFT JOIN "Session" s ON s."userId" = u.id
LEFT JOIN "ErrorLog" el ON el."sessionId" = s.id
WHERE s."createdAt" >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.email
HAVING COUNT(DISTINCT s.id) > 5
ORDER BY error_rate DESC;
```

**Weaknesses:**
- ❌ **No dashboard** - Must build your own UI or write SQL queries
- ❌ **No grouping** - Can't automatically see "this error happened 50 times"
- ❌ **No alerts** - Must build alert system yourself
- ❌ **No context** - Can't see user journey before error (no breadcrumbs)
- ❌ **No release tracking** - Can't see "errors increased after deploy X"
- ❌ **Manual correlation** - Must manually find related errors

---

### **2. Sentry**

**What it is:**
- External error monitoring SaaS platform
- Automatically captures errors, stack traces, context
- Professional dashboard and alerting
- Tracks releases, performance, user sessions

**Setup:**
```javascript
// server.cjs
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: 'https://abc123@sentry.io/456',
  environment: 'production',
  tracesSampleRate: 0.1
});

// Capture error
Sentry.captureException(error, {
  user: { id: user.id, email: user.email },
  tags: {
    errorType: 'TRANSCRIPTION_ERROR',
    sessionId: session.id
  },
  extra: {
    audioUrl: session.audioUrl,
    durationSeconds: session.durationSeconds
  }
});
```

**What you get:**

**Dashboard Features:**
- 📊 Error grouping (automatically combines similar errors)
- 📈 Trends and graphs
- 🔔 Real-time alerts (email, Slack, PagerDuty)
- 🔍 Search and filters
- 👥 Assign errors to team members
- ✅ Mark as resolved/ignored
- 📦 Release tracking (see which deploy introduced errors)
- 🍞 Breadcrumbs (what user did before error)
- 🌍 User impact (how many users affected)

**Example Dashboard View:**
```
Issues (Last 7 days)

┌─────────────────────────────────────────────────────────┐
│ TypeError: Cannot read property 'id' of undefined      │
│ 847 events • 234 users                                 │
│ recordings.cjs:256                                     │
│ First seen: 3 days ago • Last seen: 2 minutes ago     │
│ [Resolve] [Ignore] [Assign to: Alex]                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ API_TIMEOUT: Claude API request timed out             │
│ 432 events • 89 users                                  │
│ analysisService.cjs:123                                │
│ First seen: 2 days ago • Last seen: 5 minutes ago     │
│ [Resolve] [Ignore] [Assign to: Sam]                   │
└─────────────────────────────────────────────────────────┘
```

**Strengths:**
- ✅ **Zero setup UI** - Beautiful dashboard out of the box
- ✅ **Smart grouping** - "This error happened 847 times" (not 847 rows)
- ✅ **Real-time alerts** - Get notified immediately
- ✅ **Context** - See user actions before error (breadcrumbs)
- ✅ **Release tracking** - "This error started after deploy abc123"
- ✅ **Source maps** - Shows original TypeScript code (not compiled JS)
- ✅ **Team collaboration** - Assign, comment, resolve
- ✅ **Performance monitoring** - See slow endpoints
- ✅ **Integrations** - Slack, Jira, GitHub, etc.

**Weaknesses:**
- ❌ **Cost** - $26/month after 5K errors/month (can get expensive)
- ❌ **Limited queries** - Can't do complex SQL analytics
- ❌ **External service** - Data sent to third party
- ❌ **Retention limits** - 90 days on free tier
- ❌ **No business context** - Can't join with your database tables
- ❌ **Compliance** - Need BAA for HIPAA, DPA for GDPR

---

## What Should You Use?

### **Option 1: Both (Recommended)**

Use **both** for different purposes:

**Sentry for:**
- Real-time error monitoring and alerts
- Finding and fixing bugs quickly
- Release tracking
- Team collaboration
- Development/staging environments

**ErrorLog Table for:**
- Business analytics (error rates by user cohort)
- Long-term retention (keep data forever)
- Custom queries joining with business data
- Compliance/audit requirements
- Historical analysis (trends over months/years)

**Example workflow:**
1. Error occurs in production
2. **Sentry** captures it → Team gets Slack notification
3. **ErrorLog** records it → Available for analytics queries
4. Developer fixes bug in Sentry dashboard
5. Analyst runs SQL query to see user impact

**Code:**
```javascript
catch (error) {
  // Log to console
  console.error('[ERROR]', error);

  // Send to Sentry (real-time monitoring)
  if (process.env.SENTRY_DSN && error.statusCode >= 500) {
    Sentry.captureException(error, {
      user: { id: user.id },
      tags: { errorCode: error.code }
    });
  }

  // Save to database (analytics)
  await prisma.errorLog.create({
    data: {
      userId: user.id,
      sessionId: session?.id,
      errorType: 'PROCESSING_ERROR',
      errorCode: error.code,
      errorMessage: error.message,
      stackTrace: error.stack
    }
  });

  // Return error to user
  throw error;
}
```

**Cost:** ~$26/month for Sentry (after free tier)

---

### **Option 2: ErrorLog Table Only (Budget-Friendly)**

Use **only** custom ErrorLog table if:
- Budget is tight ($0 vs $26+/month)
- You need HIPAA/GDPR compliance
- You want full data ownership
- You're comfortable writing SQL queries
- You can build your own alerting (email on error)

**What you'll need to build:**
- Dashboard for viewing errors
- Alert system (email/Slack notifications)
- Error grouping logic
- Release correlation

**Cost:** $0 (just database storage)

**Recommended for:**
- Early stage startups
- Internal tools
- High-compliance industries (healthcare, finance)

---

### **Option 3: Sentry Only (Simplest)**

Use **only** Sentry if:
- You want fastest setup (10 minutes)
- You value time over money
- You don't need long-term analytics
- You're okay with data on external service
- You want all the features (alerts, grouping, etc.)

**Trade-offs:**
- Can't do complex business analytics
- Data retention limited (90 days free tier)
- Must correlate errors with business data manually

**Cost:** $0-$26+/month depending on volume

**Recommended for:**
- Fast-moving startups that prioritize speed
- Teams without data analysts
- Projects where time-to-resolution is critical

---

## Recommended Approach for Nora

Based on your app (healthcare-adjacent, PCIT therapy recordings):

### **Phase 1-2: ErrorLog Table Only**

**Why:**
- ✅ **Privacy** - Therapy recordings are sensitive (HIPAA considerations)
- ✅ **Free** - No external service costs during early stage
- ✅ **Analytics** - You can query error rates by user, analyze patterns
- ✅ **Control** - Full ownership of error data

**What you get:**
- All errors logged to database
- Can query with SQL for analytics
- Auto-reporting to Slack for permanent failures (you're already doing this)
- Full privacy and compliance

**What you're missing:**
- No real-time dashboard (must write SQL or build UI)
- No automatic error grouping
- Manual alert setup

---

### **Phase 3 (Optional): Add Sentry**

**When to add Sentry:**
- You have budget ($26+/month)
- You want faster debugging
- You want professional error dashboard
- Team is growing (multiple developers)

**How to use both:**
```javascript
// Critical errors (500+) → Sentry (for team alerts)
if (error.statusCode >= 500) {
  Sentry.captureException(error);
}

// All errors → ErrorLog (for analytics)
await prisma.errorLog.create({ ... });
```

**Strategy:**
- **Sentry:** Operational monitoring (fix bugs fast)
- **ErrorLog:** Business analytics (trends, user impact)

---

## Recommended Implementation Plan

### **Start with ErrorLog Table (Phase 1-3)**

**Phase 1:**
```prisma
model ErrorLog {
  id            String   @id @default(cuid())
  userId        String?
  sessionId     String?
  errorType     String
  errorCode     String
  errorMessage  String   @db.Text
  stackTrace    String?  @db.Text
  metadata      Json?
  occurredAt    DateTime @default(now())

  @@index([errorType])
  @@index([occurredAt])
}
```

**Log all errors:**
```javascript
await prisma.errorLog.create({
  data: {
    userId: user?.id,
    sessionId: session?.id,
    errorType: 'PROCESSING_ERROR',
    errorCode: error.code,
    errorMessage: error.message,
    stackTrace: error.stack,
    metadata: { /* any custom data */ }
  }
});
```

**Query for insights:**
```sql
-- Daily error counts
SELECT
  DATE_TRUNC('day', "occurredAt") as date,
  "errorType",
  COUNT(*) as count
FROM "ErrorLog"
WHERE "occurredAt" >= NOW() - INTERVAL '7 days'
GROUP BY date, "errorType"
ORDER BY date DESC, count DESC;

-- Top errors by user
SELECT
  u.email,
  el."errorType",
  COUNT(*) as error_count
FROM "ErrorLog" el
JOIN "User" u ON u.id = el."userId"
WHERE el."occurredAt" >= NOW() - INTERVAL '30 days'
GROUP BY u.email, el."errorType"
ORDER BY error_count DESC
LIMIT 20;
```

**Auto-report permanent failures to Slack:**
```javascript
// You're already doing this in the revised plan!
async function reportPermanentFailureToTeam(sessionId, error) {
  await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({ /* Slack message */ })
  });

  await prisma.errorLog.create({
    data: {
      errorType: 'PERMANENT_PROCESSING_FAILURE',
      errorCode: 'MAX_RETRIES_EXCEEDED',
      autoReported: true,
      // ...
    }
  });
}
```

---

### **Optionally Add Sentry Later (When Needed)**

**When you add Sentry:**
1. Install SDK: `npm install @sentry/node`
2. Initialize in server.cjs
3. Send only critical errors (500+)
4. Keep ErrorLog for all errors

**Code:**
```javascript
// Global error handler
app.use((err, req, res, next) => {
  // Always log to database
  await prisma.errorLog.create({ ... });

  // Optionally send to Sentry (if configured)
  if (process.env.SENTRY_DSN && err.statusCode >= 500) {
    Sentry.captureException(err, {
      user: { id: req.user?.id },
      tags: { errorCode: err.code }
    });
  }

  res.status(err.statusCode).json({ ... });
});
```

---

## Summary

### **Our ErrorLog Table**
- **Purpose:** Long-term analytics, business intelligence, compliance
- **Strengths:** SQL queries, joins with business data, free, private
- **Weaknesses:** No dashboard, no grouping, no alerts (unless you build them)

### **Sentry**
- **Purpose:** Real-time monitoring, fast debugging, team collaboration
- **Strengths:** Dashboard, alerts, grouping, release tracking, breadcrumbs
- **Weaknesses:** Costs money, limited retention, external service, no business analytics

### **Recommendation for Nora**

**Start with: ErrorLog Table Only**
- Free, private, compliant
- Good enough for early stage
- You already have Slack auto-reporting
- Can add Sentry later if needed

**Add Sentry when:**
- Team grows (3+ developers)
- Error volume increases (>1K errors/month)
- You have budget ($26+/month)
- You want faster debugging

**Best of both:**
- ErrorLog for analytics and compliance
- Sentry for operational monitoring and alerts
- Total cost: ~$26/month for Sentry

---

## Decision Matrix

| If you value... | Use... |
|----------------|--------|
| **Free** | ErrorLog only |
| **Privacy/Compliance** | ErrorLog only |
| **Fast debugging** | Sentry only |
| **Business analytics** | ErrorLog only |
| **Team collaboration** | Sentry only |
| **Both analytics + monitoring** | ErrorLog + Sentry |
| **Best of both worlds** | ErrorLog + Sentry |

---

**My recommendation:** Start with **ErrorLog only** (it's already in the revised plan). Add Sentry in 3-6 months if you need better monitoring.

Does this help clarify the difference? What would you like to do?
