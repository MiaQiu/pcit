# ⚠️ CRITICAL SECURITY WARNING

**Date:** December 4, 2025
**Status:** TEMPORARY DEVELOPMENT CONFIGURATION - NOT FOR PRODUCTION

---

## Authentication Currently Disabled

The `requireAuth` middleware has been **temporarily removed** from **ALL** API endpoints to enable mobile app development and testing without requiring login functionality.

This is a **CRITICAL SECURITY VULNERABILITY** that **MUST** be fixed before any production deployment.

---

## Affected Endpoints

### Lesson Endpoints (`/server/routes/lessons.cjs`)
```javascript
// Lines with requireAuth REMOVED:
- Line 84:  GET  /api/lessons
- Line 161: GET  /api/lessons/:id
- Line 323: PUT  /api/lessons/:id/progress
- Line 390: POST /api/lessons/:quizId/submit
```

### Recording Endpoints (`/server/routes/recordings.cjs`)
```javascript
// Lines with requireAuth REMOVED:
- Line 55:  POST /api/recordings/upload
- Line 168: GET  /api/recordings/:id
- Line 215: GET  /api/recordings
```

---

## Current Fallback Behavior

All endpoints now use a fallback `test-user-id` when `req.userId` is not present:

```javascript
const userId = req.userId || 'test-user-id';
```

This means:
- **Anyone can access ANY user's data without authentication**
- **Anyone can upload recordings without authentication**
- **Anyone can modify ANY user's lesson progress**
- **No user isolation or data protection**

---

## Why This Was Done

**Reason:** To enable rapid development and testing of the mobile app without blocking on authentication implementation.

**Trade-off:** Security was temporarily sacrificed for development velocity.

**Timeline:** Expected to be re-enabled when Phase 2B (Authentication/Onboarding) is implemented.

---

## What MUST Be Done Before Production

### 1. Implement Authentication Screens (Phase 2B)
- [ ] Build LoginScreen with email/password
- [ ] Build SignupScreen with validation
- [ ] Implement secure token storage with SecureStore
- [ ] Create AuthContext with @nora/core AuthService
- [ ] Add token refresh logic
- [ ] Handle authentication errors gracefully

### 2. Re-enable Authentication Middleware

**In `/server/routes/lessons.cjs`:**

```javascript
// RESTORE THESE LINES:

// Line 84 - GET /api/lessons
router.get('/', requireAuth, async (req, res) => {
  const userId = req.userId; // Remove fallback

// Line 161 - GET /api/lessons/:id
router.get('/:id', requireAuth, async (req, res) => {
  const userId = req.userId; // Remove fallback

// Line 323 - PUT /api/lessons/:id/progress
router.put('/:id/progress', requireAuth, async (req, res) => {
  const userId = req.userId; // Remove fallback

// Line 390 - POST /api/lessons/:quizId/submit
router.post('/:quizId/submit', requireAuth, async (req, res) => {
  const userId = req.userId; // Remove fallback
```

**In `/server/routes/recordings.cjs`:**

```javascript
// RESTORE THESE LINES:

// Line 55 - POST /api/recordings/upload
router.post('/upload', requireAuth, upload.single('audio'), async (req, res) => {
  const userId = req.userId; // Remove fallback

// Line 168 - GET /api/recordings/:id
router.get('/:id', requireAuth, async (req, res) => {
  const userId = req.userId; // Remove fallback

// Line 215 - GET /api/recordings
router.get('/', requireAuth, async (req, res) => {
  const userId = req.userId; // Remove fallback
```

### 3. Remove All `test-user-id` Fallbacks

Search for and remove all instances of:
```javascript
const userId = req.userId || 'test-user-id';
```

Replace with:
```javascript
const userId = req.userId; // Will be set by requireAuth middleware
```

### 4. Test Authentication Flow

- [ ] Test login with valid credentials
- [ ] Test login with invalid credentials
- [ ] Test signup with new user
- [ ] Test signup with existing email
- [ ] Test protected endpoint access without token
- [ ] Test protected endpoint access with valid token
- [ ] Test protected endpoint access with expired token
- [ ] Test token refresh mechanism

---

## Security Risks While Disabled

| Risk | Impact | Severity |
|------|--------|----------|
| **Data Access** | Any user can read any other user's data | 🔴 CRITICAL |
| **Data Modification** | Any user can modify any other user's progress | 🔴 CRITICAL |
| **Unauthorized Uploads** | Anyone can upload recordings to S3 | 🔴 CRITICAL |
| **Resource Abuse** | No rate limiting or user accountability | 🟡 HIGH |
| **Compliance** | Violates data privacy regulations (GDPR, CCPA) | 🔴 CRITICAL |

---

## How to Remember to Fix This

1. **Git Commit Messages:** All commits that removed auth include "TEMPORARY" warnings
2. **Code Comments:** Every affected route has `// TEMPORARY: Auth disabled for development`
3. **TODO Comments:** Every route has `// TODO: Re-enable requireAuth when authentication is implemented`
4. **Documentation:** This file and planning docs highlight the security risk
5. **Pre-Production Checklist:** Add "Re-enable authentication" as first item

---

## Testing Checklist Before Re-enabling Auth

Before re-enabling authentication, ensure:

- [ ] Mobile app has working login/signup screens
- [ ] Token storage is implemented with SecureStore
- [ ] AuthContext provides tokens to API calls
- [ ] All API calls include Authorization header
- [ ] Token refresh mechanism works correctly
- [ ] Error handling for 401/403 responses implemented
- [ ] Logout functionality implemented
- [ ] Token expiration handled gracefully

---

## Current Development Status

**Last Updated:** December 4, 2025

**Phase 2B Status:** Not started - Authentication implementation pending

**Mobile App Status:**
- ✅ Lesson flow working without auth
- ✅ Recording upload working without auth
- ❌ No login screen
- ❌ No signup screen
- ❌ No token management

**Backend Status:**
- ✅ All endpoints functional
- ❌ No authentication enforcement
- ⚠️ Using fallback `test-user-id` for all requests

---

## Related Files

**Planning Documents:**
- `/Users/mia/nora/nora-mobile/UI_IMPLEMENTATION_PLAN.md` - See "Security Note" section
- `/Users/mia/nora/RECORDING_BACKEND_PHASE_5B.md` - See "Authentication Temporarily Disabled" section

**Code Files to Fix:**
- `/Users/mia/nora/server/routes/lessons.cjs` - 4 endpoints need requireAuth restored
- `/Users/mia/nora/server/routes/recordings.cjs` - 3 endpoints need requireAuth restored

**Middleware:**
- `/Users/mia/nora/server/middleware/auth.cjs` - requireAuth middleware (still working, just not being used)

---

## Questions to Ask Before Production

1. **Is Phase 2B (Authentication) complete?**
   - If NO → BLOCK PRODUCTION DEPLOYMENT

2. **Are all endpoints protected with requireAuth?**
   - If NO → BLOCK PRODUCTION DEPLOYMENT

3. **Are all `test-user-id` fallbacks removed?**
   - If NO → BLOCK PRODUCTION DEPLOYMENT

4. **Has authentication flow been tested end-to-end?**
   - If NO → BLOCK PRODUCTION DEPLOYMENT

5. **Do we have a security audit/review scheduled?**
   - If NO → SCHEDULE ONE BEFORE LAUNCH

---

## Contact

If you're reading this and about to deploy to production:

**STOP AND VERIFY AUTHENTICATION IS RE-ENABLED**

If you have questions, refer to:
- Phase 2B in `/Users/mia/nora/nora-mobile/UI_IMPLEMENTATION_PLAN.md`
- Authentication middleware in `/Users/mia/nora/server/middleware/auth.cjs`

---

**Remember: This is a development convenience, not a production configuration.**

**DO NOT DEPLOY TO PRODUCTION WITHOUT RE-ENABLING AUTHENTICATION.**
