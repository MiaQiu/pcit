/**
 * Data Encryption Migration Script
 *
 * This script encrypts all existing plaintext sensitive data in the database:
 * - User.childName
 * - User.childCondition
 * - Session.transcript
 * - Session.childMetrics
 *
 * IMPORTANT: This script creates a backup before making changes.
 * Run with: node scripts/migrate-encrypt-data.cjs
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { encryptSensitiveData, encryptJSON } = require('../server/utils/encryption.cjs');

const prisma = new PrismaClient();

// Backup directory
const BACKUP_DIR = path.join(__dirname, '../backups');
const BACKUP_FILE = path.join(BACKUP_DIR, `backup-${Date.now()}.json`);

/**
 * Check if data is already encrypted
 */
function isEncrypted(data) {
  if (!data) return false;
  if (typeof data !== 'string') return false;
  // Encrypted data has format: "iv:encryptedData"
  return data.includes(':') && data.split(':').length === 2;
}

/**
 * Create backup of all data before migration
 */
async function createBackup() {
  console.log('\n📦 Creating backup...');

  try {
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Fetch all users and sessions
    const users = await prisma.user.findMany();
    const sessions = await prisma.session.findMany();

    const backup = {
      timestamp: new Date().toISOString(),
      users,
      sessions,
      metadata: {
        userCount: users.length,
        sessionCount: sessions.length
      }
    };

    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2));
    console.log(`✅ Backup created: ${BACKUP_FILE}`);
    console.log(`   - ${backup.metadata.userCount} users backed up`);
    console.log(`   - ${backup.metadata.sessionCount} sessions backed up`);

    return backup;
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
}

/**
 * Migrate user data
 */
async function migrateUsers() {
  console.log('\n👤 Migrating user data...');

  const users = await prisma.user.findMany();
  let encryptedCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    const updates = {};
    let needsUpdate = false;

    // Check and encrypt childName
    if (user.childName && !isEncrypted(user.childName)) {
      updates.childName = encryptSensitiveData(user.childName);
      needsUpdate = true;
      console.log(`   Encrypting childName for user ${user.email}`);
    }

    // Check and encrypt childCondition
    if (user.childCondition && !isEncrypted(user.childCondition)) {
      updates.childCondition = encryptSensitiveData(user.childCondition);
      needsUpdate = true;
      console.log(`   Encrypting childCondition for user ${user.email}`);
    }

    if (needsUpdate) {
      await prisma.user.update({
        where: { id: user.id },
        data: updates
      });
      encryptedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`✅ User migration complete:`);
  console.log(`   - ${encryptedCount} users encrypted`);
  console.log(`   - ${skippedCount} users skipped (already encrypted)`);

  return { encryptedCount, skippedCount };
}

/**
 * Migrate session data
 */
async function migrateSessions() {
  console.log('\n💬 Migrating session data...');

  const sessions = await prisma.session.findMany();
  let encryptedCount = 0;
  let skippedCount = 0;

  for (const session of sessions) {
    const updates = {};
    let needsUpdate = false;

    // Check and encrypt transcript
    if (session.transcript && !isEncrypted(session.transcript)) {
      updates.transcript = encryptSensitiveData(session.transcript);
      needsUpdate = true;
      console.log(`   Encrypting transcript for session ${session.id}`);
    }

    // Check and encrypt childMetrics (JSON field)
    if (session.childMetrics) {
      // If it's already a string and encrypted, skip
      if (typeof session.childMetrics === 'string' && isEncrypted(session.childMetrics)) {
        // Already encrypted, skip
      } else if (typeof session.childMetrics === 'object' ||
                 (typeof session.childMetrics === 'string' && !isEncrypted(session.childMetrics))) {
        // Need to encrypt
        updates.childMetrics = encryptJSON(session.childMetrics);
        needsUpdate = true;
        console.log(`   Encrypting childMetrics for session ${session.id}`);
      }
    }

    if (needsUpdate) {
      await prisma.session.update({
        where: { id: session.id },
        data: updates
      });
      encryptedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`✅ Session migration complete:`);
  console.log(`   - ${encryptedCount} sessions encrypted`);
  console.log(`   - ${skippedCount} sessions skipped (already encrypted)`);

  return { encryptedCount, skippedCount };
}

/**
 * Rollback from backup
 */
async function rollback(backupFile) {
  console.log('\n⏪ Rolling back from backup...');

  try {
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

    console.log('   Restoring users...');
    for (const user of backupData.users) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          childName: user.childName,
          childCondition: user.childCondition
        }
      });
    }

    console.log('   Restoring sessions...');
    for (const session of backupData.sessions) {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          transcript: session.transcript,
          childMetrics: session.childMetrics
        }
      });
    }

    console.log('✅ Rollback complete!');
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Data Encryption Migration Script                  ║');
  console.log('║     Encrypting sensitive child data                    ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  try {
    // Step 1: Create backup
    const backup = await createBackup();

    // Step 2: Migrate users
    const userStats = await migrateUsers();

    // Step 3: Migrate sessions
    const sessionStats = await migrateSessions();

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║     Migration Complete! ✅                             ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log(`\n📊 Summary:`);
    console.log(`   Users encrypted: ${userStats.encryptedCount}`);
    console.log(`   Sessions encrypted: ${sessionStats.encryptedCount}`);
    console.log(`   Backup location: ${BACKUP_FILE}`);
    console.log(`\n⚠️  To rollback, run:`);
    console.log(`   node scripts/rollback-encrypt-data.cjs ${BACKUP_FILE}`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.log('\n⚠️  No changes were committed due to error.');
    console.log(`   Backup is available at: ${BACKUP_FILE}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate().catch(console.error);
}

module.exports = { migrate, rollback, createBackup };
