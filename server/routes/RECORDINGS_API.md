# Recording Upload API Documentation

## Overview
This API handles audio recording uploads from the Nora mobile app, storing files in AWS S3 and creating session records for transcription and PCIT analysis.

## Endpoints

### 1. Upload Recording

**Endpoint:** `POST /api/recordings/upload`

**Authentication:** Required (Bearer token)

**Content-Type:** `multipart/form-data`

**Request Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| audio | File | Yes | Audio file (mp4, aac, mpeg, wav, webm, m4a) |
| durationSeconds | Number | No | Recording duration in seconds |

**Accepted Audio Formats:**
- audio/mp4
- audio/aac
- audio/mpeg
- audio/wav
- audio/webm
- audio/m4a
- audio/x-m4a

**Max File Size:** 50MB

**Response (Success - 201):**
```json
{
  "recordingId": "uuid-v4",
  "storagePath": "audio/userId/sessionId.webm",
  "status": "uploaded",
  "message": "Audio uploaded successfully. Transcription can now be triggered.",
  "durationSeconds": 300
}
```

**Response (Error - 400):**
```json
{
  "error": "No audio file provided",
  "details": "Please include an audio file in the 'audio' field"
}
```

**Response (Error - 500):**
```json
{
  "error": "Failed to upload audio file",
  "details": "S3 upload error message"
}
```

### 2. Get Recording Details

**Endpoint:** `GET /api/recordings/:id`

**Authentication:** Required (Bearer token)

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Recording/Session ID |

**Response (Success - 200):**
```json
{
  "id": "uuid-v4",
  "mode": "CDI",
  "durationSeconds": 300,
  "transcript": "Transcription text here...",
  "pcitCoding": { /* PCIT coding results */ },
  "tagCounts": { /* Tag count summary */ },
  "masteryAchieved": false,
  "riskScore": 0,
  "flaggedForReview": false,
  "createdAt": "2025-12-03T12:00:00.000Z",
  "status": "transcribed"
}
```

**Response (Error - 404):**
```json
{
  "error": "Recording not found"
}
```

**Response (Error - 403):**
```json
{
  "error": "Access denied"
}
```

### 3. List User Recordings

**Endpoint:** `GET /api/recordings`

**Authentication:** Required (Bearer token)

**Response (Success - 200):**
```json
{
  "recordings": [
    {
      "id": "uuid-v4",
      "mode": "CDI",
      "durationSeconds": 300,
      "masteryAchieved": false,
      "createdAt": "2025-12-03T12:00:00.000Z",
      "status": "transcribed"
    }
  ]
}
```

## Mobile App Integration (React Native)

### Example: Upload Recording with expo-av

```typescript
import { Audio } from 'expo-av';

async function uploadRecording(recording: Audio.Recording) {
  try {
    // Get recording URI
    const uri = recording.getURI();
    if (!uri) {
      throw new Error('No recording URI');
    }

    // Get duration from status
    const status = await recording.getStatusAsync();
    const durationSeconds = Math.floor(status.durationMillis / 1000);

    // Create FormData
    const formData = new FormData();
    formData.append('audio', {
      uri: uri,
      type: 'audio/m4a', // expo-av records in m4a on iOS
      name: 'recording.m4a',
    } as any);
    formData.append('durationSeconds', durationSeconds.toString());

    // Get auth token (from your auth context)
    const token = await getAuthToken();

    // Upload to backend
    const response = await fetch('http://localhost:3001/api/recordings/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error);
    }

    const result = await response.json();
    console.log('Upload successful:', result);

    return result.recordingId;

  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}
```

### Example: Upload with Progress Tracking

```typescript
async function uploadWithProgress(
  recording: Audio.Recording,
  onProgress: (progress: number) => void
) {
  const uri = recording.getURI();
  if (!uri) throw new Error('No recording URI');

  const status = await recording.getStatusAsync();
  const durationSeconds = Math.floor(status.durationMillis / 1000);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100;
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 201) {
        const result = JSON.parse(xhr.responseText);
        resolve(result.recordingId);
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    // Prepare FormData
    const formData = new FormData();
    formData.append('audio', {
      uri: uri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    } as any);
    formData.append('durationSeconds', durationSeconds.toString());

    // Get token and upload
    getAuthToken().then(token => {
      xhr.open('POST', 'http://localhost:3001/api/recordings/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });
  });
}
```

### Example: Full Recording Flow

```typescript
import { Audio } from 'expo-av';
import { useState } from 'react';

function useRecording() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const startRecording = async () => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Permission denied');
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopAndUpload = async () => {
    if (!recording) return;

    try {
      // Stop recording
      await recording.stopAndUnloadAsync();

      // Upload
      setUploading(true);
      const recordingId = await uploadWithProgress(
        recording,
        (progress) => setUploadProgress(progress)
      );

      // Success!
      console.log('Recording uploaded:', recordingId);

      // Clean up
      setRecording(null);
      setUploading(false);
      setUploadProgress(0);

      return recordingId;

    } catch (error) {
      console.error('Failed to upload:', error);
      setUploading(false);
      setUploadProgress(0);
      throw error;
    }
  };

  return {
    recording,
    uploading,
    uploadProgress,
    startRecording,
    stopAndUpload,
  };
}
```

## AWS S3 Storage

### File Path Structure
```
audio/
  {userId}/
    {sessionId}.webm
```

### S3 Configuration Required

Environment variables (`.env`):
```bash
AWS_REGION=us-east-1
AWS_S3_BUCKET=nora-audio-{account-id}
```

### IAM Permissions Required

The server needs these S3 permissions:
- `s3:PutObject` - Upload files
- `s3:DeleteObject` - Delete files
- `s3:GetObject` - Download files
- `s3:HeadObject` - Check file existence

### Development Mode

If S3 is not configured, the endpoint will:
- Still create session records
- Use mock storage path: `mock://audio/{userId}/{sessionId}.webm`
- Work for local testing without AWS account

## Database Schema

### Session Table
```prisma
model Session {
  id               String      @id
  userId           String
  mode             SessionMode  // CDI or PDI
  storagePath      String      // S3 path or mock path
  durationSeconds  Int
  transcript       String      // Empty until transcribed
  aiFeedbackJSON   Json
  pcitCoding       Json
  tagCounts        Json
  masteryAchieved  Boolean     @default(false)
  riskScore        Int         @default(0)
  flaggedForReview Boolean     @default(false)
  createdAt        DateTime    @default(now())
}
```

## Next Steps

After successful upload, the mobile app should:

1. **Trigger Transcription** - Call transcription service with recordingId
2. **Poll for Results** - Check `/api/recordings/:id` until transcript is available
3. **Trigger PCIT Analysis** - Call PCIT analysis service with transcript
4. **Display Results** - Show transcription, PEN skills, and Nora Score

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| File too large | Audio > 50MB | Compress or limit recording duration |
| Invalid file type | Wrong MIME type | Check file format is audio |
| S3 upload failed | AWS credentials/permissions | Check AWS configuration |
| No audio file provided | Missing FormData field | Include 'audio' field in FormData |
| Authentication failed | Invalid/expired token | Refresh auth token |

### Retry Strategy

Recommended retry logic for mobile app:
- Retry on network errors (max 3 attempts)
- Exponential backoff: 2s, 4s, 8s
- Don't retry on 4xx errors (client errors)
- Retry on 5xx errors (server errors)

## Testing

### Test Upload with cURL

```bash
# Get auth token first
TOKEN="your-jwt-token-here"

# Upload audio file
curl -X POST http://localhost:3001/api/recordings/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "audio=@recording.m4a" \
  -F "durationSeconds=300"
```

### Test Get Recording

```bash
curl http://localhost:3001/api/recordings/{recordingId} \
  -H "Authorization: Bearer $TOKEN"
```

### Test List Recordings

```bash
curl http://localhost:3001/api/recordings \
  -H "Authorization: Bearer $TOKEN"
```
