# Upload Troubleshooting Guide

## Error: "Network error during upload"

This error typically occurs when the mobile app cannot reach the backend server. Here are the solutions:

---

## Solution 1: Fix API URL for Mobile (MOST COMMON)

### Problem
`localhost` doesn't work from a mobile device - it refers to the device itself, not your computer.

### Fix: Use Your Computer's IP Address

#### Step 1: Find Your Computer's IP Address

**On Mac:**
```bash
ipconfig getifaddr en0
# Or if on WiFi:
ipconfig getifaddr en1
```

**On Windows:**
```bash
ipconfig
# Look for "IPv4 Address" under your active network adapter
```

Example output: `192.168.1.100`

#### Step 2: Update Environment Variable

Edit `/Users/mia/nora/nora-mobile/.env`:

```bash
# Before (doesn't work from mobile):
EXPO_PUBLIC_API_URL=http://localhost:3001

# After (replace with YOUR computer's IP):
EXPO_PUBLIC_API_URL=http://192.168.1.100:3001
```

#### Step 3: Restart Expo

```bash
# Stop the current Expo server (Ctrl+C)
# Then restart:
npx expo start --clear
```

---

## Solution 2: Update CORS Settings (If Using Real Device)

The server needs to allow connections from your mobile device's origin.

### Update server.cjs CORS configuration:

```javascript
// In server.cjs, update corsOptions:
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // Allow all origins in development
    if (process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      // In production, check against whitelist
      const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
      if (origin === allowedOrigin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

---

## Solution 3: Check Network Connection

### Verify Both Devices on Same Network

1. **Computer and mobile device must be on the same WiFi network**
2. **Test connection:**

```bash
# From your computer, get your IP:
ipconfig getifaddr en0

# From mobile device browser, navigate to:
http://YOUR_IP:3001/api/health
```

If you see a response, the connection works!

---

## Solution 4: Test Upload with cURL First

Before testing on mobile, verify the endpoint works:

```bash
# Create a test audio file
echo "test audio" > test.m4a

# Get your IP address
IP_ADDRESS=$(ipconfig getifaddr en0)

# Test upload
curl -X POST http://$IP_ADDRESS:3001/api/recordings/upload \
  -F "audio=@test.m4a" \
  -F "durationSeconds=10"
```

Expected response:
```json
{
  "recordingId": "uuid-here",
  "storagePath": "audio/test-user-id/uuid.webm",
  "status": "uploaded",
  "durationSeconds": 10
}
```

---

## Solution 5: Check Firewall Settings

### Mac Firewall
```bash
# Check if firewall is blocking:
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# If enabled, allow Node.js:
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add $(which node)
```

### Windows Firewall
1. Open Windows Defender Firewall
2. Click "Allow an app through firewall"
3. Add Node.js if not listed

---

## Debugging Steps

### 1. Check Server is Running

```bash
lsof -i :3001 | grep LISTEN
```

Should show Node.js listening on port 3001.

### 2. Check Network Connectivity

```bash
# From mobile device browser, navigate to:
http://YOUR_COMPUTER_IP:3001/api/health
```

### 3. Check Expo Metro Logs

Look for error messages in the Expo terminal when upload fails.

### 4. Check Server Logs

Watch the server terminal when attempting upload:
```bash
# Server should log incoming requests
# Look for POST /api/recordings/upload
```

### 5. Enable More Logging in RecordScreen

Add this to `uploadRecording` function:

```typescript
const uploadRecording = async (uri: string, durationSeconds: number) => {
  try {
    console.log('=== UPLOAD DEBUG ===');
    console.log('API_URL:', API_URL);
    console.log('Upload URL:', `${API_URL}/api/recordings/upload`);
    console.log('File URI:', uri);
    console.log('Duration:', durationSeconds);

    // ... rest of function
```

---

## Quick Fix Checklist

- [ ] Updated `.env` with computer's IP address (not `localhost`)
- [ ] Restarted Expo with `--clear` flag
- [ ] Computer and mobile on same WiFi network
- [ ] Server is running (`lsof -i :3001`)
- [ ] Firewall allows Node.js connections
- [ ] CORS allows mobile app origin
- [ ] Tested `/api/health` endpoint from mobile browser

---

## Still Not Working?

### Use Expo Tunnel (Alternative)

If local network doesn't work, use Expo's tunnel:

```bash
# Start Expo with tunnel
npx expo start --tunnel
```

Then update `.env`:
```bash
# Use the tunnel URL shown in Expo terminal
EXPO_PUBLIC_API_URL=https://abc123.ngrok.io
```

**Note:** This requires internet connection and may be slower.

---

## Common Errors and Solutions

| Error Message | Cause | Solution |
|--------------|-------|----------|
| "Network error during upload" | Can't reach server | Use IP address, not localhost |
| "No token provided" | Auth header missing | Temporarily disabled - should work without |
| "CORS policy" | Origin not allowed | Update CORS settings |
| "Connection refused" | Server not running | Start server: `node server.cjs` |
| "Invalid file type" | Wrong MIME type | Check file extension matches audio/* |
| "File too large" | Audio > 50MB | Reduce recording length |

---

## For Development: Recommended Setup

**`.env` file:**
```bash
EXPO_PUBLIC_API_URL=http://192.168.1.100:3001
```

**Start both servers:**
```bash
# Terminal 1: Backend
cd /Users/mia/nora
node server.cjs

# Terminal 2: Mobile
cd /Users/mia/nora/nora-mobile
npx expo start --clear
```

**Test connection from mobile browser:**
```
http://192.168.1.100:3001/api/health
```

Should return: `{"status":"healthy"}`

---

## Success Indicators

You'll know it's working when:
1. ✅ Mobile browser can access `http://YOUR_IP:3001/api/health`
2. ✅ Expo shows your computer's IP in the Metro bundler
3. ✅ Upload progress bar appears and reaches 100%
4. ✅ Success alert shows: "Upload Complete! 🎉"
5. ✅ Server logs show: "Audio uploaded to S3: audio/userId/sessionId.webm"
