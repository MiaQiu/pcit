# Testing Plan - Happy Pillar PCIT App

**Date**: November 21, 2024
**Phase**: Phase 6 - Testing & Validation
**Status**: Backend Running ✅ | Frontend Ready for Testing

---

## Quick Start

### 1. Start Backend Server
```bash
npm run server
# Server should start on http://localhost:3001
# Health check: http://localhost:3001/api/health
```

### 2. Start Frontend Development Server
```bash
npm run dev
# Frontend should start on http://localhost:5173
```

### 3. Run Both Concurrently
```bash
npm run dev:all
```

---

## Test Environment Status

### ✅ Backend Services
- [x] Server running on port 3001
- [x] PostgreSQL database connected (136.114.122.94:5432)
- [x] Google Cloud Storage configured (happypillar-audio bucket)
- [x] Anthropic API configured
- [x] Email service configured
- [x] Health endpoint responding

### ✅ Database Schema
- [x] User table created
- [x] Session table created
- [x] RiskAuditLog table created
- [x] RefreshToken table created

### ✅ Authentication System
- [x] JWT generation and verification
- [x] Password hashing (bcrypt)
- [x] Refresh token management
- [x] Protected routes middleware

---

## Test Cases

## 1. Authentication Flow

### Test 1.1: User Signup
**Steps:**
1. Navigate to http://localhost:5173/signup
2. Fill in the form:
   - Name: Test User
   - Email: test@example.com
   - Password: Test123! (must have uppercase, lowercase, number)
   - Confirm Password: Test123!
   - Child Name: (optional)
3. Click "Sign Up"

**Expected Result:**
- ✅ User account created successfully
- ✅ Automatically logged in
- ✅ Redirected to home screen (/)
- ✅ Tokens stored in localStorage

**Validation:**
```bash
# Check database for new user
echo "SELECT email, name FROM \"User\" ORDER BY \"createdAt\" DESC LIMIT 1;" | \
  PGPASSWORD='c2UF:s>HcIbDE5~|' psql -h 136.114.122.94 -U postgres -d pcit
```

---

### Test 1.2: User Login
**Steps:**
1. If already logged in, logout first (Profile → Sign Out)
2. Navigate to http://localhost:5173/login
3. Enter credentials:
   - Email: test@example.com
   - Password: Test123!
4. Click "Sign In"

**Expected Result:**
- ✅ Successfully logged in
- ✅ Redirected to home screen
- ✅ Access and refresh tokens stored
- ✅ User info loaded in AuthContext

---

### Test 1.3: Protected Routes
**Steps:**
1. Logout (if logged in)
2. Try to navigate directly to http://localhost:5173/
3. Should be redirected to /login
4. After logging in, should access protected routes

**Expected Result:**
- ✅ Unauthenticated users redirected to login
- ✅ Authenticated users can access all screens

---

### Test 1.4: Token Refresh
**Steps:**
1. Login and wait 15+ minutes (access token expires)
2. Make an API request (e.g., navigate to Progress screen)
3. System should automatically refresh token

**Expected Result:**
- ✅ Token refreshed automatically
- ✅ No logout or interruption
- ✅ Request succeeds

---

## 2. Session Recording & Analysis

### Test 2.1: CDI Session Recording
**Steps:**
1. Login and navigate to home screen
2. Ensure CDI mode is selected
3. Click the record button
4. Speak for at least 30 seconds with PCIT-relevant dialogue:
   - "Great job building that tower!"
   - "I see you're using the red block"
   - "Thank you for sharing with me"
5. Stop recording
6. Wait for transcription and analysis

**Expected Result:**
- ✅ Audio recorded successfully
- ✅ Waveform visualizer works
- ✅ Timer shows duration
- ✅ Transcription completes
- ✅ PCIT coding appears
- ✅ Tag counts displayed
- ✅ CDI mastery calculation shown
- ✅ Competency analysis generated

---

### Test 2.2: Session Saving
**Steps:**
1. After completing recording and analysis (Test 2.1)
2. Click "Save Session" button
3. Wait for upload to complete

**Expected Result:**
- ✅ "Saving..." status shown
- ✅ Audio uploaded to Google Cloud Storage
- ✅ Session data saved to database
- ✅ "Session Saved!" confirmation appears
- ✅ Auto-redirect to Progress screen after 2 seconds

**Validation:**
```bash
# Check database for new session
echo "SELECT mode, \"durationSeconds\", \"masteryAchieved\", \"createdAt\" FROM \"Session\" ORDER BY \"createdAt\" DESC LIMIT 1;" | \
  PGPASSWORD='c2UF:s>HcIbDE5~|' psql -h 136.114.122.94 -U postgres -d pcit

# Check Google Cloud Storage
gsutil ls gs://happypillar-audio/audio/
```

---

### Test 2.3: PDI Session Recording
**Steps:**
1. Navigate to Recording screen
2. Select PDI mode
3. Record session with PDI-style commands:
   - "Put the block in the box"
   - "Come sit next to me"
   - "Stop throwing toys"
4. Complete recording and analysis

**Expected Result:**
- ✅ PDI mode indicators shown
- ✅ PDI-specific analysis (commands, labeled praise)
- ✅ Different tag counts (command, labeled_praise, etc.)
- ✅ Session saves correctly with mode=PDI

---

## 3. Progress Screen

### Test 3.1: Session List Display
**Steps:**
1. Navigate to Progress screen (bottom nav "Progress")
2. View list of saved sessions

**Expected Result:**
- ✅ All saved sessions displayed
- ✅ Sessions sorted by date (newest first)
- ✅ Mode badges (CDI/PDI) shown
- ✅ Date and duration displayed
- ✅ Tag counts summary visible
- ✅ Mastery badge shown if achieved
- ✅ Flagged badge shown if risk detected

---

### Test 3.2: Mode Filtering
**Steps:**
1. On Progress screen, click filter buttons:
   - Click "ALL" → shows all sessions
   - Click "CDI" → shows only CDI sessions
   - Click "PDI" → shows only PDI sessions

**Expected Result:**
- ✅ Filter applied correctly
- ✅ Only matching sessions shown
- ✅ Active filter highlighted

---

### Test 3.3: Empty State
**Steps:**
1. Create new user account
2. Navigate to Progress screen (no sessions yet)

**Expected Result:**
- ✅ Empty state message displayed
- ✅ Helpful prompt to record first session

---

## 4. Profile & User Management

### Test 4.1: Profile Display
**Steps:**
1. Navigate to Profile screen
2. View user information

**Expected Result:**
- ✅ Name displayed
- ✅ Email displayed
- ✅ Child name displayed (if provided)
- ✅ Member since date shown

---

### Test 4.2: Logout
**Steps:**
1. On Profile screen, click "Sign Out"

**Expected Result:**
- ✅ User logged out
- ✅ Tokens cleared from localStorage
- ✅ Redirected to login screen
- ✅ Protected routes inaccessible

---

## 5. Error Handling

### Test 5.1: Invalid Login
**Steps:**
1. Try to login with wrong password
2. Try to login with non-existent email

**Expected Result:**
- ✅ Error message displayed
- ✅ User not logged in
- ✅ No tokens stored

---

### Test 5.2: Network Errors
**Steps:**
1. Stop backend server
2. Try to save a session or load progress

**Expected Result:**
- ✅ Error message displayed
- ✅ Retry option available
- ✅ No app crash

---

### Test 5.3: Invalid Session Data
**Steps:**
1. Record very short audio (< 5 seconds)
2. Try to save

**Expected Result:**
- ✅ Appropriate error handling
- ✅ Clear error message to user

---

## 6. Security Tests

### Test 6.1: SQL Injection Prevention
**Test:** Try SQL injection in signup/login forms
```
Email: test@example.com'; DROP TABLE "User"; --
Password: anything
```

**Expected Result:**
- ✅ Input sanitized
- ✅ No SQL injection possible
- ✅ Error or invalid email message

---

### Test 6.2: XSS Prevention
**Test:** Try script injection in name field during signup
```
Name: <script>alert('XSS')</script>
```

**Expected Result:**
- ✅ Script tags escaped/sanitized
- ✅ No script execution
- ✅ Safe display of user data

---

### Test 6.3: Authentication Bypass
**Test:** Try to access protected routes without token
1. Clear localStorage tokens
2. Try to navigate to / or /progress

**Expected Result:**
- ✅ Redirected to login
- ✅ No data accessible without auth

---

### Test 6.4: Token Validation
**Test:** Try using expired or invalid tokens
1. Manually modify token in localStorage
2. Make API request

**Expected Result:**
- ✅ Request rejected
- ✅ User logged out
- ✅ Redirected to login

---

## 7. Data Privacy & PDPA Compliance

### Test 7.1: Data Encryption
**Verify:**
- ✅ Passwords hashed with bcrypt (not plaintext)
- ✅ RiskAuditLog.triggerExcerpt encrypted
- ✅ Database connection uses SSL (sslmode=require)
- ✅ GCS files private (not public)

**Check Database:**
```bash
echo "SELECT \"passwordHash\" FROM \"User\" LIMIT 1;" | \
  PGPASSWORD='c2UF:s>HcIbDE5~|' psql -h 136.114.122.94 -U postgres -d pcit
# Should show bcrypt hash, not plaintext
```

---

### Test 7.2: Access Control
**Verify:**
- ✅ Users can only see their own sessions
- ✅ Cannot access other users' data
- ✅ Proper WHERE userId clauses in all queries

---

### Test 7.3: Risk Audit Logging
**Steps:**
1. Record session with risk keywords ("hurt", "kill", etc.)
2. Check if RiskAuditLog entry created

**Validation:**
```bash
echo "SELECT \"riskLevel\", \"triggerSource\", \"actionTaken\" FROM \"RiskAuditLog\" ORDER BY timestamp DESC LIMIT 1;" | \
  PGPASSWORD='c2UF:s>HcIbDE5~|' psql -h 136.114.122.94 -U postgres -d pcit
```

**Expected Result:**
- ✅ Risk logged immediately
- ✅ Excerpt encrypted
- ✅ Immutable (cannot be deleted/modified)

---

## 8. Performance Tests

### Test 8.1: Audio Upload Speed
**Test:** Record 5-minute session and save
**Expected:** Upload completes in < 30 seconds

---

### Test 8.2: Session List Load Time
**Test:** With 20+ sessions, load Progress screen
**Expected:** List loads in < 2 seconds

---

### Test 8.3: Concurrent Users
**Test:** 2-3 users recording sessions simultaneously
**Expected:** No conflicts, all sessions save correctly

---

## Known Issues & Limitations

### Current Limitations:
1. No session detail screen yet (clicking session does nothing)
2. No session deletion UI (can delete via API only)
3. No user profile editing
4. No password reset functionality
5. No email verification on signup

### Issues to Fix:
- [ ] Add session detail screen
- [ ] Add delete session button with confirmation
- [ ] Add profile editing
- [ ] Implement forgot password flow
- [ ] Add email verification

---

## Test Results Summary

### ✅ Passing Tests
- Backend server startup
- Database connectivity
- GCS connectivity
- Health endpoint

### ⏳ Pending Manual Tests
- All authentication flows
- Session recording and saving
- Progress screen display
- Error handling
- Security tests

---

## Next Steps

1. **Run Manual Tests:** Follow test cases above
2. **Document Results:** Note any failures or bugs
3. **Fix Issues:** Address any bugs found
4. **Regression Testing:** Re-test after fixes
5. **Deploy to Production:** Once all tests pass

---

**Testing Completed By:** _____________
**Date:** _____________
**Overall Status:** ⏳ In Progress
