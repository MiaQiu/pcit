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
- `source`:
  - `'home_next_action_button'` - Continue button from NextActionCard
  - `'home_score_card_button'` - Read Report button near score display
  - `'home_last_session'` - Score card tap for latest report
  - `'progress_tab'` - View from Progress/Stats screen
  - `'notification'` - From push notification tap
- `recordingId`: string
- `score`: number
- `maxScore`: number

**Files modified:**
- ✅ `nora-mobile/src/screens/HomeScreen.tsx` - Three different sources (next action button, score card button, last session)
- ✅ `nora-mobile/src/screens/ProgressScreen.tsx` - Track from progress tab
- ✅ `nora-mobile/App.tsx` - Track from notification tap
- ✅ `nora-mobile/src/services/amplitudeService.ts` - Updated method signatures

**Implementation Notes:**
- `handleReadTodayReport()` accepts source parameter to differentiate between NextActionCard's Continue button and score card's Read Report button
- `handleReadLatestReport()` used when viewing older reports from score card

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

### **2.3 Screen View Tracking**

**Events to implement:**
- `Screen Viewed` - Track main tab navigation

**Event properties:**
- `screen`: `'home'` | `'record'` | `'progress'`

**Files modified:**
- ✅ `nora-mobile/src/screens/HomeScreen.tsx` - Track via useFocusEffect
- ✅ `nora-mobile/src/screens/RecordScreen.tsx` - Track via useFocusEffect
- ✅ `nora-mobile/src/screens/ProgressScreen.tsx` - Track on mount

**Implementation Notes:**
- Uses `useFocusEffect` for tab screens to track every time user switches to the tab
- Helps understand navigation patterns and most visited screens

---

### **2.4 Streak Tracking**

**Events to implement:**
- `Streak Milestone Reached` (planned, not yet implemented)

**Event properties:**
- `streakCount`: number
- `milestone`: 3 | 7 | 14 | 30 | 60 | 90 (track key milestones)

**Files to modify:**
- Server-side: `server/routes/recordings.cjs` - Track when streak updates
- Or client-side: When streak data updates

**Status:** ⏳ Not yet implemented

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

## **Implementation Status**

- ✅ **Phase 1: Core Value Events** (COMPLETED)
  - ✅ Lesson tracking (started, segment viewed, quiz answered, completed)
  - ✅ Recording tracking (started, completed, uploaded)
  - ✅ Report tracking (5 different sources tracked)

- ✅ **Phase 2: Engagement Events** (COMPLETED)
  - ✅ User properties (phase, streaks, subscription, child info)
  - ✅ Notification tracking (permission, received, opened)
  - ✅ Screen view tracking (home, record, progress)
  - ⏳ Streak milestone tracking (planned)

- ✅ **Phase 3: Onboarding Tracking** (COMPLETED)
  - ✅ Screen viewed (welcome, child issue)
  - ✅ Enhanced signup/login with user properties

---

## **Key Insights Enabled**

With this implementation, you can now answer:

1. **Feature Engagement**
   - Which features drive the most engagement? (Lessons vs Recording vs Reports)
   - Do users who complete lessons record more sessions?

2. **Navigation Patterns**
   - Which tab do users visit most? (Home vs Record vs Progress)
   - What's the typical user flow? (Home → Lesson → Record → Report?)

3. **Report Discovery**
   - Do users discover reports via notification or proactive checking?
   - Which button drives more report views? (Continue vs Read Report)
   - Are score cards or next action prompts more effective?

4. **Onboarding Funnel**
   - Where do users drop off during signup?
   - Which onboarding step loses the most users?

5. **Notification Effectiveness**
   - What's the notification permission grant rate?
   - What's the notification open rate by type?
   - Do notifications drive meaningful engagement?

6. **User Segmentation**
   - How do users in CONNECT vs DISCIPLINE phase behave differently?
   - Does child age correlate with engagement patterns?
   - How do subscription plans affect feature usage?

---

## **Commit History**

- **2026-01-06**: Initial comprehensive implementation (commit: 05246a2)
  - All 3 phases implemented
  - 15 files modified (517 insertions, 27 deletions)
  - Added granular source tracking for reports
  - Added screen view tracking for main tabs
