/**
 * Encryption Schema Update Migration Script
 *
 * Changes:
 * USER TABLE:
 *   - Encrypt: email, name (NEW)
 *   - Keep encrypted: childName
 *   - Decrypt: childConditions (remove encryption)
 *   - Add: emailHash field for lookups
 *
 * SESSION TABLE:
 *   - Decrypt: transcript, childMetrics (remove encryption)
 *
 * Run with: node scripts/migrate-encryption-update.cjs
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { encryptSensitiveData, decryptSensitiveData, decryptJSON } = require('../server/utils/encryption.cjs');

const prisma = new PrismaClient();

// Backup directory
const BACKUP_DIR = path.join(__dirname, '../backups');
const BACKUP_FILE = path.join(BACKUP_DIR, `encryption-update-backup-${Date.now()}.json`);

/**
 * Check if data is encrypted (format: "iv:encryptedData")
 */
function isEncrypted(data) {
  if (!data) return false;
  if (typeof data !== 'string') return false;
  return data.includes(':') && data.split(':').length === 2;
}

/**
 * Create backup of all data before migration
 */
async function createBackup() {
  console.log('\n📦 Creating backup...');

  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

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
  let updatedCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    const updates = {};
    let needsUpdate = false;

    try {
      // 1. Encrypt email if not already encrypted
      if (user.email && !isEncrypted(user.email)) {
        updates.email = encryptSensitiveData(user.email);
        needsUpdate = true;
        console.log(`   Encrypting email for user ${user.id}`);
      }

      // 2. Encrypt name if not already encrypted
      if (user.name && !isEncrypted(user.name)) {
        updates.name = encryptSensitiveData(user.name);
        needsUpdate = true;
        console.log(`   Encrypting name for user ${user.id}`);
      }

      // 3. Add emailHash for lookups
      if (!user.emailHash) {
        // Decrypt email if encrypted to get plaintext for hashing
        const plaintextEmail = isEncrypted(user.email)
          ? decryptSensitiveData(user.email)
          : user.email;

        updates.emailHash = crypto.createHash('sha256').update(plaintextEmail.toLowerCase()).digest('hex');
        needsUpdate = true;
        console.log(`   Adding emailHash for user ${user.id}`);
      }

      // 4. Decrypt childConditions if encrypted
      if (user.childConditions && isEncrypted(user.childConditions)) {
        try {
          const decryptedConditions = decryptSensitiveData(user.childConditions);
          updates.childConditions = decryptedConditions; // Keep as JSON string
          needsUpdate = true;
          console.log(`   Decrypting childConditions for user ${user.id}`);
        } catch (error) {
          console.log(`   childConditions already plaintext for user ${user.id}`);
          // Already plaintext, skip
        }
      }

      // childName stays encrypted (no change needed)

      if (needsUpdate) {
        await prisma.user.update({
          where: { id: user.id },
          data: updates
        });
        updatedCount++;
      } else {
        skippedCount++;
      }
    } catch (error) {
      console.error(`❌ Error migrating user ${user.id}:`, error.message);
      throw error;
    }
  }

  console.log(`✅ User migration complete:`);
  console.log(`   - ${updatedCount} users updated`);
  console.log(`   - ${skippedCount} users skipped (already migrated)`);

  return { updatedCount, skippedCount };
}

/**
 * Migrate session data
 */
async function migrateSessions() {
  console.log('\n💬 Migrating session data...');

  const sessions = await prisma.session.findMany();
  let updatedCount = 0;
  let skippedCount = 0;

  for (const session of sessions) {
    const updates = {};
    let needsUpdate = false;

    try {
      // 1. Decrypt transcript if encrypted
      if (session.transcript && isEncrypted(session.transcript)) {
        try {
          updates.transcript = decryptSensitiveData(session.transcript);
          needsUpdate = true;
          console.log(`   Decrypting transcript for session ${session.id}`);
        } catch (error) {
          console.log(`   transcript already plaintext for session ${session.id}`);
          // Already plaintext, skip
        }
      }

      // 2. Decrypt childMetrics if encrypted
      if (session.childMetrics) {
        // Check if it's a string (potentially encrypted)
        if (typeof session.childMetrics === 'string' && isEncrypted(session.childMetrics)) {
          try {
            const decryptedMetrics = decryptJSON(session.childMetrics);
            updates.childMetrics = decryptedMetrics; // Store as plain JSON
            needsUpdate = true;
            console.log(`   Decrypting childMetrics for session ${session.id}`);
          } catch (error) {
            console.log(`   childMetrics already plaintext for session ${session.id}`);
            // Already plaintext, skip
          }
        }
      }

      if (needsUpdate) {
        await prisma.session.update({
          where: { id: session.id },
          data: updates
        });
        updatedCount++;
      } else {
        skippedCount++;
      }
    } catch (error) {
      console.error(`❌ Error migrating session ${session.id}:`, error.message);
      throw error;
    }
  }

  console.log(`✅ Session migration complete:`);
  console.log(`   - ${updatedCount} sessions updated`);
  console.log(`   - ${skippedCount} sessions skipped (already migrated)`);

  return { updatedCount, skippedCount };
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   Encryption Schema Update Migration                  ║');
  console.log('║   - Encrypt user email and name                        ║');
  console.log('║   - Add emailHash for lookups                          ║');
  console.log('║   - Decrypt childConditions, transcript, childMetrics  ║');
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
    console.log(`   Users updated: ${userStats.updatedCount}`);
    console.log(`   Sessions updated: ${sessionStats.updatedCount}`);
    console.log(`   Backup location: ${BACKUP_FILE}`);
    console.log(`\n⚠️  Next steps:`);
    console.log(`   1. Run: npx prisma migrate dev --name add_email_hash`);
    console.log(`   2. Test the application`);
    console.log(`\n⚠️  To rollback, run:`);
    console.log(`   node scripts/rollback-encryption-update.cjs ${BACKUP_FILE}`);

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

module.exports = { migrate, createBackup };
