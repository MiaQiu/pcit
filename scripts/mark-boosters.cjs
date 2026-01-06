require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Mark specific lessons as boosters
 * Usage: node scripts/mark-boosters.cjs
 */

async function main() {
  try {
    console.log('🚀 Marking CONNECT Days 16-22 as boosters...\n');

    // Update lessons
    const result = await prisma.lesson.updateMany({
      where: {
        phase: 'CONNECT',
        dayNumber: {
          gte: 16,
          lte: 22
        }
      },
      data: {
        isBooster: true,
        updatedAt: new Date()
      }
    });

    console.log(`✅ Updated ${result.count} lessons\n`);

    // Verify the update
    const boosters = await prisma.lesson.findMany({
      where: {
        phase: 'CONNECT',
        isBooster: true
      },
      orderBy: {
        dayNumber: 'asc'
      },
      select: {
        dayNumber: true,
        title: true,
        isBooster: true
      }
    });

    console.log('📋 Current boosters in CONNECT phase:');
    boosters.forEach(lesson => {
      console.log(`   • Day ${lesson.dayNumber}: ${lesson.title} (isBooster: ${lesson.isBooster})`);
    });

    console.log('\n🎉 Update completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
