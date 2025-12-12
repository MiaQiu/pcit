require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyLessons() {
  try {
    console.log('🔍 Verifying Day 1 and Day 2 lessons...\n');

    const day1 = await prisma.lesson.findFirst({
      where: {
        phase: 'CONNECT',
        dayNumber: 1
      },
      include: {
        segments: {
          orderBy: { order: 'asc' }
        },
        quiz: {
          include: {
            options: {
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    });

    const day2 = await prisma.lesson.findFirst({
      where: {
        phase: 'CONNECT',
        dayNumber: 2
      },
      include: {
        segments: {
          orderBy: { order: 'asc' }
        },
        quiz: {
          include: {
            options: {
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    });

    console.log('DAY 1 LESSON:');
    console.log('─'.repeat(60));
    console.log(`Title: ${day1.title}`);
    console.log(`Description: ${day1.shortDescription}`);
    console.log(`Segments: ${day1.segments.length}`);
    console.log('\nSegments:');
    day1.segments.forEach(seg => {
      console.log(`  ${seg.order}. ${seg.sectionTitle} (${seg.contentType})`);
    });
    console.log(`\nQuiz: ${day1.quiz.question}`);
    console.log('Options:');
    day1.quiz.options.forEach(opt => {
      const isCorrect = opt.id === day1.quiz.correctAnswer ? '✓' : ' ';
      console.log(`  [${isCorrect}] ${opt.optionLabel}. ${opt.optionText}`);
    });

    console.log('\n\nDAY 2 LESSON:');
    console.log('─'.repeat(60));
    console.log(`Title: ${day2.title}`);
    console.log(`Description: ${day2.shortDescription}`);
    console.log(`Segments: ${day2.segments.length}`);
    console.log('\nSegments:');
    day2.segments.forEach(seg => {
      console.log(`  ${seg.order}. ${seg.sectionTitle} (${seg.contentType})`);
    });
    console.log(`\nQuiz: ${day2.quiz.question}`);
    console.log('Options:');
    day2.quiz.options.forEach(opt => {
      const isCorrect = opt.id === day2.quiz.correctAnswer ? '✓' : ' ';
      console.log(`  [${isCorrect}] ${opt.optionLabel}. ${opt.optionText}`);
    });

    console.log('\n✅ Verification complete!');

  } catch (error) {
    console.error('❌ Error verifying lessons:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verifyLessons()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
