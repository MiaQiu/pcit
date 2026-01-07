/**
 * Update Day 4 completion to yesterday for testing lesson unlock
 * Usage: node scripts/update-day4-to-yesterday.cjs
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const USER_ID = 'b9532956-948a-4c74-9a0e-7376716940ad';

async function main() {
  console.log('🔍 Finding Day 4 lesson...');

  // Find Day 4 lesson
  const day4Lesson = await prisma.lesson.findFirst({
    where: {
      dayNumber: 4,
      phase: 'CONNECT',
      isBooster: false,
    },
    select: {
      id: true,
      title: true,
      dayNumber: true,
    },
  });

  if (!day4Lesson) {
    console.error('❌ Day 4 lesson not found');
    process.exit(1);
  }

  console.log(`✅ Found: ${day4Lesson.title} (ID: ${day4Lesson.id})`);
  console.log('');

  // Check current status
  console.log('📋 Current completion status:');
  const currentProgress = await prisma.userLessonProgress.findFirst({
    where: {
      userId: USER_ID,
      lessonId: day4Lesson.id,
    },
    select: {
      status: true,
      completedAt: true,
    },
  });

  if (!currentProgress) {
    console.error('❌ No progress found for Day 4');
    process.exit(1);
  }

  console.log(`Status: ${currentProgress.status}`);
  console.log(`Completed At: ${currentProgress.completedAt}`);
  console.log('');

  // Calculate yesterday in Singapore time
  const now = new Date();
  const singaporeOffset = 8 * 60 * 60 * 1000; // UTC+8
  const nowSingapore = new Date(now.getTime() + singaporeOffset);
  const yesterdaySingapore = new Date(nowSingapore.getTime() - 24 * 60 * 60 * 1000);

  console.log('🔄 Updating Day 4 completion to yesterday...');
  console.log(`New completion time: ${yesterdaySingapore.toISOString()}`);
  console.log('');

  // Update completion date to yesterday
  await prisma.userLessonProgress.update({
    where: {
      userId_lessonId: {
        userId: USER_ID,
        lessonId: day4Lesson.id,
      },
    },
    data: {
      completedAt: yesterdaySingapore,
    },
  });

  // Verify update
  console.log('✅ Updated! Verifying...');
  const updatedProgress = await prisma.userLessonProgress.findFirst({
    where: {
      userId: USER_ID,
      lessonId: day4Lesson.id,
    },
    select: {
      status: true,
      completedAt: true,
    },
  });

  console.log(`Status: ${updatedProgress.status}`);
  console.log(`Completed At: ${updatedProgress.completedAt}`);
  console.log('');

  console.log('🎉 Done! Now:');
  console.log('1. Pull to refresh on the Home screen (or kill and restart the app)');
  console.log('2. Day 5 should now be unlocked');
  console.log('3. Background/foreground the app - should auto-refresh');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
