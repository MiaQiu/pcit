/**
 * fix-quiz-correct-answers.cjs
 *
 * One-off migration: normalise Quiz.correctAnswer to the canonical full option ID
 * format (e.g. "FOUNDATION-1-quiz-opt-B") for any rows that were saved as bare
 * letters ("A"/"B"/"C"/"D") by the admin portal before the server-side fix.
 *
 * Safe to run multiple times – rows already in the correct format are skipped.
 */

'use strict';

const prisma = require('../server/services/db.cjs');

async function main() {
  const quizzes = await prisma.quiz.findMany({
    select: { id: true, lessonId: true, correctAnswer: true }
  });

  let fixed = 0;
  let skipped = 0;

  for (const quiz of quizzes) {
    if (/^[A-D]$/.test(quiz.correctAnswer)) {
      const newAnswer = `${quiz.lessonId}-quiz-opt-${quiz.correctAnswer}`;
      await prisma.quiz.update({
        where: { id: quiz.id },
        data: { correctAnswer: newAnswer }
      });
      console.log(`  fixed  ${quiz.id}: "${quiz.correctAnswer}" → "${newAnswer}"`);
      fixed++;
    } else {
      skipped++;
    }
  }

  console.log(`\nDone. Fixed: ${fixed}, already correct: ${skipped}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
