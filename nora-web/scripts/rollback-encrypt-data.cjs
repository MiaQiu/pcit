/**
 * Rollback Script for Data Encryption Migration
 *
 * This script restores data from a backup created by migrate-encrypt-data.cjs
 *
 * Usage: node scripts/rollback-encrypt-data.cjs <backup-file-path>
 * Example: node scripts/rollback-encrypt-data.cjs backups/backup-1234567890.json
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function rollback(backupFilePath) {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Data Encryption Rollback Script                   ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  try {
    // Validate backup file
    if (!backupFilePath) {
      console.error('\n❌ Error: Backup file path required');
      console.log('Usage: node scripts/rollback-encrypt-data.cjs <backup-file-path>');
      process.exit(1);
    }

    const fullPath = path.resolve(backupFilePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`\n❌ Error: Backup file not found: ${fullPath}`);
      process.exit(1);
    }

    console.log(`\n📂 Loading backup from: ${fullPath}`);

    // Read backup
    const backupData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    console.log(`   Backup timestamp: ${backupData.timestamp}`);
    console.log(`   Users in backup: ${backupData.metadata.userCount}`);
    console.log(`   Sessions in backup: ${backupData.metadata.sessionCount}`);

    // Confirm rollback
    console.log('\n⚠️  WARNING: This will restore all data to the backup state.');
    console.log('   This will overwrite any changes made since the backup.');

    // Restore users
    console.log('\n👤 Restoring user data...');
    let userCount = 0;
    for (const user of backupData.users) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          childName: user.childName,
          childCondition: user.childCondition
        }
      });
      userCount++;
      if (userCount % 10 === 0) {
        console.log(`   Restored ${userCount}/${backupData.users.length} users...`);
      }
    }
    console.log(`✅ Restored ${userCount} users`);

    // Restore sessions
    console.log('\n💬 Restoring session data...');
    let sessionCount = 0;
    for (const session of backupData.sessions) {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          transcript: session.transcript,
          childMetrics: session.childMetrics
        }
      });
      sessionCount++;
      if (sessionCount % 50 === 0) {
        console.log(`   Restored ${sessionCount}/${backupData.sessions.length} sessions...`);
      }
    }
    console.log(`✅ Restored ${sessionCount} sessions`);

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║     Rollback Complete! ✅                              ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log(`\n📊 Summary:`);
    console.log(`   Users restored: ${userCount}`);
    console.log(`   Sessions restored: ${sessionCount}`);
    console.log(`   Data restored to: ${backupData.timestamp}`);

  } catch (error) {
    console.error('\n❌ Rollback failed:', error);
    console.log('\n   Please check the backup file and try again.');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get backup file from command line argument
const backupFile = process.argv[2];
rollback(backupFile).catch(console.error);
