/**
 * PRIDE to PEN Skills Migration Script
 *
 * This script migrates existing session data from PRIDE skills to PEN skills:
 * - Reflect → Echo
 * - Describe → Narration
 * - Remove: Imitate, Enjoyment
 * - totalPride → totalPen (praise + echo + narration)
 *
 * IMPORTANT: This script creates a backup before making changes
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting PRIDE to PEN migration...\n');

  try {
    // Step 1: Create backup
    console.log('📦 Step 1: Creating backup of all sessions...');
    const allSessions = await prisma.session.findMany({
      include: {
        User: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `pride-to-pen-migration-${timestamp}.json`);

    fs.writeFileSync(backupPath, JSON.stringify(allSessions, null, 2));
    console.log(`✅ Backup created: ${backupPath}`);
    console.log(`   Total sessions backed up: ${allSessions.length}\n`);

    // Step 2: Migrate each session
    console.log('🔄 Step 2: Migrating session data...');
    let successCount = 0;
    let errorCount = 0;

    for (const session of allSessions) {
      try {
        const updates = {};

        // Migrate tagCounts JSON
        if (session.tagCounts && typeof session.tagCounts === 'object') {
          const oldCounts = session.tagCounts;
          const newCounts = {
            praise: oldCounts.praise || 0,
            echo: oldCounts.reflect || 0,           // Reflect → Echo
            narration: oldCounts.describe || 0,     // Describe → Narration
            question: oldCounts.question || 0,
            command: oldCounts.command || 0,
            criticism: oldCounts.criticism || 0,
            negative_phrases: oldCounts.negative_phrases || 0,
            neutral: oldCounts.neutral || 0,
            totalPen: (oldCounts.praise || 0) + (oldCounts.reflect || 0) + (oldCounts.describe || 0),
            totalAvoid: oldCounts.totalAvoid || 0
          };

          updates.tagCounts = newCounts;
        }

        // Migrate pcitCoding text (replace tag names)
        if (session.pcitCoding && typeof session.pcitCoding === 'string') {
          let newCoding = session.pcitCoding;

          // Replace [DO: Reflect] → [DO: Echo]
          newCoding = newCoding.replace(/\[DO:\s*Reflect\]/gi, '[DO: Echo]');

          // Replace [DO: Describe] → [DO: Narration]
          newCoding = newCoding.replace(/\[DO:\s*Describe\]/gi, '[DO: Narration]');

          // Remove [DO: Imitate] tags (replace with empty string)
          newCoding = newCoding.replace(/\[DO:\s*Imitate\]\s*/gi, '');

          // Remove [DO: Enjoy] tags (replace with empty string)
          newCoding = newCoding.replace(/\[DO:\s*Enjoy\]\s*/gi, '');

          updates.pcitCoding = newCoding;
        }

        // Migrate competencyAnalysis text (replace PRIDE → PEN references)
        if (session.competencyAnalysis && typeof session.competencyAnalysis === 'string') {
          let newAnalysis = session.competencyAnalysis;

          // Replace PRIDE references
          newAnalysis = newAnalysis.replace(/PRIDE/g, 'PEN');
          newAnalysis = newAnalysis.replace(/Reflect(ion)?s?/g, 'Echo');
          newAnalysis = newAnalysis.replace(/Behavioral Descriptions?/g, 'Narration');
          newAnalysis = newAnalysis.replace(/Descriptions?/g, 'Narration');

          updates.competencyAnalysis = newAnalysis;
        }

        // Update the session if there are changes
        if (Object.keys(updates).length > 0) {
          await prisma.session.update({
            where: { id: session.id },
            data: updates
          });
          successCount++;
        }

      } catch (error) {
        console.error(`❌ Error migrating session ${session.id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n✅ Migration completed!`);
    console.log(`   Successfully migrated: ${successCount} sessions`);
    console.log(`   Errors: ${errorCount} sessions`);
    console.log(`\n📊 Summary:`);
    console.log(`   - tagCounts fields renamed: reflect→echo, describe→narration`);
    console.log(`   - totalPride → totalPen`);
    console.log(`   - pcitCoding tags updated`);
    console.log(`   - competencyAnalysis text updated`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('\n✨ Migration script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error);
    process.exit(1);
  });
