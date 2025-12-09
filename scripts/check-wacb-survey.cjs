const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSurveys() {
  try {
    const surveys = await prisma.wacbSurvey.findMany({
      orderBy: { submittedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        userId: true,
        submittedAt: true,
        parentingStressLevel: true,
        totalScore: true,
        totalChangesNeeded: true,
        User: {
          select: {
            email: true,
            name: true
          }
        }
      }
    });

    console.log('\n=== Recent WACB Survey Submissions ===\n');

    if (surveys.length === 0) {
      console.log('No surveys found in database.');
    } else {
      console.log(`Found ${surveys.length} survey(s):\n`);
      surveys.forEach((survey, i) => {
        console.log(`${i + 1}. Survey ID: ${survey.id}`);
        console.log(`   User: ${survey.User.name} (${survey.User.email})`);
        console.log(`   Submitted: ${survey.submittedAt}`);
        console.log(`   Parenting Stress Level: ${survey.parentingStressLevel}/7`);
        console.log(`   Total Score: ${survey.totalScore}/63`);
        console.log(`   Changes Needed: ${survey.totalChangesNeeded}/9`);
        console.log('');
      });
    }

    // Get total count
    const total = await prisma.wacbSurvey.count();
    console.log(`Total surveys in database: ${total}`);

  } catch (error) {
    console.error('Error checking surveys:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSurveys();
