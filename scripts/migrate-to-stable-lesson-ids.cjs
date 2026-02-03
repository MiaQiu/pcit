require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Migration script to convert random lesson IDs to stable IDs
 *
 * Stable ID format: `{PHASE}-{DAY_NUMBER}` (e.g., "CONNECT-1", "DISCIPLINE-5")
 *
 * This script must be run BEFORE running import-all-lessons.cjs with stable IDs.
 *
 * Usage: node scripts/migrate-to-stable-lesson-ids.cjs
 */

function generateStableId(phase, dayNumber) {
  return `${phase}-${dayNumber}`;
}

async function main() {
  console.log('🚀 Starting migration to stable lesson IDs...\n');

  // 1. Fetch all existing lessons
  const lessons = await prisma.lesson.findMany({
    orderBy: [{ phaseNumber: 'asc' }, { dayNumber: 'asc' }]
  });

  console.log(`📚 Found ${lessons.length} lessons to migrate\n`);

  if (lessons.length === 0) {
    console.log('No lessons found. Nothing to migrate.');
    return;
  }

  // 2. Build mapping: oldId -> newStableId
  const idMapping = {};
  for (const lesson of lessons) {
    const stableId = generateStableId(lesson.phase, lesson.dayNumber);
    idMapping[lesson.id] = stableId;
    console.log(`  ${lesson.id} -> ${stableId} (${lesson.phase} Day ${lesson.dayNumber}: ${lesson.title})`);
  }

  // Check if already migrated (IDs are already in stable format)
  const alreadyMigrated = lessons.every(l => l.id === generateStableId(l.phase, l.dayNumber));
  if (alreadyMigrated) {
    console.log('\n✅ Lessons already have stable IDs. Nothing to migrate.');
    return;
  }

  console.log('\n🔄 Migrating lessons and progress records...\n');

  // 3. Migrate each lesson in a transaction
  let migratedCount = 0;
  let progressUpdatedCount = 0;

  for (const lesson of lessons) {
    const oldId = lesson.id;
    const newId = generateStableId(lesson.phase, lesson.dayNumber);

    // Skip if already has stable ID
    if (oldId === newId) {
      console.log(`  ⏭️  ${newId} - Already stable`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      // 3a. Fetch all related data BEFORE deleting
      const segments = await tx.lessonSegment.findMany({
        where: { lessonId: oldId }
      });

      const quiz = await tx.quiz.findFirst({
        where: { lessonId: oldId },
        include: { QuizOption: true }
      });

      const progressRecords = await tx.userLessonProgress.findMany({
        where: { lessonId: oldId }
      });

      // 3b. Delete old lesson (cascades delete segments, quiz, progress)
      await tx.lesson.delete({
        where: { id: oldId }
      });

      // 3c. Create new lesson with stable ID
      const { id, ...lessonData } = lesson;

      // Update prerequisites to use stable IDs
      const updatedPrerequisites = (lesson.prerequisites || []).map(prereqId => {
        return idMapping[prereqId] || prereqId;
      });

      await tx.lesson.create({
        data: {
          ...lessonData,
          id: newId,
          prerequisites: updatedPrerequisites
        }
      });

      // 3d. Recreate all LessonSegments
      for (const segment of segments) {
        const { id: segId, lessonId, ...segmentData } = segment;
        await tx.lessonSegment.create({
          data: {
            ...segmentData,
            id: `${newId}-seg-${segment.order}`,
            lessonId: newId
          }
        });
      }

      // 3e. Recreate Quiz
      if (quiz) {
        const { id: quizId, lessonId, QuizOption, correctAnswer, ...quizData } = quiz;

        const newQuiz = await tx.quiz.create({
          data: {
            ...quizData,
            id: `${newId}-quiz`,
            lessonId: newId,
            correctAnswer: 'temp' // Will update after creating options
          }
        });

        // Recreate quiz options and track correct answer mapping
        let newCorrectAnswer = null;
        for (const option of QuizOption) {
          const { id: optId, quizId: oldQuizId, ...optionData } = option;
          const newOptionId = `${newId}-quiz-opt-${option.optionLabel}`;

          await tx.quizOption.create({
            data: {
              ...optionData,
              id: newOptionId,
              quizId: newQuiz.id
            }
          });

          if (optId === correctAnswer) {
            newCorrectAnswer = newOptionId;
          }
        }

        // Update correct answer
        if (newCorrectAnswer) {
          await tx.quiz.update({
            where: { id: newQuiz.id },
            data: { correctAnswer: newCorrectAnswer }
          });
        }
      }

      // 3f. Recreate UserLessonProgress records
      for (const progress of progressRecords) {
        const { id: progId, lessonId: oldLessonId, ...progressData } = progress;
        await tx.userLessonProgress.create({
          data: {
            ...progressData,
            id: `${progress.userId}-${newId}`,
            lessonId: newId
          }
        });

        progressUpdatedCount++;
      }

      migratedCount++;
      console.log(`  ✅ ${oldId} -> ${newId}`);
    }, { timeout: 30000 });
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Lessons migrated: ${migratedCount}`);
  console.log(`   ✅ Progress records updated: ${progressUpdatedCount}`);
  console.log('='.repeat(60));
  console.log('\n🎉 Migration completed successfully!');
  console.log('\nYou can now run the updated import-all-lessons.cjs script.');
}

main()
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
