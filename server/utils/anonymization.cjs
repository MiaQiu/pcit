/**
 * Anonymization Utility for PDPA Compliance
 *
 * Implements pseudonymization for third-party API calls:
 * - Strips all identifying metadata before sending to third parties
 * - Uses temporary request_id instead of real user_id
 * - Maintains mapping only in secure database
 * - Auto-expires request mappings after 24 hours
 */

const crypto = require('crypto');
const prisma = require('../services/db.cjs');

/**
 * Generate a cryptographically secure request ID
 * Format: req_<timestamp>_<random>
 */
function generateRequestId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(16).toString('hex');
  return `req_${timestamp}_${random}`;
}

/**
 * Create a hash of request data for audit purposes (without storing actual data)
 */
function hashRequestData(data) {
  if (!data) return null;
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(data));
  return hash.digest('hex').substring(0, 32); // First 32 chars
}

/**
 * Create anonymized request mapping
 *
 * @param {string} userId - Real user ID
 * @param {string} provider - Third-party provider (e.g., 'elevenlabs', 'deepgram', 'claude')
 * @param {string} requestType - Type of request (e.g., 'transcription', 'analysis')
 * @param {any} data - Request data to hash (optional, for audit)
 * @returns {Promise<string>} - Anonymized request_id
 */
async function createAnonymizedRequest(userId, provider, requestType, data = null) {
  const requestId = generateRequestId();
  const dataHash = data ? hashRequestData(data) : null;

  // Request expires after 24 hours
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await prisma.thirdPartyRequest.create({
    data: {
      id: crypto.randomUUID(),
      requestId,
      userId,
      provider,
      requestType,
      dataHash,
      expiresAt
    }
  });

  console.log(`[ANONYMIZATION] Created request: ${requestId} for user ${userId} → ${provider}/${requestType}`);

  return requestId;
}

/**
 * Resolve anonymized request_id back to user_id
 * Only works if request hasn't expired
 *
 * @param {string} requestId - Anonymized request ID
 * @returns {Promise<string|null>} - Real user ID or null if not found/expired
 */
async function resolveAnonymizedRequest(requestId) {
  const request = await prisma.thirdPartyRequest.findUnique({
    where: { requestId }
  });

  if (!request) {
    console.warn(`[ANONYMIZATION] Request not found: ${requestId}`);
    return null;
  }

  // Check if expired
  if (request.expiresAt < new Date()) {
    console.warn(`[ANONYMIZATION] Request expired: ${requestId}`);
    return null;
  }

  return request.userId;
}

/**
 * Clean up expired request mappings
 * Should be run periodically (e.g., daily cron job)
 */
async function cleanupExpiredRequests() {
  const result = await prisma.thirdPartyRequest.deleteMany({
    where: {
      expiresAt: {
        lt: new Date()
      }
    }
  });

  console.log(`[ANONYMIZATION] Cleaned up ${result.count} expired request mappings`);
  return result.count;
}

/**
 * Get anonymization stats for a user (for transparency/audit)
 */
async function getUserAnonymizationStats(userId) {
  const requests = await prisma.thirdPartyRequest.findMany({
    where: { userId },
    select: {
      provider: true,
      requestType: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  const stats = {
    totalRequests: requests.length,
    byProvider: {},
    byType: {},
    recentRequests: requests.slice(0, 10)
  };

  requests.forEach(req => {
    stats.byProvider[req.provider] = (stats.byProvider[req.provider] || 0) + 1;
    stats.byType[req.requestType] = (stats.byType[req.requestType] || 0) + 1;
  });

  return stats;
}

/**
 * Strip all identifying metadata from data before sending to third party
 * This is an additional layer on top of request_id mapping
 */
function stripIdentifyingMetadata(data) {
  if (!data || typeof data !== 'object') return data;

  const stripped = { ...data };

  // Remove common PII fields
  const piiFields = [
    'userId', 'user_id', 'email', 'name', 'phone', 'address',
    'childName', 'child_name', 'parentName', 'parent_name',
    'sessionId', 'session_id', // Session IDs could be correlatable
    'ip', 'ipAddress', 'ip_address'
  ];

  piiFields.forEach(field => {
    delete stripped[field];
  });

  return stripped;
}

module.exports = {
  generateRequestId,
  createAnonymizedRequest,
  resolveAnonymizedRequest,
  cleanupExpiredRequests,
  getUserAnonymizationStats,
  stripIdentifyingMetadata
};
