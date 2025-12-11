# TestFlight White Screen Debugging Guide

## Changes Made

I've added the following debugging improvements to help identify the white screen issue:

### 1. Error Boundary Component
- Created `src/components/ErrorBoundary.tsx`
- Catches React errors and displays a user-friendly error screen
- Shows error details in development mode

### 2. Enhanced App.tsx
- Added error boundary wrapper around the entire app
- Added font loading error handling
- Better error display for initialization failures

### 3. Enhanced RootNavigator
- Added 10-second timeout failsafe to prevent infinite loading
- Added comprehensive console logging throughout auth check process
- Better error logging with stack traces

### 4. Enhanced AppContext
- Added try-catch with detailed error logging
- Logs each service initialization step
- Logs API_URL to verify configuration

## How to Debug

### Step 1: Rebuild the App
```bash
# In Xcode, rebuild the app for TestFlight
# Make sure to use a new build number
```

### Step 2: Check Xcode Console Logs

After launching the app in TestFlight, connect your device to Xcode and check the console:

1. Open Xcode
2. Go to Window > Devices and Simulators
3. Select your device
4. Click "Open Console"
5. Launch the app on your device
6. Look for these log messages:

```
Initializing AppContext services...
API_URL: <should show production URL>
SecureStoreAdapter created
AuthService created
LessonService created
RecordingService created
SocialAuthService created
All services initialized successfully
Starting auth check...
Auth service initialized
Authentication status: true/false
```

### Step 3: Common Issues and Solutions

#### Issue 1: API_URL is undefined or incorrect
**Symptoms**: Log shows `API_URL: undefined` or `API_URL: http://localhost:3001`

**Solution**: The .env.production file might not be loaded correctly.
- Verify `.env.production` exists in `nora-mobile/` folder
- Check that it contains: `EXPO_PUBLIC_API_URL=https://p2tgddmyxt.us-east-1.awsapprunner.com`
- Rebuild the app (environment variables are baked in at build time)

#### Issue 2: SecureStore access errors
**Symptoms**: Error after "SecureStoreAdapter created"

**Solution**:
- Check that the app has proper entitlements
- Verify keychain access is configured in Xcode

#### Issue 3: Service initialization fails
**Symptoms**: Error messages like "CRITICAL: Error initializing services"

**Solution**:
- Check the error message and stack trace in console
- Verify @nora/core package is properly built and included

#### Issue 4: Auth check timeout (10 seconds)
**Symptoms**: Log shows "Auth check timeout - forcing app to load"

**Solution**:
- The app couldn't complete auth check in 10 seconds
- Check if the device has internet connectivity
- Verify backend API is accessible from the device
- Test backend URL manually: `curl https://p2tgddmyxt.us-east-1.awsapprunner.com/api/health`

#### Issue 5: Network request fails
**Symptoms**: Error during "Checking onboarding completion"

**Solution**:
- Check if backend API is running and accessible
- Verify the device has internet access
- Check if there are any CORS or SSL issues
- Test the health endpoint from the device browser

### Step 4: Test Backend Connectivity

From your TestFlight device's Safari browser, visit:
```
https://p2tgddmyxt.us-east-1.awsapprunner.com/api/health
```

You should see a JSON response like:
```json
{
  "status": "ok",
  "timestamp": "..."
}
```

If this fails, the backend might be down or unreachable.

### Step 5: Check Backend Logs

If the app initializes but fails during API calls, check backend logs:
```bash
# View App Runner logs in AWS Console
# Or check local server logs if running locally
```

## Quick Checklist

- [ ] `.env.production` file exists with correct `EXPO_PUBLIC_API_URL`
- [ ] Backend API is running and accessible
- [ ] Device has internet connectivity
- [ ] App has proper entitlements in Xcode
- [ ] Console shows "All services initialized successfully"
- [ ] Console shows "Auth check complete"
- [ ] No red errors in console logs

## Getting Console Logs from TestFlight

### For iOS Devices:
1. Connect device to Mac
2. Open Console.app (in /Applications/Utilities/)
3. Select your device from the left sidebar
4. Filter by "Nora" or your bundle ID "com.chromamind.nora"
5. Launch the app
6. Save logs for analysis

### Alternative Method:
1. Install a logging tool like "Sentry" or "Bugsnag" in the app
2. Send crash reports and logs to a remote service
3. View logs from dashboard

## Next Steps

After reviewing the console logs:
1. Identify the exact error or where the app gets stuck
2. Check which log message is the last one before the white screen
3. Fix the specific issue (network, configuration, code error)
4. Rebuild and test again

## Contact for Help

If you see specific error messages, share them for further debugging. Include:
- The complete console log output
- The last log message before the app stuck
- Any error messages or stack traces
- Device model and iOS version
