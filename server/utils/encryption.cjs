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
  try {
    return decrypt(data);
  } catch (e) {
    // Field may be stored in plaintext or encrypted with a different key
    console.warn('Decryption failed, returning raw value');
    return data;
  }
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
 * Encrypts: email, name, childName
 * Does NOT encrypt: childConditions (stored as plain JSON string)
 */
function encryptUserData(userData) {
  return {
    ...userData,
    email: userData.email ? encryptSensitiveData(userData.email) : null,
    name: userData.name ? encryptSensitiveData(userData.name) : null,
    childName: userData.childName ? encryptSensitiveData(userData.childName) : null
  };
}

/**
 * Prepare user data for response (decrypt sensitive fields)
 * Decrypts: email, name, childName
 * childConditions is stored as plain JSON string
 */
function decryptUserData(userData) {
  if (!userData) return null;

  // Parse childConditions as plain JSON (no longer encrypted)
  let childConditions = null;
  if (userData.childConditions) {
    try {
      childConditions = typeof userData.childConditions === 'string'
        ? JSON.parse(userData.childConditions)
        : userData.childConditions;
    } catch (e) {
      console.error('Failed to parse childConditions:', e);
      childConditions = null;
    }
  }

  return {
    ...userData,
    email: userData.email ? decryptSensitiveData(userData.email) : null,
    name: userData.name ? decryptSensitiveData(userData.name) : null,
    childName: userData.childName ? decryptSensitiveData(userData.childName) : null,
    childConditions
  };
}

/**
 * Prepare session data for storage (NO encryption)
 * transcript and childMetrics are now stored as plaintext
 */
function encryptSessionData(sessionData) {
  return {
    ...sessionData
    // No encryption for transcript or childMetrics
  };
}

/**
 * Prepare session data for response (NO decryption)
 * transcript and childMetrics are now stored as plaintext
 */
function decryptSessionData(sessionData) {
  if (!sessionData) return null;
  return {
    ...sessionData
    // No decryption for transcript or childMetrics
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
