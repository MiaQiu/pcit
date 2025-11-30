const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
require('dotenv').config({ path: '/Users/mia/happypillar/.env' });

const prisma = new PrismaClient();

// Encryption functions (same as server/utils/encryption.cjs)
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function hashEmail(email) {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
}

async function createTestUser() {
  try {
    const email = 'newuser@example.com';
    const password = 'password123';
    const name = 'Test User';
    const childName = 'Test Child';
    const childBirthYear = 2020;
    const childConditions = 'None';

    console.log('Creating test user...');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('');

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Encrypt sensitive data
    const encryptedEmail = encrypt(email);
    const emailHash = hashEmail(email);
    const encryptedName = encrypt(name);
    const encryptedChildName = encrypt(childName);
    const encryptedChildConditions = encrypt(childConditions);

    // Create user
    const user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: encryptedEmail,
        emailHash: emailHash,
        passwordHash: passwordHash,
        name: encryptedName,
        childName: encryptedChildName,
        childBirthYear: childBirthYear,
        childConditions: encryptedChildConditions,
        therapistId: null,
        currentStreak: 0,
        longestStreak: 0,
        lastSessionDate: null
      }
    });

    console.log('✅ Test user created successfully!');
    console.log(`User ID: ${user.id}`);
    console.log('');
    console.log('Login credentials:');
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log('');
    console.log('Try logging in at: http://localhost:5173');

  } catch (error) {
    console.error('❌ Failed to create test user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
