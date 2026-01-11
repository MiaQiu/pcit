# EAS Build Guide

Complete guide for building the Nora mobile app using Expo Application Services (EAS).

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Build Profiles](#build-profiles)
- [Development Builds](#development-builds)
- [Production Builds](#production-builds)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## Overview

EAS Build is used because Xcode's Product → Archive has module map file errors with our configuration (`use_modular_headers!` + Expo new architecture + static libraries). EAS Build provides a controlled environment that properly generates all necessary files.

## Prerequisites

1. **EAS CLI installed:**
   ```bash
   npm install -g eas-cli
   ```

2. **Logged in to Expo:**
   ```bash
   eas login
   ```

3. **Working directory:**
   ```bash
   cd /Users/mia/nora/nora-mobile
   ```

## Build Profiles

Build profiles are configured in `eas.json`:

### Development Profile
- **Purpose:** Fast iteration during development
- **Distribution:** Internal
- **Simulator:** Yes
- **Auto-increment:** No

### Preview Profile
- **Purpose:** Internal testing with release configuration
- **Distribution:** Internal
- **Simulator:** No
- **Auto-increment:** No

### Production Profile
- **Purpose:** App Store releases
- **Distribution:** Store
- **Simulator:** No
- **Auto-increment:** Yes (build number)

## Development Builds

Development builds enable fast iteration without rebuilding. Build once, then use your normal dev workflow.

### When to Use Development Builds

Use development builds when you:
- Need to test on a physical device
- Want fast refresh and instant reloads
- Can't use Xcode's Product → Run due to module map errors
- Are working on UI or business logic (not native code)

### Creating a Development Build

```bash
cd /Users/mia/nora/nora-mobile
eas build --platform ios --profile development
```

Wait for build to complete (typically 10-15 minutes).

### Installing the Development Build

**For Simulator:**
```bash
eas build:run -p ios --latest
```

**For Physical Device:**

Option 1 - Via Xcode Devices:
1. Download IPA from build URL in terminal
2. Connect iPhone via USB
3. Xcode → Window → Devices and Simulators
4. Drag IPA file onto your device

Option 2 - Via TestFlight:
```bash
eas submit --platform ios --latest
```
Then install via TestFlight app on your device.

### Using the Development Build

After installing, use your normal development workflow:

```bash
# Terminal 1: Database tunnel
./scripts/start-db-tunnel.sh

# Terminal 2: Backend server
npm run server

# Terminal 3: Metro bundler
cd nora-mobile
npm run dev:mobile
```

The development build connects to Metro bundler. Changes to JS/TS code reload instantly - no rebuild needed!

### Environment Variables with Development Builds

**Important:** Development builds read `.env` at **runtime** when Metro bundles, NOT at build time.

Update `.env` before running `npm run dev:mobile`:

For simulator:
```bash
EXPO_PUBLIC_API_URL=http://localhost:3001
```

For physical device on same WiFi:
```bash
EXPO_PUBLIC_API_URL=http://192.168.86.172:3001  # Your Mac's IP
```

For physical device anywhere:
```bash
EXPO_PUBLIC_API_URL=https://your-ngrok-url.ngrok-free.dev
```

To change API URL, just update `.env` and reload the app - no rebuild needed!

### When to Rebuild Development Build

Only rebuild when you:
- Add new native dependencies (packages with native code)
- Change native configuration (Info.plist, Podfile, app.json native settings)
- Update Expo SDK version
- Change custom native modules

For normal JS/TS/UI changes, never rebuild - just save and reload!

## Production Builds

Production builds are for App Store releases and TestFlight distribution to external testers.

### Before Building for Production

1. **Verify environment variables:**

   Check `.env.production`:
   ```bash
   cat /Users/mia/nora/nora-mobile/.env.production
   ```

   Should contain:
   ```bash
   EXPO_PUBLIC_API_URL=https://p2tgddmyxt.us-east-1.awsapprunner.com
   ```

2. **Current configuration:**
   - Version: `1.0.0` (app.json)
   - Build Number: `20` (app.json, auto-increments to 21, 22, etc.)
   - Bundle ID: `com.chromamind.nora`

### Creating a Production Build

```bash
cd /Users/mia/nora/nora-mobile
eas build --platform ios --profile production
```

The build will:
1. Upload project files from git repository
2. Run `postinstall` script to build `@nora/core` package
3. Generate native iOS project
4. Build Release configuration
5. Auto-increment build number (21 → 22 → 23...)
6. Create signed IPA file

Wait for build to complete (typically 15-20 minutes).

### Submitting to App Store

After production build completes:

```bash
eas submit --platform ios --latest
```

This uploads the IPA to App Store Connect. Then:
1. Go to https://appstoreconnect.apple.com
2. Navigate to your app
3. Create new version or update existing TestFlight build
4. Fill in release notes
5. Submit for review

### Build Number Management

Build numbers are **auto-incremented** for production builds:
- First build: 21
- Second build: 22
- Third build: 23
- etc.

**You don't need to manually update build numbers!** EAS handles this automatically.

To change the version number (e.g., 1.0.0 → 1.0.1):

Edit `app.json`:
```json
{
  "expo": {
    "version": "1.0.1"
  }
}
```

Commit and push:
```bash
git add app.json
git commit -m "chore: Bump version to 1.0.1"
git push
```

Then build normally - the build number will reset to 1 for the new version.

## Environment Variables

### Overview

Environment variables are handled differently for development vs production builds:

| Build Type | When .env is Read | Can Change Without Rebuild? |
|------------|-------------------|------------------------------|
| Development | Runtime (Metro bundler) | ✅ Yes |
| Production | Build time (EAS Build) | ❌ No |

### Production Environment Variables

Production builds use `.env.production`.

The production build script automatically copies this file:
```bash
# This happens automatically during EAS build
cp .env.production .env && expo prebuild --clean
```

Environment variables are baked into the production build and cannot be changed without rebuilding.

### Available Environment Variables

```bash
# Backend API
EXPO_PUBLIC_API_URL

# Web URL
EXPO_PUBLIC_WEB_URL

# Google OAuth
EXPO_PUBLIC_GOOGLE_CLIENT_ID
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID

# Facebook OAuth
EXPO_PUBLIC_FACEBOOK_APP_ID

# Expo Project
EXPO_PUBLIC_PROJECT_ID
```

## Troubleshooting

### "package.json does not exist" Error

**Cause:** `.gitignore` blocking JSON files from upload.

**Fix:** Verify root `.gitignore` has these exceptions:
```
!package.json
!tsconfig.json
!app.json
!eas.json
```

### "@nora/core dist/index.js not found" Error

**Cause:** Monorepo package not built before mobile app bundling.

**Fix:** Verify `postinstall` script in `nora-mobile/package.json`:
```json
{
  "scripts": {
    "postinstall": "cd ../packages/nora-core && npm install && npm run build"
  }
}
```

### "You've already submitted this build" Error

**Cause:** Build number hasn't incremented.

**Fix:** This should not happen with auto-increment enabled. If it does:
1. Check `eas.json` has `"autoIncrement": true` in production profile
2. Manually increment `buildNumber` in `app.json` if needed

### Module Map Files Not Found in Xcode

**Cause:** `use_modular_headers!` incompatibility with static libraries + new architecture.

**Fix:** Use EAS Build instead of Xcode for all builds. For development iteration, use development builds with Metro bundler.

### Build Takes Too Long

**Normal times:**
- Development build: 10-15 minutes
- Production build: 15-20 minutes

If much longer:
1. Check build logs for errors
2. Verify network connectivity
3. Check EAS Build status page

### Development Build Not Connecting to Metro

**Symptoms:** White screen, "Could not connect to development server"

**Fixes:**
1. Ensure Metro is running: `npm run dev:mobile`
2. Both device and computer on same network
3. Firewall allowing connections on port 8081
4. Try shaking device → "Reload" or "Configure Bundle Location"

## Quick Reference

### Development Workflow

```bash
# 1. Create development build (once)
cd /Users/mia/nora/nora-mobile
eas build --platform ios --profile development

# 2. Install on device/simulator (once)
eas build:run -p ios --latest

# 3. Normal development (every day)
# Terminal 1
./scripts/start-db-tunnel.sh

# Terminal 2
npm run server

# Terminal 3
cd nora-mobile && npm run dev:mobile
```

### Production Release

```bash
# 1. Build for production
cd /Users/mia/nora/nora-mobile
eas build --platform ios --profile production

# 2. Submit to App Store Connect
eas submit --platform ios --latest

# 3. Go to App Store Connect
# https://appstoreconnect.apple.com
```

### Check Build Status

```bash
# List recent builds
eas build:list --platform ios --limit 5

# View specific build
eas build:view <build-id>
```

## Related Documentation

- [BUILD_QUICK_REFERENCE.md](./BUILD_QUICK_REFERENCE.md) - Quick reference for common build tasks
- [TESTFLIGHT_BUILD_GUIDE.md](./TESTFLIGHT_BUILD_GUIDE.md) - TestFlight-specific instructions
- [TESTFLIGHT_BUILD_CHECKLIST.md](./TESTFLIGHT_BUILD_CHECKLIST.md) - Pre-flight checklist

## Key Files Reference

| File | Purpose |
|------|---------|
| `eas.json` | EAS build configuration and profiles |
| `app.json` | Expo app configuration, version, build number |
| `.env` | Development environment variables |
| `.env.production` | Production environment variables |
| `nora-mobile/package.json` | Dependencies and postinstall script |
| `ios/Podfile` | CocoaPods dependencies configuration |
| `ios/Nora/Info.plist` | iOS app configuration (generated) |

## Important Notes

1. **Never edit Info.plist directly** - it's regenerated by `expo prebuild`. Make changes in `app.json` instead.

2. **Xcode Product → Archive doesn't work** - always use EAS Build for production releases.

3. **Development builds are reusable** - build once, use for weeks/months until you need to update native dependencies.

4. **Auto-increment is enabled** - don't manually update build numbers for production builds.

5. **Git must be clean** - EAS Build uploads from your git repository, so commit and push changes before building.
