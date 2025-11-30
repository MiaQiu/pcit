const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

// Cache secrets to avoid repeated API calls
const secretsCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Fetch a secret from AWS Secrets Manager with caching
 * @param {string} secretName - Name of the secret (e.g., 'nora/encryption-key')
 * @returns {Promise<string>} - The secret value
 */
async function getSecret(secretName) {
  // Check cache first
  const cached = secretsCache[secretName];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);
    const secretValue = response.SecretString;

    // Cache the result
    secretsCache[secretName] = {
      value: secretValue,
      timestamp: Date.now()
    };

    return secretValue;
  } catch (error) {
    console.error(`Failed to fetch secret ${secretName}:`, error.message);
    throw error;
  }
}

/**
 * Load all application secrets from AWS Secrets Manager
 * Falls back to environment variables if AWS Secrets Manager is not available
 * @returns {Promise<Object>} - Object containing all secrets
 */
async function loadSecrets() {
  const USE_AWS_SECRETS = process.env.USE_AWS_SECRETS === 'true';

  if (!USE_AWS_SECRETS) {
    console.log('📝 Using environment variables for secrets (local development)');
    return {
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
      JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
      JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      COACH_EMAIL: process.env.COACH_EMAIL
    };
  }

  console.log('🔐 Loading secrets from AWS Secrets Manager...');

  try {
    const [
      encryptionKey,
      jwtAccessSecret,
      jwtRefreshSecret,
      anthropicApiKey,
      elevenLabsApiKey,
      smtpUser,
      smtpPass,
      coachEmail
    ] = await Promise.all([
      getSecret('nora/encryption-key'),
      getSecret('nora/jwt-access-secret'),
      getSecret('nora/jwt-refresh-secret'),
      getSecret('nora/anthropic-api-key'),
      getSecret('nora/elevenlabs-api-key'),
      getSecret('nora/smtp-user'),
      getSecret('nora/smtp-pass'),
      getSecret('nora/coach-email')
    ]);

    console.log('✅ All secrets loaded from AWS Secrets Manager');

    return {
      ENCRYPTION_KEY: encryptionKey,
      JWT_ACCESS_SECRET: jwtAccessSecret,
      JWT_REFRESH_SECRET: jwtRefreshSecret,
      JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
      JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',
      ANTHROPIC_API_KEY: anthropicApiKey,
      ELEVENLABS_API_KEY: elevenLabsApiKey,
      SMTP_USER: smtpUser,
      SMTP_PASS: smtpPass,
      COACH_EMAIL: coachEmail
    };
  } catch (error) {
    console.error('❌ Failed to load secrets from AWS Secrets Manager:', error.message);
    console.log('📝 Falling back to environment variables');

    // Fallback to environment variables
    return {
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
      JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
      JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      COACH_EMAIL: process.env.COACH_EMAIL
    };
  }
}

module.exports = { getSecret, loadSecrets };
