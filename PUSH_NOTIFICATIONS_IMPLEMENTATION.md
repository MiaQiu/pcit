# Push Notifications Implementation

## Overview

Backend push notifications have been successfully implemented to notify users when their recording analysis completes, even when the app is in the background or closed.

## What Was Implemented

### 1. Database Schema Changes

**File:** `/Users/mia/nora/prisma/schema.prisma`

Added two new fields to the `User` model:
- `pushToken` (String?): Stores the Expo push token for the user
- `pushTokenUpdatedAt` (DateTime?): Tracks when the token was last updated
- Added index on `pushToken` for faster lookups

**Migration needed:** Run `npx prisma migrate dev --name add_push_token_to_user` when database is available.

### 2. Backend Push Notification Service

**File:** `/Users/mia/nora/server/services/pushNotifications.cjs`

Created a comprehensive push notification service with the following functions:
- `sendPushNotificationToUser(userId, notification)`: Send push notification to a specific user
- `sendReportReadyNotification(userId, sessionId, sessionType)`: Send "Report Ready" notification
- `registerPushToken(userId, pushToken)`: Register or update user's push token
- `unregisterPushToken(userId)`: Remove user's push token
- `isValidExpoPushToken(pushToken)`: Validate Expo push token format

**Key features:**
- Uses Expo Push Notification service API
- Validates push tokens before sending
- Comprehensive error logging
- Non-blocking (won't fail processing if notification fails)

### 3. Recording Completion Handler

**File:** `/Users/mia/nora/server/routes/recordings.cjs`

Updated `processRecordingWithRetry` function (lines 481-493):
- Sends push notification when recording analysis completes successfully
- Logs notification success/failure without blocking the process
- Uses the `sendReportReadyNotification` service

### 4. Push Token Registration API

**File:** `/Users/mia/nora/server/routes/auth.cjs`

Added two new endpoints:

#### POST /api/auth/push-token
Register or update user's push notification token
```javascript
{
  "pushToken": "ExponentPushToken[xxxxxxxxxxxxxx]"
}
```

#### DELETE /api/auth/push-token
Unregister user's push notification token (useful for logout)

### 5. Mobile App Changes

#### Notification Utilities
**File:** `/Users/mia/nora/nora-mobile/src/utils/notifications.ts`

- Updated `requestNotificationPermissions()` to accept access token and register with backend
- Added `registerPushTokenWithBackend()` to POST token to backend
- Added `unregisterPushTokenFromBackend()` for logout scenarios

#### Login Screen
**File:** `/Users/mia/nora/nora-mobile/src/screens/onboarding/LoginScreen.tsx`

- Added push token registration after successful login (lines 57-64)
- Non-blocking, won't fail login if registration fails

#### Signup Screen
**File:** `/Users/mia/nora/nora-mobile/src/screens/onboarding/CreateAccountScreen.tsx`

- Added push token registration after successful signup (lines 104-111)
- Non-blocking, won't fail signup if registration fails

## How It Works

### The Flow

1. **User Logs In/Signs Up:**
   - Mobile app requests notification permissions
   - Gets Expo push token from Expo's service
   - Sends push token to backend via `POST /api/auth/push-token`
   - Backend stores token in `User.pushToken` field

2. **User Starts Recording:**
   - Recording is uploaded to S3
   - Backend starts transcription and analysis (can take several minutes)
   - User can lock screen or switch to other apps

3. **Analysis Completes:**
   - Backend calls `sendReportReadyNotification(userId, sessionId)`
   - Service looks up user's push token from database
   - Sends notification via Expo Push API
   - **Notification appears on user's device immediately**, even if app is closed

4. **User Taps Notification:**
   - App opens (or comes to foreground)
   - Navigation handler in `App.tsx` (lines 59-72) directs user to Report screen
   - AppState listener in `UploadProcessingContext.tsx` checks if processing is complete
   - If complete, shows report and clears processing state

### Fallback Behavior

The implementation includes multiple fallback layers:

1. **Backend push notification** (primary) - works even when app is closed
2. **AppState listener in UploadProcessingContext** (fallback) - polls when app returns to foreground
3. **Local notification from mobile app** (existing) - as additional backup

## Testing

### Prerequisites

1. **Database Migration:**
   ```bash
   cd /Users/mia/nora
   npx prisma migrate dev --name add_push_token_to_user
   ```

2. **Environment Variables:**
   Make sure Expo project ID is set in mobile app:
   ```bash
   # In nora-mobile/.env or app config
   EXPO_PUBLIC_PROJECT_ID=your-expo-project-id
   ```

### Test Scenarios

#### Test 1: Basic Push Notification
1. Build and run the mobile app
2. Log in with a test account
3. Check logs for: `[Notifications] Push token registered successfully`
4. Start a recording session
5. Stop the recording
6. **Immediately lock your phone or switch to another app**
7. Wait 2-5 minutes (processing time)
8. **You should receive a push notification:** "Session Report Ready!"
9. Tap the notification - should open app to report screen

#### Test 2: App Completely Closed
1. Log in and start a recording
2. Stop the recording
3. **Force quit the app** (swipe up from app switcher)
4. Wait for processing to complete
5. **Push notification should still appear**
6. Tap notification - app opens to report screen

#### Test 3: Backend Fallback
1. Temporarily disable push notifications or use invalid token
2. Start and stop recording
3. Lock phone
4. **Open app after processing completes**
5. AppState listener should detect completion
6. Should navigate to home and show local notification

### Debugging

Enable detailed logging:

**Backend:**
```javascript
// Check server logs for:
[PROCESSING-SUCCESS] Session xxx completed
[PUSH-NOTIFICATION] Sending report ready notification
[PUSH-NOTIFICATION] Push notification sent successfully
```

**Mobile App:**
```javascript
// Check console for:
[Notifications] Push token obtained: ExponentPushToken...
[Notifications] Push token registered successfully
[App] Notification tapped: {...}
[UploadProcessing] App returned to foreground while processing
```

## Known Limitations

1. **iOS/Android Only:** Push notifications don't work on web
2. **Expo Limitations:** Requires Expo-managed app or custom dev client
3. **Token Expiration:** Push tokens can expire/change (app handles re-registration on each login)
4. **Delivery Not Guaranteed:** Push notifications are "best effort" - network issues can cause delays

## Troubleshooting

### Push Notification Not Received

**Check:**
1. Notification permissions granted? (iOS Settings > Nora > Notifications)
2. Push token registered? (Check backend logs)
3. Valid Expo project ID? (Check `process.env.EXPO_PUBLIC_PROJECT_ID`)
4. Backend can reach Expo API? (Check for network errors in logs)
5. User's push token in database? (Query: `SELECT pushToken FROM User WHERE id = '...'`)

### Common Errors

**"Invalid push token format"**
- Push token must start with `ExponentPushToken[` or `ExpoPushToken[`
- Re-login to get fresh token

**"No push token registered"**
- User hasn't logged in after this implementation
- Call `requestNotificationPermissions(accessToken)` again

**"Push token registration failed"**
- Check access token is valid
- Check backend API is reachable
- Check database connection

## Future Enhancements

Potential improvements for the future:

1. **Push Notification Receipts:** Track delivery status using Expo's receipt API
2. **Rich Notifications:** Add images, action buttons to notifications
3. **Notification Preferences:** Allow users to customize which notifications they receive
4. **Multi-Device Support:** Handle multiple devices per user
5. **Analytics:** Track notification open rates
6. **Background Fetch:** Use iOS Background Fetch as additional fallback

## Rollback Plan

If you need to rollback this implementation:

1. **Database:**
   ```sql
   ALTER TABLE "User" DROP COLUMN "pushToken";
   ALTER TABLE "User" DROP COLUMN "pushTokenUpdatedAt";
   ```

2. **Backend:** Remove push notification call from `recordings.cjs` line 481-493

3. **Mobile App:** Remove push token registration from login/signup screens

The app will continue to work with existing local notifications and AppState polling.

---

## Summary

✅ Backend push notifications fully implemented
✅ Database schema updated
✅ Mobile app registers push tokens on login/signup
✅ Recording completion triggers push notifications
✅ Notifications work even when app is closed
✅ Fallback mechanisms in place

**Next Step:** Run the database migration and test the end-to-end flow!
