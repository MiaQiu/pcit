# Amplitude Analytics

## Overview

Amplitude is used for product analytics in the Nora mobile app. A singleton `AmplitudeService` wraps the `@amplitude/analytics-react-native` SDK (v1.5.32) and is the single entry point for all tracking.

**File:** `nora-mobile/src/services/amplitudeService.ts`

---

## API Key & Environment

Both dev and production use the **same Amplitude project** (same API key), differentiated by an `environment` property automatically appended to every event.

| Environment | `__DEV__` | `environment` property |
|---|---|---|
| Development | `true` | `'development'` |
| Production | `false` | `'production'` |

API key is hardcoded in `amplitudeService.ts` (not in `.env`).

---

## Initialization

Called once in `nora-mobile/App.tsx` on mount:

```typescript
useEffect(() => {
  amplitudeService.init();
}, []);
```

**SDK configuration:**

| Setting | Value |
|---|---|
| `instanceName` | `'nora-mobile'` |
| `disableCookies` | `true` |
| `trackingOptions.ipAddress` | `false` (privacy) |
| `defaultTracking.sessions` | `true` (auto) |
| `defaultTracking.appLifecycles` | `true` (auto) |
| `defaultTracking.screenViews` | `true` (auto) |

Auto-tracked device properties: `appSetId`, `carrier`, `deviceManufacturer`, `deviceModel`, `language`, `osName`, `osVersion`, `platform`.

---

## User Identification

### On session restore
`nora-mobile/src/navigation/RootNavigator.tsx` — called after auth state is confirmed:

```typescript
amplitudeService.identifyUser(user.id, {
  email, name,
  currentStreak, longestStreak,
  subscriptionPlan, subscriptionStatus,
  childAge,           // derived from childBirthYear
  relationshipToChild,
});
```

### On login / signup
`LoginScreen.tsx` and `CreateAccountScreen.tsx` call `identifyUser` with: `email`, `name`, `currentStreak`, `longestStreak`, `subscriptionPlan`.

### On logout
`ProfileScreen.tsx` and `RootNavigator.tsx` call `amplitudeService.reset()` to clear the user ID and session.

---

## Events Reference

### Auth

| Event | Method | Key Properties |
|---|---|---|
| `User Signed Up` | `trackSignup()` | `method: 'email'` |
| `User Logged In` | `trackLogin()` | `method: 'email' \| 'social'` |

### Onboarding

All onboarding screens call `trackOnboardingScreen(screen, step)` on mount and `trackOnboardingStepCompleted(screen, step)` on advance.

| Event | Trigger |
|---|---|
| `Onboarding Screen Viewed` | Screen mounts |
| `Onboarding Step Completed` | User advances to next step |

**Onboarding step map:**

| Step | Screen |
|---|---|
| 1 | Welcome |
| 2 | Start |
| 4–10 | Demo1 → Demo5 (including B variants) |
| 11 | ParentingIntro |
| 12 | NameInput |
| 14 | ChildName |
| 16 | ChildBirthday |
| 18 | ChildSnapshotIntro |
| 28 | ChildBehaviorProfile |
| 29 | Intro3 |
| 30–34 | PlaySession1–5 |
| 35 | Subscription |
| 36 | NotificationPermission |

### Subscription

| Event | Source | Key Properties |
|---|---|---|
| `Subscription Trial Started` | `SubscriptionScreen` | `plan` |
| `Subscription Restored` | `SubscriptionScreen` | — |
| `Subscription Skipped` | `SubscriptionScreen`, `LoginScreen` | `isReturningUser` |

### Lessons

| Event | Method | Key Properties |
|---|---|---|
| `Lesson Started` | `trackLessonStarted()` | `lessonId`, `lessonTitle`, `source`, `moduleKey` |
| `Lesson Segment Viewed` | `trackLessonSegmentViewed()` | `lessonId`, `segmentNumber` |
| `Lesson Completed` | `trackLessonCompleted()` | `lessonId`, `lessonTitle`, `duration` |
| `Quiz Answered` | `trackQuizAnswered()` | `lessonId`, `quizId`, `isCorrect`, `attemptNumber` |
| `Text Input Submitted` | `trackEvent()` | lesson context |

**`source` values for `Lesson Started`:**
- `'home'` — tapped from HomeScreen
- `'home_today_plan'` — tapped from today's plan card
- `'learn'` — tapped from LearnScreen

### Recordings

| Event | Method | Key Properties |
|---|---|---|
| `Recording Started` | `trackRecordingStarted()` | `source`, `sessionType` |
| `Recording Completed` | `trackRecordingCompleted()` | `duration`, `fileSize` |
| `Recording Uploaded` | `trackRecordingUploaded()` | `recordingId`, `duration` |

`Recording Uploaded` is tracked in `UploadProcessingContext.tsx` after successful upload.

**`sessionType` values for `Recording Started`:**
- `'specialTime'` — play time session (CDI, 5 min)
- `'discipline'` — discipline session (PDI, 10 min)

### Reports

| Event | Method | Key Properties |
|---|---|---|
| `Report Viewed` | `trackReportViewed()` | `recordingId`, `score`, `source` |
| `Weekly Report Tapped` | `trackWeeklyReportTapped()` | `reportId` |
| `Weekly Report Viewed` | `trackWeeklyReportViewed()` | `reportId`, `headline` |

**`source` values for `Report Viewed`:**
- `'home'` — HomeScreen general
- `'home_today_plan'` — next action card
- `'home_score_card'` — score card tap
- `'progress_calendar'` — from ProgressScreen calendar
- `'notification'` — from push notification tap

`Weekly Report Tapped` fires in `ReportsSection.tsx` when a weekly report card is pressed.
`Weekly Report Viewed` fires in `WeeklyReportScreen.tsx` once the report data loads successfully.

### Chat

| Event | Screen | Key Properties |
|---|---|---|
| `Chat Opened` | `CoachChatScreen`, `PsychologistChatScreen` | `chat: 'ai_coach' \| 'psychologist'` |
| `Chat Message Sent` | `CoachChatScreen`, `PsychologistChatScreen` | `chat: 'ai_coach' \| 'psychologist'` |
| `Chat Suggestion Used` | `CoachChatScreen` | `chat: 'ai_coach'`, `suggestion` (suggestion title) |
| `Psychologist Requested` | `CoachChatScreen` | — |
| `Chat Bubble Tapped` | `HomeScreen_v2`, `ReportScreen` | `source` |

**`source` values for `Chat Bubble Tapped`:**
- `'home_fab'` — floating action button shown on home screen after first session
- `'report_demo'` — animated demo bubble on the report screen

### Screen Views

| Event | Screen | Trigger |
|---|---|---|
| `Screen Viewed` (`screen: 'home'`) | HomeScreen / HomeScreen_v2 | `useFocusEffect` |
| `Screen Viewed` (`screen: 'record'`) | RecordScreen | `useFocusEffect` |
| `Screen Viewed` (`screen: 'progress'`) | ProgressScreen | on mount |
| `Screen Viewed` (`screen: 'learn'`) | LearnScreen_v2 | `useFocusEffect` |

### Notifications

| Event | Method | Key Properties |
|---|---|---|
| `Notification Permission Requested` | `trackNotificationPermission()` | — |
| `Notification Permission` | `trackNotificationPermission()` | `granted: boolean` |
| `Notification Permission Skipped` | `trackEvent()` | — |
| `Notification Received` | `trackNotificationReceived()` | `type` |
| `Notification Opened` | `trackNotificationOpened()` | `type`, `notificationType` |

**`type` values:** `'new_report'`, `'weekly_report'`, etc.

### Errors

| Event | Method | Key Properties |
|---|---|---|
| `Error` | `trackError()` | `error`, `stack`, `context` |

---

## Service API

```typescript
class AmplitudeService {
  init(): void
  identifyUser(userId: string, userProperties: Record<string, any>): void
  reset(): void

  trackEvent(eventName: string, eventProperties: Record<string, any>): void
  trackScreenView(screenName: string, properties: Record<string, any>): void

  trackLogin(method?: string): void
  trackSignup(method?: string): void

  trackLessonStarted(lessonId: string, lessonTitle: string, properties: Record<string, any>): void
  trackLessonSegmentViewed(lessonId: string, segmentNumber: number, properties: Record<string, any>): void
  trackLessonCompleted(lessonId: string, lessonTitle: string, duration?: number, properties: Record<string, any>): void
  trackQuizAnswered(lessonId: string, quizId: string, isCorrect: boolean, attemptNumber: number, properties: Record<string, any>): void

  trackRecordingStarted(properties: Record<string, any>): void
  trackRecordingCompleted(duration: number, fileSize?: number, properties: Record<string, any>): void
  trackRecordingUploaded(recordingId: string, duration: number, properties: Record<string, any>): void

  trackReportViewed(recordingId: string, score?: number, properties: Record<string, any>): void
  trackChatBubbleTapped(source: string): void
  trackWeeklyReportTapped(reportId: string, properties?: Record<string, any>): void
  trackWeeklyReportViewed(reportId: string, headline?: string | null, properties?: Record<string, any>): void

  trackNotificationPermission(granted: boolean): void
  trackNotificationReceived(type: string): void
  trackNotificationOpened(type: string): void

  trackOnboardingScreen(screen: string, step: number): void
  trackOnboardingStepCompleted(screen: string, step: number): void

  trackError(error: Error, context?: string): void
}

export const amplitudeService = new AmplitudeService(); // singleton
```

---

## Common Properties

These properties appear frequently across events:

| Property | Type | Description |
|---|---|---|
| `environment` | `'development' \| 'production'` | Auto-added to all events |
| `source` | `string` | Where the action originated |
| `lessonId` | `string` | Lesson identifier |
| `lessonTitle` | `string` | Lesson display name |
| `moduleKey` | `string` | Module the lesson belongs to |
| `recordingId` | `string` | Recording identifier |
| `reportId` | `string` | Weekly report identifier |
| `headline` | `string` | Weekly report headline text |
| `duration` | `number` | Duration in seconds |
| `score` | `number` | Report/assessment score |
| `notificationType` | `string` | Type of notification |
| `isReturningUser` | `boolean` | Returning vs new user |
| `plan` | `string` | Subscription plan (e.g. `'1month'`) |
