// AWS S3 Storage service for audio file management
const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// S3 configuration (optional for development)
const S3_ENABLED = process.env.AWS_S3_BUCKET;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

let s3Client = null;
let bucketName = null;

if (S3_ENABLED) {
  try {
    s3Client = new S3Client({
      region: AWS_REGION,
      // AWS SDK will automatically use IAM role credentials when running on App Runner
      // For local development, it will use AWS CLI credentials or environment variables
    });
    bucketName = process.env.AWS_S3_BUCKET;
    console.log('S3 initialized:', bucketName);
  } catch (error) {
    console.error('S3 initialization error:', error.message);
  }
}

/**
 * Upload audio file to AWS S3
 * @param {Buffer} fileBuffer - Audio file buffer
 * @param {string} userId - User ID for path organization
 * @param {string} sessionId - Session ID for file naming
 * @returns {Promise<string>} - S3 file path or local mock path
 */
async function uploadAudioFile(fileBuffer, userId, sessionId) {
  if (!S3_ENABLED || !s3Client) {
    // Development mode: return mock path
    console.warn('S3 not configured, using mock storage path');
    return `mock://audio/${userId}/${sessionId}.webm`;
  }

  try {
    const key = `audio/${userId}/${sessionId}.webm`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: 'audio/webm',
      Metadata: {
        userId: userId,
        sessionId: sessionId,
        uploadedAt: new Date().toISOString()
      },
      // Server-side encryption (uses default bucket encryption)
      ServerSideEncryption: 'AES256'
    });

    await s3Client.send(command);

    console.log(`Audio uploaded to S3: ${key}`);
    return key;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('Failed to upload audio file');
  }
}

/**
 * Delete audio file from AWS S3
 * @param {string} filePath - S3 file path (key)
 */
async function deleteAudioFile(filePath) {
  if (!S3_ENABLED || !s3Client || filePath.startsWith('mock://')) {
    console.warn('S3 not configured or mock path, skipping deletion');
    return;
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: filePath
    });

    await s3Client.send(command);
    console.log(`Audio deleted from S3: ${filePath}`);
  } catch (error) {
    console.error('S3 delete error:', error);
    // Don't throw - deletion failures shouldn't break the flow
  }
}

/**
 * Generate signed URL for temporary audio access (7 days)
 * @param {string} filePath - S3 file path (key)
 * @returns {Promise<string>} - Signed URL or mock URL
 */
async function getSignedUrl(filePath) {
  if (!S3_ENABLED || !s3Client || filePath.startsWith('mock://')) {
    return filePath; // Return mock path as-is
  }

  try {
    // First verify the object exists
    const headCommand = new HeadObjectCommand({
      Bucket: bucketName,
      Key: filePath
    });

    await s3Client.send(headCommand);

    // Generate signed URL (valid for 7 days)
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: filePath
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: 7 * 24 * 60 * 60 // 7 days in seconds
    });

    return url;
  } catch (error) {
    if (error.name === 'NotFound') {
      console.error(`S3 object not found: ${filePath}`);
      throw new Error('Audio file not found');
    }
    console.error('S3 signed URL error:', error);
    throw new Error('Failed to generate signed URL');
  }
}

/**
 * Check if S3 is enabled and configured
 * @returns {boolean}
 */
function isS3Enabled() {
  return !!S3_ENABLED;
}

module.exports = {
  uploadAudioFile,
  deleteAudioFile,
  getSignedUrl,
  isS3Enabled
};
