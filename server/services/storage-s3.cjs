// AWS S3 Storage service for audio file management
const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl: getSignedUrlSDK } = require('@aws-sdk/s3-request-presigner');

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
 * @param {string} mimeType - MIME type of the audio file (e.g., 'audio/m4a', 'audio/webm')
 * @returns {Promise<string>} - S3 file path or local mock path
 */
async function uploadAudioFile(fileBuffer, userId, sessionId, mimeType = 'audio/m4a') {
  // Extract file extension from MIME type
  // Examples: 'audio/m4a' -> 'm4a', 'audio/x-m4a' -> 'm4a', 'audio/mpeg' -> 'mpeg'
  let extension = 'm4a'; // Default for mobile recordings

  if (mimeType) {
    const parts = mimeType.split('/');
    if (parts.length === 2) {
      // Handle 'audio/x-m4a' -> 'm4a'
      extension = parts[1].replace('x-', '');
    }
  }

  if (!S3_ENABLED || !s3Client) {
    // Development mode: return mock path with correct extension
    console.warn('S3 not configured, using mock storage path');
    return `mock://audio/${userId}/${sessionId}.${extension}`;
  }

  try {
    const key = `audio/${userId}/${sessionId}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType, // Use actual MIME type from uploaded file
      Metadata: {
        userId: userId,
        sessionId: sessionId,
        uploadedAt: new Date().toISOString(),
        originalMimeType: mimeType
      },
      // Server-side encryption (uses default bucket encryption)
      ServerSideEncryption: 'AES256'
    });

    await s3Client.send(command);

    console.log(`Audio uploaded to S3: ${key} (${mimeType})`);
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

    const url = await getSignedUrlSDK(s3Client, command, {
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
 * Upload profile image to AWS S3 (publicly accessible)
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {string} userId - User ID for path organization
 * @param {string} extension - File extension (jpg, png, etc.)
 * @returns {Promise<string>} - Public S3 URL or mock path
 */
async function uploadProfileImage(fileBuffer, userId, extension = 'jpg') {
  if (!S3_ENABLED || !s3Client) {
    // Development mode: return mock path
    console.warn('S3 not configured, using mock storage path for profile image');
    return `mock://profiles/${userId}/avatar.${extension}`;
  }

  try {
    const key = `profiles/${userId}/avatar.${extension}`;

    // Determine content type based on extension
    const contentTypeMap = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    const contentType = contentTypeMap[extension.toLowerCase()] || 'image/jpeg';

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: {
        userId: userId,
        uploadedAt: new Date().toISOString()
      },
      // Server-side encryption
      ServerSideEncryption: 'AES256',
      // Make publicly readable
      ACL: 'public-read'
    });

    await s3Client.send(command);

    // Return public URL
    const publicUrl = `https://${bucketName}.s3.${AWS_REGION}.amazonaws.com/${key}`;
    console.log(`Profile image uploaded to S3: ${key}`);
    return publicUrl;
  } catch (error) {
    console.error('S3 profile image upload error:', error);
    throw new Error('Failed to upload profile image');
  }
}

/**
 * Delete profile image from AWS S3
 * @param {string} imageUrl - Profile image URL or S3 path
 */
async function deleteProfileImage(imageUrl) {
  if (!S3_ENABLED || !s3Client || !imageUrl || imageUrl.startsWith('mock://')) {
    console.warn('S3 not configured or mock path, skipping deletion');
    return;
  }

  try {
    // Extract key from URL if it's a full URL
    let key = imageUrl;
    if (imageUrl.startsWith('https://')) {
      // Extract key from URL like: https://bucket.s3.region.amazonaws.com/profiles/userId/avatar.jpg
      const urlPattern = /https:\/\/[^/]+\/(.+)/;
      const match = imageUrl.match(urlPattern);
      if (match && match[1]) {
        key = match[1];
      }
    }

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key
    });

    await s3Client.send(command);
    console.log(`Profile image deleted from S3: ${key}`);
  } catch (error) {
    console.error('S3 profile image delete error:', error);
    // Don't throw - deletion failures shouldn't break the flow
  }
}

/**
 * Upload support attachment to AWS S3 (publicly accessible)
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} userId - User ID for path organization
 * @param {string} requestId - Support request ID for path organization
 * @param {string} fileName - Original file name
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<{url: string, name: string, size: number}>} - Public S3 URL and file metadata
 */
async function uploadSupportAttachment(fileBuffer, userId, requestId, fileName, mimeType) {
  if (!S3_ENABLED || !s3Client) {
    // Development mode: return mock path
    console.warn('S3 not configured, using mock storage path for support attachment');
    return {
      url: `mock://support/${userId}/${requestId}/${fileName}`,
      name: fileName,
      size: fileBuffer.length
    };
  }

  try {
    // Sanitize filename to prevent path traversal
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `support/${userId}/${requestId}/${sanitizedFileName}`;

    // Use separate bucket for support attachments if configured
    const supportBucketName = process.env.AWS_S3_SUPPORT_BUCKET || bucketName;
    const supportRegion = process.env.AWS_S3_SUPPORT_REGION || AWS_REGION;

    // Create S3 client for support bucket (may be in different region)
    const supportS3Client = new S3Client({ region: supportRegion });

    const command = new PutObjectCommand({
      Bucket: supportBucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      Metadata: {
        userId: userId,
        requestId: requestId,
        originalFileName: fileName,
        uploadedAt: new Date().toISOString()
      },
      // Server-side encryption
      ServerSideEncryption: 'AES256',
      // Make publicly readable so support staff can access
      ACL: 'public-read'
    });

    await supportS3Client.send(command);

    // Return public URL and metadata (use the support bucket name and region)
    const publicUrl = `https://${supportBucketName}.s3.${supportRegion}.amazonaws.com/${key}`;
    console.log(`Support attachment uploaded to S3: ${supportBucketName}/${key} (${supportRegion})`);

    return {
      url: publicUrl,
      name: fileName,
      size: fileBuffer.length
    };
  } catch (error) {
    console.error('S3 support attachment upload error:', error);
    throw new Error('Failed to upload support attachment');
  }
}

/**
 * Generate presigned URL for direct upload from mobile app
 * @param {string} userId - User ID for path organization
 * @param {string} sessionId - Session ID for file naming
 * @param {string} mimeType - MIME type of the audio file (default: 'audio/m4a')
 * @returns {Promise<{url: string, key: string, expiresIn: number}>} - Presigned upload URL and metadata
 */
async function getPresignedUploadUrl(userId, sessionId, mimeType = 'audio/m4a') {
  if (!S3_ENABLED || !s3Client) {
    throw new Error('S3 is not configured. Presigned URLs are not available in development mode.');
  }

  try {
    // Extract file extension from MIME type
    let extension = 'm4a';
    if (mimeType) {
      const parts = mimeType.split('/');
      if (parts.length === 2) {
        extension = parts[1].replace('x-', '');
      }
    }

    const key = `audio/${userId}/${sessionId}.${extension}`;
    const expiresIn = 300; // 5 minutes

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: mimeType,
      Metadata: {
        userId: userId,
        sessionId: sessionId,
        uploadedAt: new Date().toISOString(),
        originalMimeType: mimeType
      },
      ServerSideEncryption: 'AES256'
    });

    const url = await getSignedUrlSDK(s3Client, command, { expiresIn });

    console.log(`Generated presigned upload URL for session ${sessionId} (expires in ${expiresIn}s)`);

    return {
      url,
      key,
      expiresIn
    };
  } catch (error) {
    console.error('S3 presigned URL generation error:', error);
    throw new Error('Failed to generate presigned upload URL');
  }
}

/**
 * Verify that a file exists in S3 after upload
 * @param {string} key - S3 file path (key)
 * @returns {Promise<{exists: boolean, size?: number, contentType?: string}>}
 */
async function verifyFileExists(key) {
  if (!S3_ENABLED || !s3Client) {
    throw new Error('S3 is not configured');
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key
    });

    const response = await s3Client.send(command);

    return {
      exists: true,
      size: response.ContentLength,
      contentType: response.ContentType
    };
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return { exists: false };
    }
    console.error('S3 file verification error:', error);
    throw new Error('Failed to verify file upload');
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
  getPresignedUploadUrl,
  verifyFileExists,
  uploadProfileImage,
  deleteProfileImage,
  uploadSupportAttachment,
  isS3Enabled
};
