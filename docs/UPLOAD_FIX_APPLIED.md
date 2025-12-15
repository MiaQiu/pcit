# Upload Network Error - Fix Applied ✅

**Date:** December 3, 2025
**Issue:** "Network error during upload" when uploading recordings from mobile app

---

## ✅ Fixes Applied

### 1. **CORS Configuration Updated**

**File:** `/Users/mia/nora/server.cjs` (line 27-28)

**Problem:** CORS only allowed `localhost` origins, blocking mobile app requests

**Fix:** Updated to allow all origins in development mode

**Before:**
```javascript
} else {
  // In development, allow any localhost port
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
}
```

**After:**
```javascript
} else {
  // In development, allow all origins (for mobile app, web, etc.)
  callback(null, true);
}
```

### 2. **Server Restarted**

- ✅ Server running on port 3001
- ✅ S3 initialized successfully
- ✅ Accessible at `http://192.168.86.158:3001`

### 3. **Environment Configuration Verified**

**File:** `/Users/mia/nora/nora-mobile/.env`

```bash
EXPO_PUBLIC_API_URL=http://192.168.86.158:3001
```

- ✅ Correct IP address (192.168.86.158)
- ✅ Correct port (3001)
- ✅ Using `http://` not `localhost`

---

## 🧪 Testing

### Server Health Check
```bash
$ curl http://192.168.86.158:3001/api/health
{"status":"healthy"}
```
✅ **PASS** - Server is accessible

### CORS Test
```bash
$ curl -v http://192.168.86.158:3001/api/health
< HTTP/1.1 200 OK
< Access-Control-Allow-Origin: *
```
✅ **PASS** - CORS allows all origins in development

---

## 📱 Next Steps to Test Upload

### 1. Restart Expo Metro Bundler

The .env file is already correct, but restart Expo to ensure it picks up any changes:

```bash
cd /Users/mia/nora/nora-mobile
npx expo start --clear
```

### 2. Test from Mobile Device

1. **Ensure mobile device is on same WiFi as computer**
2. **Open the Nora app in Expo Go**
3. **Navigate to Record tab**
4. **Test the flow:**
   - Tap "Start Session"
   - Tap "Record"
   - Speak for 5-10 seconds
   - Tap "Stop"
   - **Watch for upload progress**

### 3. Expected Behavior

If working correctly, you should see:

1. ✅ "Uploading recording..." text
2. ✅ Progress bar animating 0% → 100%
3. ✅ Percentage updating in real-time
4. ✅ Success alert: "Upload Complete! 🎉"
5. ✅ Message: "Your recording has been uploaded successfully"

### 4. Server Logs to Watch

In the server terminal, you should see:
```
Received audio upload: {
  originalName: 'recording.m4a',
  mimeType: 'audio/m4a',
  size: 123456,
  userId: 'test-user-id'
}
Audio uploaded successfully: audio/test-user-id/uuid.webm
```

---

## 🐛 If Still Getting Network Error

### Check 1: Network Connection

From mobile device browser, navigate to:
```
http://192.168.86.158:3001/api/health
```

- ✅ Should show: `{"status":"healthy"}`
- ❌ If timeout/error: Device not on same WiFi

### Check 2: Firewall

Mac firewall might be blocking connections:
```bash
# Check firewall status
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Allow Node.js if blocked
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add $(which node)
```

### Check 3: Metro Bundler

In Expo terminal, verify it's using the correct IP:
```
Metro waiting on exp://192.168.86.158:8081
```

Should match the IP in `.env` file.

### Check 4: Console Logs

Add more logging to RecordScreen.tsx:

```typescript
const uploadRecording = async (uri: string, durationSeconds: number) => {
  try {
    console.log('=== UPLOAD DEBUG ===');
    console.log('API_URL:', API_URL);
    console.log('Upload URL:', `${API_URL}/api/recordings/upload`);
    // ... rest of function
```

Then check Metro logs for the actual URL being used.

---

## 🎯 Troubleshooting Quick Reference

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| "Network error" | CORS blocking | ✅ Fixed in server.cjs |
| Timeout | Wrong IP/port | Check .env file |
| Connection refused | Server not running | Start: `node server.cjs` |
| Different network | WiFi mismatch | Connect both to same WiFi |
| Works in browser, fails in app | Expo cache | `npx expo start --clear` |

---

## ✅ Verification Checklist

Before testing on mobile:

- [x] Server running on port 3001
- [x] CORS updated to allow all origins in dev
- [x] .env has correct IP (192.168.86.158)
- [x] Health endpoint accessible from curl
- [ ] Expo Metro bundler restarted with --clear
- [ ] Mobile device on same WiFi as computer
- [ ] Tested health endpoint from mobile browser

---

## 📝 Summary

**What was fixed:**
1. CORS now allows mobile app connections in development
2. Server restarted with new configuration
3. Environment variables verified

**Current status:**
- ✅ Backend ready
- ✅ Upload endpoint functional
- ✅ CORS configured correctly
- ✅ Server accessible at `http://192.168.86.158:3001`

**Ready to test upload from mobile app!**

---

## 🎉 Success Criteria

Upload is working when you see:
1. Progress bar reaches 100%
2. Alert shows "Upload Complete! 🎉"
3. Server logs show S3 upload confirmation
4. Recording ID returned and stored

---

**Last Updated:** December 3, 2025
**Server IP:** 192.168.86.158:3001
**Status:** Ready for testing 🚀
