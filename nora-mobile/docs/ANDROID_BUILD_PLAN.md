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

**Notification channels:** `notifications.ts` has no `createChannel` calls — currently relies on Expo defaults. Android 8+ requires at least one explicit channel for reliable delivery. Add channel creation on app startup (e.g., a `default` channel with HIGH importance and sound enabled).

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

**Status:** `AudioSessionManager` native module is iOS-only. `expo-module.config.json` declares `"platforms": ["ios"]`. All recording functions throw on Android.

**Recommended approach:** Implement an Android native module in Kotlin that mirrors the iOS API surface:
- `configureAudioSessionForRecording()`
- `startRecording(autoStopSeconds)`
- `stopRecording()` → `{ uri, durationMillis }`
- `getRecordingStatus()`
- `deactivateAudioSession()`
- `getPendingRecording()`
- `endBackgroundTask()`
- Event: `onRecordingAutoStopped`

Steps:
1. Add Kotlin source under `modules/audio-session-manager/android/`.
2. Update `expo-module.config.json` to add `"android"` to `platforms`.
3. Create a parallel `withAudioSessionManager.android.js` plugin (or extend the existing one) to wire the Kotlin module into the Gradle build.

**Background audio on Android:** iOS uses `UIBackgroundModes: audio` in `infoPlist`. Android needs a foreground service to continue recording when the app is backgrounded. Declare `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MICROPHONE` permissions in `app.json` → `android.permissions`, and bind a `ForegroundService` to the recording session.

**Alternative:** Replace the native module with `expo-av` for cross-platform recording. Simpler, but loses control over audio session interruption handling and background behavior.

---

## 4. Android Manifest Permissions

**Status:** `android/app/src/main/AndroidManifest.xml` is missing several permissions the app needs.

Missing declarations:
- `android.permission.RECORD_AUDIO` — required for microphone access (critical for recording)
- `android.permission.FOREGROUND_SERVICE` — required for background recording service
- `android.permission.FOREGROUND_SERVICE_MICROPHONE` — Android 14+ targeted foreground service type
- `android.permission.POST_NOTIFICATIONS` — Android 13+ runtime permission for push notifications

Add these to `app.json` under `android.permissions` so EAS/Expo manages the manifest, or add directly to `AndroidManifest.xml`.

---

## 5. Google Sign-In

**Status:** `androidClientId` already referenced in `socialAuth.ts` but no real value set.

- Create an Android OAuth 2.0 client ID in Google Cloud Console (SHA-1 fingerprint of the release keystore required).
- Add to `.env`: `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<id>`
- The PKCE token-exchange flow in `socialAuth.ts` hardcodes `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` for the token exchange — update it to use the platform-appropriate client ID on Android.

---

## 6. RevenueCat / In-App Purchases

**Status:** `revenuecat.ts` has a placeholder `android` key slot. `App.tsx:205` only initializes RevenueCat when `Platform.OS === 'ios'` — subscriptions are completely broken on Android.

- Create the Android app in RevenueCat dashboard.
- Create matching products in Google Play Console:
  - `com.nora.premium.1m`
  - `com.nora.premium.3m`
  - `com.nora.premium.1y`
- Add the RevenueCat Android API key to `revenuecat.ts`: `apiKey.android: 'goog_xxx'`
- Update `App.tsx` `initRevenueCat()` to remove the `if (Platform.OS === 'ios')` guard and pass the platform-appropriate key:
  ```ts
  await Purchases.configure({
    apiKey: Platform.OS === 'ios'
      ? REVENUECAT_CONFIG.apiKey.ios
      : REVENUECAT_CONFIG.apiKey.android,
  });
  ```

---

## 7. Environment Variables — Android Store URLs

**Status:** `EXPO_PUBLIC_ANDROID_STORE_URL` is not set in `.env` or `.env.production`. Two screens fall back to an empty string on Android:

- `src/screens/ForceUpdateScreen.tsx:6` — force-update deep link to store
- `src/components/WhatsNewModal.tsx:15` — "rate us" / update prompt

Add to `.env` and `.env.production`:
```
EXPO_PUBLIC_ANDROID_STORE_URL=https://play.google.com/store/apps/details?id=com.chromamind.nora
```

---

## 8. UI Polish

### Language Picker (`ProfileScreen.tsx`)
`ActionSheetIOS` (line 17) is used for language selection; the Android `else` branch is empty — the picker does nothing on Android. Replace with a cross-platform modal or `@react-native-picker/picker` (already a dependency).

### Date Picker (`HomeScreen_v2.tsx`, `NotificationSettingsScreen.tsx`)
Android branches are already written. Verify behavior on a real device — the `display="default"` spinner may need adjustment across Android versions.

### Keyboard Avoiding View
All screens already use `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`. Test on Android to confirm layout is correct.

---

## 9. Dead Dependency — `react-native-nitro-sound`

**Status:** Listed in `package.json` but never imported or used anywhere in the codebase.

Remove it to keep the Android build clean:
```
npm uninstall react-native-nitro-sound
```

---

## 10. Play Store Setup

- Register the app on Google Play Console (`com.chromamind.nora`).
- Set `versionCode` — EAS `autoIncrement: true` handles this automatically for EAS builds.
- Prepare store listing: screenshots, description, privacy policy URL.
- Set up internal test track before rolling out to production.

---

## Suggested Order

| Step | Item | Effort |
|------|------|--------|
| 1 | Firebase + `google-services.json` + notification channels | Low |
| 2 | EAS `eas.json` android config + keystore | Low |
| 3 | Android manifest permissions | Low |
| 4 | `EXPO_PUBLIC_ANDROID_STORE_URL` env var | Low |
| 5 | Remove `react-native-nitro-sound` dead dep | Low |
| 6 | Google Sign-In `androidClientId` | Low |
| 7 | RevenueCat Android key + `App.tsx` init fix | Medium |
| 8 | Audio recording Android native module + background service | High |
| 9 | UI polish (language picker, verify date pickers) | Low |
| 10 | Play Store setup + first internal build | Medium |
