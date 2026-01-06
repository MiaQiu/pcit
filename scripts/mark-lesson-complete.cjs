require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * Mark a specific lesson as completed for a user
 * Usage: node scripts/mark-lesson-complete.cjs <userId> <phase> <dayNumber>
 * Example: node scripts/mark-lesson-complete.cjs 365f8f74-2eee-4c12-81c3-3ec35276c1ad CONNECT 14
 */

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('Usage: node scripts/mark-lesson-complete.cjs <userId> <phase> <dayNumber>');
    console.error('Example: node scripts/mark-lesson-complete.cjs 365f8f74-2eee-4c12-81c3-3ec35276c1ad CONNECT 14');
    process.exit(1);
  }

  const [userId, phase, dayNumberStr] = args;
  const dayNumber = parseInt(dayNumberStr);

  console.log(`\n🎯 Marking lesson as complete...`);
  console.log(`   User ID: ${userId}`);
  console.log(`   Phase: ${phase}`);
  console.log(`   Day: ${dayNumber}\n`);

  try {
    // 1. Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true }
    });

    if (!user) {
      console.error(`❌ User not found: ${userId}`);
      process.exit(1);
    }

    console.log(`✅ User found: ${user.email}`);

    // 2. Find the lesson
    const lesson = await prisma.lesson.findFirst({
      where: {
        phase: phase.toUpperCase(),
        dayNumber: dayNumber
      },
      include: {
        LessonSegment: true
      }
    });

    if (!lesson) {
      console.error(`❌ Lesson not found: ${phase} Day ${dayNumber}`);
      process.exit(1);
    }

    console.log(`✅ Lesson found: ${lesson.title} (ID: ${lesson.id})`);

    // 3. Get total segments (segments + quiz)
    const totalSegments = lesson.LessonSegment.length + 1; // +1 for quiz

    // 4. Upsert lesson progress as COMPLETED
    const now = new Date();
    const progress = await prisma.userLessonProgress.upsert({
      where: {
        userId_lessonId: {
          userId,
          lessonId: lesson.id
        }
      },
      update: {
        status: 'COMPLETED',
        currentSegment: totalSegments,
        completedAt: now,
        lastViewedAt: now
      },
      create: {
        id: crypto.randomUUID(),
        userId,
        lessonId: lesson.id,
        status: 'COMPLETED',
        currentSegment: totalSegments,
        totalSegments: totalSegments,
        startedAt: now,
        lastViewedAt: now,
        completedAt: now,
        timeSpentSeconds: 0
      }
    });

    console.log(`✅ Lesson marked as complete!`);
    console.log(`   Progress ID: ${progress.id}`);
    console.log(`   Status: ${progress.status}`);
    console.log(`   Completed At: ${progress.completedAt}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
