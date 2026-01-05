# Nora App - Stress Test Plan

## Executive Summary

This stress test plan is designed to validate the performance, scalability, and reliability of the Nora audio coaching application under various load conditions.

---

## 1. Test Objectives

### Primary Goals
- Verify App Runner auto-scaling (1-25 instances) works correctly
- Identify performance bottlenecks before they impact users
- Determine optimal instance size (1 vCPU/2GB vs 2 vCPU/4GB)
- Validate database connection pooling and query performance
- Test external API integrations under load (Anthropic, ElevenLabs, Transcription services)

### Success Criteria
- **Response Time**: 95th percentile < 2 seconds for API calls
- **Availability**: 99.9% uptime during test
- **Error Rate**: < 0.1% (excluding 4xx client errors)
- **Auto-scaling**: Successful scale from 1 → N instances within 2 minutes
- **Database**: No connection pool exhaustion
- **External APIs**: Graceful handling of rate limits

---

## 2. Critical Endpoints Analysis

### High Priority (Resource Intensive)

| Endpoint | Method | Complexity | Why Critical |
|----------|--------|-----------|--------------|
| `/api/recordings/upload/init` | POST | High | S3 presigned URL generation |
| `/api/recordings/:id/transcribe` | POST | Very High | Triggers transcription pipeline |
| `/api/recordings/pdi-speaker-and-coding` | POST | Very High | AI analysis (Anthropic API) |
| `/api/recordings/:id/analysis` | GET | High | Complex report generation |
| `/api/auth/login` | POST | Medium | Database query + JWT generation |
| `/api/sessions/latest` | GET | Medium | Database query with joins |

### Medium Priority

| Endpoint | Method | Complexity |
|----------|--------|-----------|
| `/api/auth/refresh` | POST | Low-Medium |
| `/api/lessons/*` | GET | Low-Medium |
| `/api/learning/*` | GET/POST | Low-Medium |
| `/api/recordings/` | GET | Medium |

### Low Priority (Health Checks)

| Endpoint | Method | Complexity |
|----------|--------|-----------|
| `/api/health` | GET | Very Low |
| `/api/recordings/share/:id` | GET | Low |

---

## 3. Load Test Scenarios

### Scenario 1: **Baseline Load** (Normal Day)
**Goal**: Establish performance baseline

- **Duration**: 30 minutes
- **Users**: 10 concurrent users
- **Pattern**: Steady state
- **Actions**:
  - Login (100% of users)
  - Upload audio recording (50% of users)
  - View latest session (80% of users)
  - Browse lessons (30% of users)

**Expected Outcome**:
- Single instance handles load comfortably
- CPU < 50%, Memory < 60%
- Avg response time < 500ms

---

### Scenario 2: **Peak Load** (Evening Rush)
**Goal**: Test typical peak traffic

- **Duration**: 1 hour
- **Users**: Ramp up 0 → 100 over 10 minutes, hold 100 for 40 minutes, ramp down
- **Pattern**: Realistic user journey
- **User Journey**:
  1. Login (100%)
  2. Upload audio (70%)
  3. Wait for transcription (async)
  4. Request analysis (60%)
  5. View reports (80%)
  6. Browse lessons (40%)

**Expected Outcome**:
- Auto-scale to 3-5 instances
- CPU < 70%, Memory < 75%
- 95th percentile response time < 2s
- Zero failed uploads

---

### Scenario 3: **Spike Test** (Viral Event / Launch)
**Goal**: Test sudden traffic spike handling

- **Duration**: 20 minutes
- **Users**: 0 → 200 users in 1 minute, hold for 10 minutes, drop to 0
- **Pattern**: Aggressive spike
- **Actions**: Focus on read-heavy operations (sessions, lessons, reports)

**Expected Outcome**:
- Auto-scale triggers within 30-60 seconds
- Some request latency increase (< 5s) but no failures
- Graceful handling of rate limits from external APIs

---

### Scenario 4: **Soak Test** (Stability Over Time)
**Goal**: Identify memory leaks and connection issues

- **Duration**: 6 hours
- **Users**: 30 concurrent users (constant)
- **Pattern**: Continuous realistic activity
- **Actions**: Full user journey on loop

**Expected Outcome**:
- Memory usage remains stable (no leaks)
- Database connections don't accumulate
- No degradation in response times over time

---

### Scenario 5: **Stress Test** (Find Breaking Point)
**Goal**: Determine maximum capacity

- **Duration**: 30 minutes
- **Users**: Ramp 0 → 500 over 15 minutes, hold until breaking point
- **Pattern**: Aggressive load increase
- **Actions**: Focus on heavy endpoints (transcription, AI analysis)

**Expected Outcome**:
- Identify at what user count the system starts failing
- Document failure modes (timeouts, 500 errors, connection pool exhaustion)
- Verify graceful degradation (not catastrophic failures)

---

## 4. Recommended Tools

### Option A: **k6** (Recommended)
**Why**: Modern, scriptable, excellent for API testing

```javascript
// Example k6 script structure
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '5m', target: 100 }, // Ramp up
    { duration: '30m', target: 100 }, // Stay at 100
    { duration: '5m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% < 2s
    http_req_failed: ['rate<0.01'], // <1% failures
  },
};

export default function () {
  // Test scenario here
}
```

**Installation**:
```bash
brew install k6  # macOS
# or
curl -L https://github.com/grafana/k6/releases/download/v0.48.0/k6-v0.48.0-macos-arm64.zip -o k6.zip
```

---

### Option B: **Artillery**
**Why**: Easy YAML config, good for beginners

```yaml
config:
  target: 'https://your-app-url.com'
  phases:
    - duration: 300
      arrivalRate: 10
      name: "Warm up"
    - duration: 1800
      arrivalRate: 50
      name: "Peak load"

scenarios:
  - name: "User journey"
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "test@example.com"
            password: "password"
      - get:
          url: "/api/sessions/latest"
```

---

### Option C: **Locust** (Python)
**Why**: Great UI, Python-based, easy to extend

```python
from locust import HttpUser, task, between

class NoraUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def view_sessions(self):
        self.client.get("/api/sessions/latest")

    @task(1)
    def upload_audio(self):
        # Upload logic here
        pass
```

---

## 5. Key Metrics to Monitor

### App Runner Metrics (CloudWatch)
- CPU Utilization (target: < 80%)
- Memory Utilization (target: < 85%)
- Active Instances (track auto-scaling)
- Request Count
- 4xx/5xx Error Rate
- Response Time (p50, p95, p99)

### Database Metrics (RDS CloudWatch)
- CPU Utilization
- Database Connections (monitor connection pool)
- Read/Write Latency
- Free Memory
- Query performance (slow query log)

### External API Metrics
- Anthropic API rate limits
- ElevenLabs API rate limits
- AssemblyAI/Deepgram rate limits
- S3 upload success rate

### Application Metrics
- Token bucket / rate limiting (if implemented)
- Average transcription time
- Average AI analysis time
- Cache hit rate (if using caching)

---

## 6. Test Data Preparation

### Mock Users
- Create 500 test users in database
- Use pattern: `stress-test-user-{001-500}@example.com`
- All with known password for easy login

### Mock Audio Files
- Prepare 10 sample audio files (varying lengths: 30s, 1min, 2min, 5min)
- Pre-upload to S3 for faster testing
- Use for upload simulation

### Database Seeding
```sql
-- Create test users
INSERT INTO users (id, email, password_hash, name, created_at)
SELECT
  gen_random_uuid(),
  'stress-test-' || i || '@example.com',
  '$2b$10$...', -- bcrypt hash of 'StressTest123!'
  'Test User ' || i,
  NOW()
FROM generate_series(1, 500) AS i;
```

---

## 7. Pre-Test Checklist

- [ ] Set App Runner to production configuration
- [ ] Enable detailed CloudWatch monitoring (1-minute intervals)
- [ ] Set up CloudWatch alarms for critical thresholds
- [ ] Configure S3 bucket for test uploads (or use separate test bucket)
- [ ] Verify database connection pool size (recommend: 20-30 connections)
- [ ] Set up test data (users, audio files)
- [ ] Document current baseline metrics
- [ ] Notify external API providers (Anthropic, ElevenLabs) about load test
- [ ] Set up monitoring dashboard (CloudWatch or Grafana)
- [ ] Schedule test during low-traffic period

---

## 8. Post-Test Analysis

### Metrics to Analyze
1. **Response Time Distribution**
   - p50, p95, p99 for each endpoint
   - Identify slow endpoints

2. **Auto-Scaling Behavior**
   - How long to scale up?
   - Was scaling triggered correctly?
   - Did instances scale down after load decreased?

3. **Error Analysis**
   - What types of errors occurred?
   - At what load did errors start?
   - Which endpoints failed first?

4. **Resource Utilization**
   - Peak CPU/Memory per instance
   - Database connection usage
   - S3 bandwidth usage

5. **Cost Analysis**
   - Total cost of test run
   - Cost projection at different load levels

---

## 9. Optimization Recommendations (Post-Test)

Based on results, consider:

### If CPU is bottleneck:
- Upgrade to 2 vCPU / 4 GB instances
- Optimize heavy computations
- Add caching layer (Redis)

### If Memory is bottleneck:
- Optimize data structures
- Implement streaming for large responses
- Fix memory leaks (if found)

### If Database is bottleneck:
- Add read replicas
- Optimize queries (add indexes)
- Implement query caching

### If External APIs are bottleneck:
- Implement request queuing
- Add retry logic with exponential backoff
- Cache API responses where appropriate

---

## 10. Next Steps

1. **Review and approve this plan**
2. **Choose testing tool** (recommend k6)
3. **Set up test environment**
4. **Create test scripts**
5. **Run baseline test** (Scenario 1)
6. **Analyze results and iterate**
7. **Run full test suite** (Scenarios 2-5)
8. **Document findings and implement optimizations**

---

## Appendix A: Sample k6 Test Script

```javascript
// nora-stress-test.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'https://your-app-url.com';

// Test users pool
const users = Array.from({ length: 100 }, (_, i) => ({
  email: `stress-test-${i + 1}@example.com`,
  password: 'StressTest123!'
}));

export let options = {
  scenarios: {
    peak_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10m', target: 100 }, // Ramp up
        { duration: '40m', target: 100 }, // Stay at peak
        { duration: '10m', target: 0 },   // Ramp down
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% < 2s
    http_req_failed: ['rate<0.01'],    // < 1% failures
  },
};

export default function () {
  const user = randomItem(users);
  let authToken;

  // 1. Login
  group('Authentication', () => {
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      email: user.email,
      password: user.password,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    check(loginRes, {
      'login successful': (r) => r.status === 200,
      'has access token': (r) => r.json('accessToken') !== undefined,
    });

    authToken = loginRes.json('accessToken');
  });

  if (!authToken) return;

  const authHeaders = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };

  sleep(1);

  // 2. Get latest session
  group('View Sessions', () => {
    const sessionsRes = http.get(`${BASE_URL}/api/sessions/latest`, {
      headers: authHeaders,
    });

    check(sessionsRes, {
      'sessions loaded': (r) => r.status === 200 || r.status === 404,
    });
  });

  sleep(2);

  // 3. Browse lessons (30% of users)
  if (Math.random() < 0.3) {
    group('Browse Lessons', () => {
      const lessonsRes = http.get(`${BASE_URL}/api/lessons`, {
        headers: authHeaders,
      });

      check(lessonsRes, {
        'lessons loaded': (r) => r.status === 200,
      });
    });
  }

  sleep(3);

  // 4. Request upload URL (simulation - 50% of users)
  if (Math.random() < 0.5) {
    group('Upload Audio', () => {
      const uploadInitRes = http.post(`${BASE_URL}/api/recordings/upload/init`,
        JSON.stringify({
          mimeType: 'audio/m4a',
        }), {
        headers: authHeaders,
      });

      check(uploadInitRes, {
        'upload init successful': (r) => r.status === 200,
        'has presigned URL': (r) => r.json('uploadUrl') !== undefined,
      });
    });
  }

  sleep(5);
}

export function handleSummary(data) {
  return {
    'stress-test-results.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
```

---

## Appendix B: Monitoring Dashboard Queries

### CloudWatch Insights Query - Slow Requests
```
fields @timestamp, @message
| filter @message like /api/
| filter duration > 2000
| sort @timestamp desc
| limit 100
```

### CloudWatch Insights Query - Error Rate
```
fields @timestamp, statusCode, path
| filter statusCode >= 500
| stats count() by path
| sort count desc
```

---

**Document Version**: 1.0
**Created**: 2026-01-03
**Owner**: Nora Engineering Team
