require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Clear prerequisites for all lessons
 * This unlocks all lessons for viewing without requiring sequential completion
 */

async function clearPrerequisites() {
  try {
    console.log('🔓 Clearing prerequisites for all lessons...\n');

    // Update all lessons to have empty prerequisites
    const result = await prisma.lesson.updateMany({
      data: {
        prerequisites: []
      }
    });

    console.log(`✅ Cleared prerequisites for ${result.count} lessons`);
    console.log('📖 All lessons are now unlocked and accessible!\n');

    // Verify the update
    const lessonsWithPrereqs = await prisma.lesson.count({
      where: {
        prerequisites: {
          isEmpty: false
        }
      }
    });

    if (lessonsWithPrereqs === 0) {
      console.log('✅ Verification: All lessons have empty prerequisites');
    } else {
      console.log(`⚠️  Warning: ${lessonsWithPrereqs} lessons still have prerequisites`);
    }

  } catch (error) {
    console.error('❌ Error clearing prerequisites:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
clearPrerequisites()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
