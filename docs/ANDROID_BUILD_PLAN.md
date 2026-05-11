# Android Build Plan

## Overview

The app currently ships iOS-only. The codebase already has significant Android awareness (`Platform.OS` checks, Android branches in most screens, `android` block in `app.json`), so the port is well-started. Below are the remaining work items in suggested completion order.

---

## 1. Firebase & Push Notifications

**Status:** Missing `google-services.json`.

- Create an Android app in the Firebase console (same project as iOS).
- Download `google-services.json` and place it in `nora-mobile/`.
- Add to `app.json`:
  ```json
  "android": {
    "googleServicesFile": "./google-services.json"
  }
  ```
- Add `@react-native-firebase/app` Android plugin to `app.json` plugins if not already auto-linked.

---

## 2. EAS Build Config

**Status:** All build profiles in `eas.json` only have `ios` overrides.

Add `android` sections to each profile:

```json
"preview": {
  "distribution": "internal",
  "android": {
    "buildType": "apk"
  },
  "ios": { "simulator": false }
},
"production": {
  "autoIncrement": true,
  "android": {
    "buildType": "app-bundle"
  },
  "ios": { "simulator": false }
}
```

Also set up Android app signing (keystore) via `eas credentials`.

---

## 3. Audio Recording (Biggest Blocker)

**Status:** `AudioSessionManager` native module is iOS-only (Swift/Obj-C). `startRecording` and `stopRecording` throw on Android.

**Recommended approach:** Implement an Android native module in Kotlin that mirrors the iOS API surface:
- `configureAudioSessionForRecording()`
- `startRecording(autoStopSeconds)`
- `stopRecording()` → `{ uri, durationMillis }`
- `getRecordingStatus()`
- `deactivateAudioSession()`
- `getPendingRecording()`
- `endBackgroundTask()`
- Event: `onRecordingAutoStopped`

Place Kotlin source under `modules/audio-session-manager/android/` and update `withAudioSessionManager.js` (or create a parallel `withAudioSessionManager.android.js`) to copy and wire it into the Android build.

**Alternative:** Replace the native module with `expo-av` for cross-platform recording. Simpler, but less control over audio session interruption handling.

---

## 4. Google Sign-In

**Status:** `androidClientId` already referenced in `socialAuth.ts` but no real value set.

- Create an Android OAuth 2.0 client ID in Google Cloud Console (SHA-1 fingerprint of the release keystore required).
- Add to `.env`: `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<id>`
- The PKCE token-exchange flow in `socialAuth.ts` uses `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` for the exchange — update it to use the platform-appropriate client ID.

---

## 5. Apple Sign-In

**Status:** `signInWithApple` is already gated behind `Platform.OS !== 'ios'` returning `false`. The button in `LoginScreen.tsx` is already hidden.

No action required. Apple Sign-In is not available on Android; Google is the primary social auth alternative.

---

## 6. RevenueCat / In-App Purchases

**Status:** `revenuecat.ts` has a placeholder `android` key slot.

- Create the Android app in RevenueCat dashboard.
- Create matching products in Google Play Console:
  - `com.nora.premium.1m`
  - `com.nora.premium.3m`
  - `com.nora.premium.1y`
- Add the RevenueCat Android API key: `apiKey.android: 'goog_xxx'`
- Verify `Purchases.configure()` call passes the correct key for the platform.

---

## 7. UI Polish

### Language Picker (`ProfileScreen.tsx`)
`ActionSheetIOS` is used for language selection; the Android `else` branch is empty. Replace with a cross-platform modal or `@react-native-picker/picker` (already a dependency).

### Date Picker (`HomeScreen_v2.tsx`, `NotificationSettingsScreen.tsx`)
Android branches are already written. Verify behavior on a real device — the `display="default"` spinner may need adjustment.

### Keyboard Avoiding View
All screens already use `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`. Test on Android to confirm layout is correct.

---

## 8. Play Store Setup

- Register the app on Google Play Console (`com.chromamind.nora`).
- Set `versionCode` — EAS `autoIncrement: true` handles this automatically for EAS builds.
- Prepare store listing: screenshots, description, privacy policy URL.
- Set up internal test track before rolling out to production.

---

## Suggested Order

| Step | Item | Effort |
|------|------|--------|
| 1 | Firebase + `google-services.json` | Low |
| 2 | EAS `eas.json` android config + keystore | Low |
| 3 | Audio recording Android native module | High |
| 4 | Google Sign-In `androidClientId` | Low |
| 5 | RevenueCat Android key + Play products | Medium |
| 6 | UI polish (language picker, verify pickers) | Low |
| 7 | Play Store setup + first internal build | Medium |
