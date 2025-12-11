# TestFlight Build Guide for Nora Mobile

This guide explains how to build the Nora mobile app for TestFlight using Xcode with separate environment configurations.

---

## 📋 Overview

We use **separate `.env` files** to manage different environments:

- **`.env`** - Development environment (local backend at `http://[your-ip]:3001`)
- **`.env.production`** - Production environment (AWS backend at `https://p2tgddmyxt.us-east-1.awsapprunner.com`)

---

## 🏗️ Building for TestFlight with Xcode

### Option A: Using Xcode GUI (Recommended for TestFlight)

#### Step 1: Switch to Production Environment

Before opening Xcode, run this command to copy production settings:

```bash
cd nora-mobile
cp .env.production .env
```

This temporarily replaces your `.env` file with production settings.

#### Step 2: Open Xcode

```bash
cd nora-mobile/ios
open Nora.xcodeproj
```

Or simply double-click `Nora.xcodeproj` in Finder.

#### Step 3: Select Release Configuration

1. In Xcode, click on the **Nora** scheme at the top (next to the play/stop buttons)
2. Select **Edit Scheme...**
3. In the left sidebar, select **Run**
4. Change **Build Configuration** from "Debug" to **"Release"**
5. Click **Close**

#### Step 4: Select Your Device or "Any iOS Device"

1. In the top toolbar, click the device selector
2. Choose either:
   - Your connected iPhone
   - **"Any iOS Device (arm64)"** for archive builds

#### Step 5: Archive the Build

1. Go to **Product** → **Archive**
2. Wait for the build to complete (this may take several minutes)
3. The **Organizer** window will open automatically

#### Step 6: Distribute to TestFlight

1. In the Organizer, select your archive
2. Click **Distribute App**
3. Select **App Store Connect**
4. Click **Upload**
5. Follow the prompts to upload to TestFlight

---

### Option B: Using Command Line

#### For Development Testing

```bash
cd nora-mobile

# This uses your local .env file (development)
npm run ios
```

#### For Production/TestFlight Testing

```bash
cd nora-mobile

# Copy production environment
cp .env.production .env

# Build in Release mode
npm run ios:prod

# Or manually with expo
expo run:ios --configuration Release
```

---

## 🔄 Switching Back to Development

After building for TestFlight, restore your development environment:

```bash
cd nora-mobile
git checkout .env
```

This restores your local development settings with your machine's IP address.

**Or** manually edit `.env` and set:
```bash
EXPO_PUBLIC_API_URL=http://172.20.10.9:3001
```

---

## ⚙️ Environment Configuration Files

### `.env` (Development)
```bash
# Uses your local backend server
EXPO_PUBLIC_API_URL=http://172.20.10.9:3001
```

**When to use:**
- Running app with Expo Go
- Development testing
- Requires `node server.cjs` and tunnel script running locally

### `.env.production` (Production)
```bash
# Uses AWS App Runner backend
EXPO_PUBLIC_API_URL=https://p2tgddmyxt.us-east-1.awsapprunner.com
```

**When to use:**
- TestFlight builds
- App Store release builds
- No local server needed - uses deployed AWS backend

---

## 🚀 Quick Reference

### Before Starting Development
```bash
# Make sure you have the development environment
cd nora-mobile
git checkout .env

# Start local backend
cd ..
node server.cjs  # In one terminal
./scripts/start-db-tunnel.sh  # In another terminal

# Start Expo
cd nora-mobile
npm start
```

### Before Building for TestFlight
```bash
# Switch to production environment
cd nora-mobile
cp .env.production .env

# Verify the change
grep EXPO_PUBLIC_API_URL .env
# Should output: EXPO_PUBLIC_API_URL=https://p2tgddmyxt.us-east-1.awsapprunner.com

# Open Xcode and build
cd ios
open Nora.xcodeproj
```

### After TestFlight Build
```bash
# Restore development environment
cd nora-mobile
git checkout .env

# Or manually restore your local IP
# Edit .env and set EXPO_PUBLIC_API_URL=http://[your-ip]:3001
```

---

## 📱 TestFlight Checklist

Before submitting to TestFlight:

- [ ] Run `cp .env.production .env` to use production backend
- [ ] Verify production URL: `grep EXPO_PUBLIC_API_URL .env`
- [ ] Update version number in `app.json` if needed
- [ ] Open Xcode: `open nora-mobile/ios/Nora.xcodeproj`
- [ ] Select **Release** configuration in scheme settings
- [ ] Choose device: **Any iOS Device (arm64)**
- [ ] Product → Archive
- [ ] Distribute to TestFlight via Organizer
- [ ] After upload, restore dev environment: `git checkout .env`

---

## ❓ Troubleshooting

### "Cannot connect to backend" in TestFlight

**Check:** Did you forget to switch to production environment before building?

```bash
# Rebuild with production environment
cd nora-mobile
cp .env.production .env
# Then rebuild in Xcode
```

### "Environment variables not updating"

**Solution:** Clean build folder in Xcode

1. In Xcode: **Product** → **Clean Build Folder** (Cmd+Shift+K)
2. Quit Xcode
3. Run `cp .env.production .env` again
4. Reopen Xcode and rebuild

### "Backend returns 500 errors in production"

**Check:** Is the AWS backend healthy?

```bash
curl https://p2tgddmyxt.us-east-1.awsapprunner.com/api/health
# Should return: {"status":"ok","services":{"anthropic":true,"email":true}}
```

---

## 🔐 Important Notes

1. **Never commit** your local `.env` file with your machine's IP address
2. `.env.production` should be committed (it contains only the public production URL)
3. The AWS backend at `p2tgddmyxt.us-east-1.awsapprunner.com` is already configured with:
   - ✅ Production database access
   - ✅ API keys (Anthropic, ElevenLabs)
   - ✅ CORS for mobile apps
   - ✅ HTTPS/SSL certificates

4. **No local server or tunnel needed** for TestFlight builds - the app connects directly to AWS

---

## 📚 Related Documentation

- `AWS_INFRASTRUCTURE_OVERVIEW.md` - Complete AWS setup documentation
- `app.json` - Expo configuration including bundle identifiers
- `.env.production` - Production environment variables
- `.env` - Development environment variables (not committed)

---

**Last Updated:** 2025-12-10
