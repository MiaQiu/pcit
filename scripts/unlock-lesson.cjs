require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * Unlock a specific lesson for a user (mark as NOT_STARTED)
 * Usage: node scripts/unlock-lesson.cjs <userId> <phase> <dayNumber>
 * Example: node scripts/unlock-lesson.cjs 365f8f74-2eee-4c12-81c3-3ec35276c1ad CONNECT 15
 */

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('Usage: node scripts/unlock-lesson.cjs <userId> <phase> <dayNumber>');
    console.error('Example: node scripts/unlock-lesson.cjs 365f8f74-2eee-4c12-81c3-3ec35276c1ad CONNECT 15');
    process.exit(1);
  }

  const [userId, phase, dayNumberStr] = args;
  const dayNumber = parseInt(dayNumberStr);

  console.log(`\n🔓 Unlocking lesson...`);
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

    // 3. Check if progress already exists
    const existing = await prisma.userLessonProgress.findUnique({
      where: {
        userId_lessonId: {
          userId,
          lessonId: lesson.id
        }
      }
    });

    if (existing) {
      console.log(`⚠️  Progress already exists with status: ${existing.status}`);

      // If it's already unlocked (NOT_STARTED, IN_PROGRESS, or COMPLETED), just report it
      if (existing.status !== 'LOCKED') {
        console.log(`✅ Lesson is already unlocked!\n`);
        process.exit(0);
      }

      // If it's LOCKED, update to NOT_STARTED
      const updated = await prisma.userLessonProgress.update({
        where: { id: existing.id },
        data: {
          status: 'NOT_STARTED',
          lastViewedAt: new Date()
        }
      });

      console.log(`✅ Lesson unlocked! Status changed from LOCKED to NOT_STARTED\n`);
      process.exit(0);
    }

    // 4. Create new progress record as NOT_STARTED (unlocked)
    const totalSegments = lesson.LessonSegment.length + 1; // +1 for quiz
    const now = new Date();

    const progress = await prisma.userLessonProgress.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        lessonId: lesson.id,
        status: 'NOT_STARTED',
        currentSegment: 1,
        totalSegments: totalSegments,
        startedAt: now,
        lastViewedAt: now,
        timeSpentSeconds: 0
      }
    });

    console.log(`✅ Lesson unlocked!`);
    console.log(`   Progress ID: ${progress.id}`);
    console.log(`   Status: ${progress.status}`);
    console.log(`   Total Segments: ${progress.totalSegments}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
