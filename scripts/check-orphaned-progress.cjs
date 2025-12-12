require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOrphanedProgress() {
  try {
    console.log('🔍 Checking for orphaned user progress records...\n');

    // Get all user progress records
    const allProgress = await prisma.userLessonProgress.findMany({
      include: {
        lesson: true,
        user: true
      }
    });

    console.log(`Total user progress records: ${allProgress.length}\n`);

    // Find orphaned records (where lesson is null because it was deleted)
    const orphanedRecords = allProgress.filter(p => !p.lesson);

    if (orphanedRecords.length > 0) {
      console.log(`❌ Found ${orphanedRecords.length} orphaned progress records:\n`);

      orphanedRecords.forEach(record => {
        console.log(`  - Progress ID: ${record.id}`);
        console.log(`    User: ${record.user.email}`);
        console.log(`    Lesson ID: ${record.lessonId} (DELETED)`);
        console.log(`    Status: ${record.status}`);
        console.log('');
      });

      console.log('\n⚠️  These records reference lessons that no longer exist.');
      console.log('They should be deleted to prevent errors.\n');
    } else {
      console.log('✅ No orphaned progress records found.\n');
    }

    // Also check for Day 1 and Day 2 specifically
    const day1And2Progress = await prisma.userLessonProgress.findMany({
      where: {
        lesson: {
          phase: 'CONNECT',
          dayNumber: {
            in: [1, 2]
          }
        }
      },
      include: {
        lesson: true,
        user: true
      }
    });

    console.log(`User progress records for Connect Day 1 & 2: ${day1And2Progress.length}`);
    if (day1And2Progress.length > 0) {
      console.log('\nCurrent progress:');
      day1And2Progress.forEach(p => {
        console.log(`  - User: ${p.user.email}`);
        console.log(`    Lesson: Day ${p.lesson.dayNumber} - ${p.lesson.title}`);
        console.log(`    Status: ${p.status}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkOrphanedProgress()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
