const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSurveys() {
  try {
    const surveys = await prisma.childSnapshotSurvey.findMany({
      orderBy: { submittedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        userId: true,
        submittedAt: true,
        parentingStressLevel: true,
        totalScore: true,
        User: {
          select: {
            email: true,
            name: true
          }
        }
      }
    });

    console.log('\n=== Recent Child Snapshot Survey Submissions ===\n');

    if (surveys.length === 0) {
      console.log('No surveys found in database.');
    } else {
      console.log(`Found ${surveys.length} survey(s):\n`);
      surveys.forEach((survey, i) => {
        console.log(`${i + 1}. Survey ID: ${survey.id}`);
        console.log(`   User: ${survey.User.name} (${survey.User.email})`);
        console.log(`   Submitted: ${survey.submittedAt}`);
        console.log(`   Parenting Stress Level: ${survey.parentingStressLevel}/7`);
        console.log(`   Total Score: ${survey.totalScore}/70`);
        console.log('');
      });
    }

    // Get total count
    const total = await prisma.childSnapshotSurvey.count();
    console.log(`Total surveys in database: ${total}`);

  } catch (error) {
    console.error('Error checking surveys:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSurveys();
