// Application-level encryption for sensitive data
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 bytes hex
const IV_LENGTH = 16;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
}

function encrypt(text) {
  if (!text) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  if (!text) return null;

  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Encrypt sensitive child data fields
 * Handles null/undefined values gracefully
 */
function encryptSensitiveData(data) {
  if (!data) return null;
  return encrypt(data);
}

/**
 * Decrypt sensitive child data fields
 * Handles null/undefined values gracefully
 */
function decryptSensitiveData(data) {
  if (!data) return null;
  return decrypt(data);
}

/**
 * Encrypt JSON data (for childMetrics, etc.)
 */
function encryptJSON(jsonData) {
  if (!jsonData) return null;
  const jsonString = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData);
  return encrypt(jsonString);
}

/**
 * Decrypt JSON data
 */
function decryptJSON(encryptedData) {
  if (!encryptedData) return null;
  const decryptedString = decrypt(encryptedData);
  return decryptedString ? JSON.parse(decryptedString) : null;
}

/**
 * Prepare user data for storage (encrypt sensitive fields)
 */
function encryptUserData(userData) {
  return {
    ...userData,
    childName: userData.childName ? encryptSensitiveData(userData.childName) : null,
    childCondition: userData.childCondition ? encryptSensitiveData(userData.childCondition) : null
  };
}

/**
 * Prepare user data for response (decrypt sensitive fields)
 */
function decryptUserData(userData) {
  if (!userData) return null;
  return {
    ...userData,
    childName: userData.childName ? decryptSensitiveData(userData.childName) : null,
    childCondition: userData.childCondition ? decryptSensitiveData(userData.childCondition) : null
  };
}

/**
 * Prepare session data for storage (encrypt sensitive fields)
 */
function encryptSessionData(sessionData) {
  return {
    ...sessionData,
    transcript: sessionData.transcript ? encryptSensitiveData(sessionData.transcript) : null,
    childMetrics: sessionData.childMetrics ? encryptJSON(sessionData.childMetrics) : null
  };
}

/**
 * Prepare session data for response (decrypt sensitive fields)
 */
function decryptSessionData(sessionData) {
  if (!sessionData) return null;
  return {
    ...sessionData,
    transcript: sessionData.transcript ? decryptSensitiveData(sessionData.transcript) : null,
    childMetrics: sessionData.childMetrics ? decryptJSON(sessionData.childMetrics) : null
  };
}

module.exports = {
  encrypt,
  decrypt,
  encryptSensitiveData,
  decryptSensitiveData,
  encryptJSON,
  decryptJSON,
  encryptUserData,
  decryptUserData,
  encryptSessionData,
  decryptSessionData
};
