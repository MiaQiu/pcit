const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function importBackup() {
  try {
    console.log('Loading backup file...');
    const backup = JSON.parse(fs.readFileSync('/tmp/database-backup-2025-11-27.json', 'utf8'));

    console.log('Backup loaded:');
    console.log(`  Users: ${backup.tables.users?.length || 0}`);
    console.log(`  Sessions: ${backup.tables.sessions?.length || 0}`);
    console.log(`  Learning Progress: ${backup.tables.learningProgress?.length || 0}`);
    console.log(`  Module History: ${backup.tables.moduleHistory?.length || 0}`);
    console.log('');

    // Import Users
    if (backup.tables.users && backup.tables.users.length > 0) {
      console.log('Importing users...');
      for (const user of backup.tables.users) {
        await prisma.user.create({
          data: {
            id: user.id,
            email: user.email,
            emailHash: user.emailHash,
            passwordHash: user.passwordHash,
            name: user.name,
            therapistId: user.therapistId,
            childName: user.childName,
            childBirthYear: user.childBirthYear,
            childConditions: user.childConditions,
            createdAt: new Date(user.createdAt),
            currentStreak: user.currentStreak || 0,
            lastSessionDate: user.lastSessionDate ? new Date(user.lastSessionDate) : null,
            longestStreak: user.longestStreak || 0
          }
        });
      }
      console.log(`✅ Imported ${backup.tables.users.length} users`);
    }

    // Import Sessions
    if (backup.tables.sessions && backup.tables.sessions.length > 0) {
      console.log('Importing sessions...');
      for (const session of backup.tables.sessions) {
        await prisma.session.create({
          data: {
            id: session.id,
            userId: session.userId,
            mode: session.mode,
            storagePath: session.storagePath,
            durationSeconds: session.durationSeconds,
            transcript: session.transcript,
            aiFeedbackJSON: session.aiFeedbackJSON,
            pcitCoding: session.pcitCoding,
            tagCounts: session.tagCounts,
            masteryAchieved: session.masteryAchieved || false,
            riskScore: session.riskScore || 0,
            flaggedForReview: session.flaggedForReview || false,
            coachAlertSent: session.coachAlertSent || false,
            coachAlertSentAt: session.coachAlertSentAt ? new Date(session.coachAlertSentAt) : null,
            createdAt: new Date(session.createdAt),
            childMetrics: session.childMetrics || null
          }
        });
      }
      console.log(`✅ Imported ${backup.tables.sessions.length} sessions`);
    }

    // Import Learning Progress
    if (backup.tables.learningProgress && backup.tables.learningProgress.length > 0) {
      console.log('Importing learning progress...');
      for (const progress of backup.tables.learningProgress) {
        await prisma.learningProgress.create({
          data: {
            id: progress.id,
            userId: progress.userId,
            currentDeck: progress.currentDeck,
            unlockedDecks: progress.unlockedDecks,
            updatedAt: new Date(progress.updatedAt)
          }
        });
      }
      console.log(`✅ Imported ${backup.tables.learningProgress.length} learning progress records`);
    }

    // Import Module History
    if (backup.tables.moduleHistory && backup.tables.moduleHistory.length > 0) {
      console.log('Importing module history...');
      for (const history of backup.tables.moduleHistory) {
        await prisma.moduleHistory.create({
          data: {
            id: history.id,
            userId: history.userId,
            category: history.category,
            level: history.level,
            viewedAt: new Date(history.viewedAt)
          }
        });
      }
      console.log(`✅ Imported ${backup.tables.moduleHistory.length} module history entries`);
    }

    console.log('');
    console.log('🎉 Import completed successfully!');

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

importBackup();
