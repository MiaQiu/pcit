# Android Build & Distribution

## Overview

The Android app shares the same React Native / Expo codebase as iOS. Native modules and distribution are handled separately.

---

## Environment

Add to `~/.zshrc`:

```zsh
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
```

---

## Building

### Dev build (emulator / connected device)

```bash
npx expo run:android
```

Installs directly via ADB. Connects to local Metro bundler. Do not use for Play Store uploads.

### Release AAB (Play Store)

**Step 1 — Run prebuild** (only needed after native config changes):

```bash
npx expo prebuild --platform android
```

> ⚠️ `expo prebuild` resets `versionCode` to whatever is in `app.json`. Always bump `versionCode` **after** prebuild, not before.

**Step 2 — Bump versionCode** in `android/app/build.gradle`:

```gradle
versionCode 11   // must be higher than the last Play Store upload
versionName "1.0.6"
```

**Step 3 — Build**:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
cd /Users/yihui/Project/pcit/nora-mobile/android && ./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

---

## Signing

The production keystore is stored at `~/.android/nora-release.jks` (not committed to git). It is already configured in `android/app/build.gradle` under `signingConfigs.release`.

| Field | Value |
|---|---|
| Keystore path | `~/.android/nora-release.jks` |
| Key alias | `825fa7adeb5134602c6edbe0211bc79d` |
| Store password | stored in keystore file (managed locally) |
| SHA1 fingerprint | `FE:16:FB:3B:B7:38:64:25:96:05:8E:9F:D0:52:26:9D:AA:EF:88:15` |

If the keystore is lost, download it again from EAS:
```bash
eas credentials --platform android
# Select: production → Keystore → Download
# Move to: ~/.android/nora-release.jks
```

---

## Play Store Distribution

### Tracks

| Track | Purpose |
|---|---|
| Internal testing | Team testing, no review required, up to 100 testers |
| Production | Public release, requires Google review (1–3 days for new apps) |

### Uploading a new release

1. Play Console → **Nora** → **Internal testing** → **Create new release**
2. Upload the `.aab` file
3. Set release name to the version name (e.g. `1.0.6`)
4. **Review release** → **Start rollout**

Internal testing releases are available to testers within ~15 minutes.

### Adding testers

Play Console → Internal testing → **Testers** tab → **Create email list** → add Gmail addresses → testers use the opt-in link to install.

> Tester's Gmail must match the Google account on their Android device.

### License testers (free purchases)

Play Console → **Users and permissions** → add tester Gmail → they can complete the full purchase flow without being charged.

Accelerated billing for license testers:
| Real period | Test duration |
|---|---|
| 1-month free trial | 3 minutes |
| 1-month subscription | 5 minutes |

---

## Native Module: AudioSessionManager

The Android implementation lives in two places:

- `modules/audio-session-manager/android/` — source of truth
- `android/app/src/main/java/com/chromamind/nora/audiosessionmanager/` — copy registered in MainApplication.kt

The module uses `MediaRecorder` for audio recording to `.m4a` files and `SharedPreferences` to persist pending recordings across app lifecycle. It is registered manually in `MainApplication.kt` (not autolinked) because it lives outside `node_modules`.

If `expo prebuild` is run, verify `MainApplication.kt` still has:
```kotlin
import com.chromamind.nora.audiosessionmanager.AudioSessionManagerPackage
// ...
add(AudioSessionManagerPackage())
```

---

## Push Notifications (FCM)

FCM V1 credentials are uploaded to Expo (expo.dev → nora-mobile → Credentials → Android → Push Notifications FCM V1).

The Firebase service account key was generated from `nora-de9cf` GCP project (`firebase-adminsdk-fbsvc@nora-de9cf.iam.gserviceaccount.com`). The key file is not stored locally — it was uploaded to Expo and deleted.

To regenerate if needed:
```bash
gcloud iam service-accounts keys create ./firebase-adminsdk.json \
  --iam-account=firebase-adminsdk-fbsvc@nora-de9cf.iam.gserviceaccount.com \
  --project=nora-de9cf
# Upload to expo.dev, then delete the file
rm ./firebase-adminsdk.json
```

---

## RevenueCat (Google Play)

| Field | Value |
|---|---|
| Android API key | `goog_DKOHGTQTyMoZWiriILmLnJOfimp` |
| Product ID | `om.nora.premium.1m` |
| Base plan ID | `monthly` |
| Free trial | 1 month |

The Android API key is initialized in `App.tsx` alongside the iOS key. Product matching uses `availablePackages[0]` since only one product is offered.

The Play Store service account (`play-developer-api@nora-de9cf.iam.gserviceaccount.com`) is uploaded to RevenueCat for purchase validation. To regenerate:
```bash
gcloud iam service-accounts keys create ./play-developer-api.json \
  --iam-account=play-developer-api@nora-de9cf.iam.gserviceaccount.com \
  --project=nora-de9cf
# Upload to RevenueCat → Nora (Play Store) → Service Account Credentials JSON
# Then delete the file
rm ./play-developer-api.json
```

---

## App Icon

The adaptive icon foreground is `assets/adaptive-icon-foreground.png` — the purple dino scaled to 66% of the frame (675 px) centered on a 1024×1024 transparent canvas. This provides the required safe-zone padding so Android doesn't clip the icon when it crops to circle/squircle shapes. Generated from `assets/icon.png` via `scripts/gen-adaptive-icon.py`.

Configured in `app.json`:

```json
"android": {
  "adaptiveIcon": {
    "foregroundImage": "./assets/adaptive-icon-foreground.png",
    "backgroundColor": "#ffffff"
  }
}
```

If the icon appears enlarged after updating, ensure you're using `adaptive-icon-foreground.png` (with padding), not `icon.png` (which fills the full frame).

---

## GCP Org Policy Note

The `chromamind.ai` org has `iam.disableServiceAccountKeyCreation` enforced. To create service account keys for the `nora-de9cf` project, the policy was disabled at the project level:

```bash
gcloud resource-manager org-policies disable-enforce \
  iam.disableServiceAccountKeyCreation --project=nora-de9cf
```

This only affects `nora-de9cf`, not other org projects.
