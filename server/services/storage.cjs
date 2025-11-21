// Google Cloud Storage service for audio file management
const { Storage } = require('@google-cloud/storage');

// GCS configuration (optional for development)
const GCS_ENABLED = process.env.GCP_PROJECT_ID && process.env.GCS_BUCKET_NAME;

let storage = null;
let bucket = null;

if (GCS_ENABLED) {
  try {
    const storageConfig = {
      projectId: process.env.GCP_PROJECT_ID
    };

    // Add key file if provided
    if (process.env.GCP_KEY_FILE) {
      storageConfig.keyFilename = process.env.GCP_KEY_FILE;
    }

    storage = new Storage(storageConfig);
    bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
    console.log('GCS initialized:', process.env.GCS_BUCKET_NAME);
  } catch (error) {
    console.error('GCS initialization error:', error.message);
  }
}

/**
 * Upload audio file to Google Cloud Storage
 * @param {Buffer} fileBuffer - Audio file buffer
 * @param {string} userId - User ID for path organization
 * @param {string} sessionId - Session ID for file naming
 * @returns {Promise<string>} - GCS file path or local mock path
 */
async function uploadAudioFile(fileBuffer, userId, sessionId) {
  if (!GCS_ENABLED || !bucket) {
    // Development mode: return mock path
    console.warn('GCS not configured, using mock storage path');
    return `mock://audio/${userId}/${sessionId}.webm`;
  }

  try {
    const fileName = `audio/${userId}/${sessionId}.webm`;
    const file = bucket.file(fileName);

    await file.save(fileBuffer, {
      metadata: {
        contentType: 'audio/webm',
        metadata: {
          userId,
          sessionId,
          uploadedAt: new Date().toISOString()
        }
      }
    });

    console.log(`Audio uploaded to GCS: ${fileName}`);
    return fileName;
  } catch (error) {
    console.error('GCS upload error:', error);
    throw new Error('Failed to upload audio file');
  }
}

/**
 * Delete audio file from Google Cloud Storage
 * @param {string} filePath - GCS file path
 */
async function deleteAudioFile(filePath) {
  if (!GCS_ENABLED || !bucket || filePath.startsWith('mock://')) {
    console.warn('GCS not configured or mock path, skipping deletion');
    return;
  }

  try {
    const file = bucket.file(filePath);
    await file.delete();
    console.log(`Audio deleted from GCS: ${filePath}`);
  } catch (error) {
    console.error('GCS delete error:', error);
    // Don't throw - deletion failures shouldn't break the flow
  }
}

/**
 * Generate signed URL for temporary audio access (7 days)
 * @param {string} filePath - GCS file path
 * @returns {Promise<string>} - Signed URL or mock URL
 */
async function getSignedUrl(filePath) {
  if (!GCS_ENABLED || !bucket || filePath.startsWith('mock://')) {
    return filePath; // Return mock path as-is
  }

  try {
    const file = bucket.file(filePath);
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return url;
  } catch (error) {
    console.error('GCS signed URL error:', error);
    throw new Error('Failed to generate signed URL');
  }
}

module.exports = {
  uploadAudioFile,
  deleteAudioFile,
  getSignedUrl,
  isGCSEnabled: () => GCS_ENABLED
};
