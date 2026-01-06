# Amplitude Implementation Plan

## **Overview**
Implement comprehensive analytics tracking across the Nora mobile app to understand user behavior, engagement patterns, and drop-off points.

---

## **Phase 1: Core Value Events** (Lessons, Recordings, Reports)

### **1.1 Lesson Tracking**

**Events to implement:**
- `Lesson Started`
- `Lesson Segment Viewed`
- `Lesson Completed`
- `Quiz Answered`

**Event properties:**
- `source`: `'home_screen'` | `'lesson_list'` | `'deep_link'`
- `lessonId`
- `lessonTitle`
- `lessonPhase`: `'CONNECT'` | `'DISCIPLINE'`
- `dayNumber`
- `isBooster`: boolean
- For Quiz: `isCorrect`, `attemptNumber`, `selectedAnswer`

**Files to modify:**
- `nora-mobile/src/screens/HomeScreen.tsx` - Add source: 'home_screen' when user taps lesson card
- `nora-mobile/src/screens/LessonListScreen.tsx` - Add source: 'lesson_list' when user selects from list
- `nora-mobile/src/screens/LessonViewerScreen.tsx` - Track segment views, quiz answers, completion
- `nora-mobile/src/services/amplitudeService.ts` - Update method signatures to accept properties

---

### **1.2 Recording Tracking**

**Events to implement:**
- `Recording Started`
- `Recording Completed`
- `Recording Uploaded`

**Event properties:**
- `source`: `'home_screen'` | `'record_tab'` | `'lesson_prompt'`
- `duration`: number (seconds)
- `fileSize`: number (bytes)
- `recordingId`: string
- For lesson-prompted: `lessonId`, `lessonTitle`

**Files to modify:**
- `nora-mobile/src/screens/HomeScreen.tsx` - Add source: 'home_screen'
- `nora-mobile/src/screens/RecordScreen.tsx` (or equivalent) - Add source: 'record_tab'
- Recording upload handler - Track upload completion
- `nora-mobile/src/services/amplitudeService.ts` - Update method signatures

---

### **1.3 Report Viewing Tracking**

**Events to implement:**
- `Report Viewed`

**Event properties:**
- `source`: `'home_last_session'` | `'home_next_action'` | `'progress_tab'` | `'notification'`
- `recordingId`: string
- `score`: number
- `timeSinceRecording`: number (minutes)
- `hasViewedBefore`: boolean

**Files to modify:**
- `nora-mobile/src/screens/HomeScreen.tsx` - Two different cards (last session vs next action)
- `nora-mobile/src/screens/ProgressScreen.tsx` (or recordings list) - Add source: 'progress_tab'
- Notification handler - Add source: 'notification'
- `nora-mobile/src/services/amplitudeService.ts` - Update method signatures

---

## **Phase 2: Engagement Events**

### **2.1 App Session Tracking**

**Events to implement:**
- `App Opened` (use Amplitude's built-in session tracking)
- `Phase Advanced` (already in celebration modal)

**User properties to set:**
- Update on login/app start:
  - `currentPhase`
  - `currentStreak`
  - `longestStreak`
  - `totalLessonsCompleted`
  - `totalRecordings`
  - `daysInApp`

**Files to modify:**
- `nora-mobile/App.tsx` - Track app opened, set user properties
- `nora-mobile/src/contexts/AuthContext.tsx` - Update user properties when user data changes

---

### **2.2 Notification Tracking**

**Events to implement:**
- `Notification Permission Requested`
- `Notification Permission Granted/Denied`
- `Notification Received`
- `Notification Opened`

**Event properties:**
- `type`: `'daily_reminder'` | `'report_ready'` | `'streak_reminder'` | `'phase_advanced'`
- `granted`: boolean (for permission)

**Files to modify:**
- `nora-mobile/src/utils/notifications.ts` - Add tracking when permission requested/granted
- Push notification handlers - Track received/opened

---

### **2.3 Streak Tracking**

**Events to implement:**
- `Streak Milestone Reached`

**Event properties:**
- `streakCount`: number
- `milestone`: 3 | 7 | 14 | 30 | 60 | 90 (track key milestones)

**Files to modify:**
- Server-side: `server/routes/recordings.cjs` - Track when streak updates
- Or client-side: When streak data updates

---

## **Phase 3: Onboarding Tracking**

### **3.1 Onboarding Flow**

**Events to implement:**
- `Onboarding Screen Viewed`
- `Onboarding Step Completed`
- `Onboarding Completed`
- `Onboarding Exited`

**Event properties:**
- `screen`: `'welcome'` | `'child_issue'` | `'child_info'` | `'create_account'` | `'login'`
- `step`: number (1-4)
- `exitReason`: `'back_button'` | `'app_closed'` | `'error'`

**Files to modify:**
- `nora-mobile/src/screens/onboarding/WelcomeScreen.tsx`
- `nora-mobile/src/screens/onboarding/ChildIssueScreen.tsx`
- `nora-mobile/src/screens/onboarding/CreateAccountScreen.tsx`
- `nora-mobile/src/screens/onboarding/LoginScreen.tsx`
- Track screen views on mount, completion on navigation, exit on unmount

---

## **Implementation Steps**

### **Step 1: Update amplitudeService.ts**
- Modify all tracking methods to accept optional `properties` parameter
- Update method signatures:
  ```typescript
  trackLessonStarted(lessonId: string, lessonTitle: string, properties?: Record<string, any>)
  trackRecordingStarted(properties?: Record<string, any>)
  trackReportViewed(recordingId: string, score?: number, properties?: Record<string, any>)
  ```

### **Step 2: Implement Phase 1 - Core Events**
- Add lesson tracking to HomeScreen, LessonListScreen, LessonViewerScreen
- Add recording tracking to HomeScreen, RecordScreen, upload handlers
- Add report tracking to all report entry points

### **Step 3: Implement Phase 2 - Engagement**
- Add user property updates to App.tsx and AuthContext
- Add notification tracking to notification handlers
- Add streak milestone tracking

### **Step 4: Implement Phase 3 - Onboarding**
- Add screen view tracking to all onboarding screens
- Add exit tracking with useEffect cleanup

### **Step 5: Testing**
- Test each event fires correctly in Amplitude debug view
- Verify properties are passed correctly
- Test onboarding drop-off tracking

---

## **Expected Outcomes**

After implementation, you'll be able to answer:
- **Where do users engage most?** (Which lesson source drives more completions?)
- **What's the primary recording trigger?** (Home button vs record tab?)
- **How do users discover their reports?** (Notification vs proactive checking?)
- **Where do users drop off in onboarding?** (Which screen loses the most users?)
- **What's the user journey?** (Lesson → Recording → Report flow completion rate)

---

## **Files Summary**

**To modify (~15 files):**
1. `nora-mobile/src/services/amplitudeService.ts` - Update method signatures
2. `nora-mobile/src/screens/HomeScreen.tsx` - Track lesson/recording/report from home
3. `nora-mobile/src/screens/LessonListScreen.tsx` - Track lesson from list
4. `nora-mobile/src/screens/LessonViewerScreen.tsx` - Track segments, quiz, completion
5. `nora-mobile/src/screens/RecordScreen.tsx` - Track recording from tab
6. `nora-mobile/src/screens/ProgressScreen.tsx` - Track report from progress
7. `nora-mobile/App.tsx` - Track app opened, set user properties
8. `nora-mobile/src/contexts/AuthContext.tsx` - Update user properties
9. `nora-mobile/src/utils/notifications.ts` - Track permissions
10. `nora-mobile/src/screens/onboarding/WelcomeScreen.tsx` - Track onboarding
11. `nora-mobile/src/screens/onboarding/ChildIssueScreen.tsx` - Track onboarding
12. `nora-mobile/src/screens/onboarding/CreateAccountScreen.tsx` - Track onboarding
13. `nora-mobile/src/screens/onboarding/LoginScreen.tsx` - Track onboarding
14. Push notification handlers (wherever they are)
15. Recording upload handler (wherever it is)

---

## **Status**

- [ ] Phase 1: Core Value Events
- [ ] Phase 2: Engagement Events
- [ ] Phase 3: Onboarding Tracking
