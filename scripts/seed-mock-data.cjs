const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Function to generate random number in range
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.random() * (max - min) + min;

// Function to get date N days ago
const getDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

async function seedMockData() {
  try {
    console.log('🌱 Starting mock data generation...\n');

    // Get or create Demo User
    let user = await prisma.user.findFirst({
      where: { email: 'demo@happypillar.com' }
    });

    if (!user) {
      console.log('Creating Demo User...');
      user = await prisma.user.create({
        data: {
          email: 'demo@happypillar.com',
          passwordHash: '$2b$10$fake.hash.for.demo.only',
          name: 'Demo Parent',
          childName: 'Demo Child'
        }
      });
      console.log(`✓ Created user: ${user.email}\n`);
    } else {
      console.log(`✓ Using existing user: ${user.email}\n`);
    }

    // Generate sessions over past 2 weeks (14 days)
    const sessions = [];
    let sessionCount = 0;

    for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
      // Generate 1-2 sessions per day
      const sessionsPerDay = randomInt(0, 2);

      for (let i = 0; i < sessionsPerDay; i++) {
        const mode = Math.random() > 0.5 ? 'CDI' : 'PDI';
        const createdAt = getDaysAgo(daysAgo);

        if (mode === 'CDI') {
          // CDI Session
          const praise = randomInt(5, 25);
          const reflect = randomInt(5, 20);
          const imitate = randomInt(2, 15);
          const describe = randomInt(8, 22);
          const command = randomInt(0, 8);
          const question = randomInt(0, 10);
          const criticism = randomInt(0, 5);

          const session = {
            userId: user.id,
            mode,
            storagePath: `mock/audio/${Date.now()}_${i}.wav`,
            durationSeconds: randomInt(180, 420),
            transcript: 'Mock CDI session transcript',
            aiFeedbackJSON: { analysis: 'Mock CDI analysis' },
            pcitCoding: 'Mock CDI coding',
            tagCounts: {
              praise,
              reflect,
              imitate,
              describe,
              command,
              question,
              criticism,
              neutral: randomInt(5, 15),
              totalPride: praise + reflect + imitate + describe,
              totalAvoid: command + question + criticism
            },
            childMetrics: {
              utteranceRate: randomFloat(8, 20),
              speechDuration: randomInt(120, 300),
              reflectionRate: randomInt(2, 12)
            },
            masteryAchieved: false,
            riskScore: 0,
            flaggedForReview: false,
            coachAlertSent: false,
            createdAt
          };

          sessions.push(session);
          sessionCount++;
        } else {
          // PDI Session
          const directCommand = randomInt(8, 25);
          const indirectCommand = randomInt(0, 8);
          const correctTimeout = randomInt(1, 5);
          const labeledPraise = randomInt(5, 15);

          const totalCommands = directCommand + indirectCommand;
          const effectivePercent = totalCommands > 0
            ? Math.round((directCommand / totalCommands) * 100)
            : 0;

          const complianceRate = randomFloat(60, 95);
          const positiveResponses = randomInt(6, 18);
          const negativeResponses = randomInt(0, 5);

          const session = {
            userId: user.id,
            mode,
            storagePath: `mock/audio/${Date.now()}_${i}.wav`,
            durationSeconds: randomInt(180, 420),
            transcript: 'Mock PDI session transcript',
            aiFeedbackJSON: { analysis: 'Mock PDI analysis' },
            pcitCoding: 'Mock PDI coding',
            tagCounts: {
              direct_command: directCommand,
              indirect_command: indirectCommand,
              positive_command: randomInt(8, 20),
              specific_command: randomInt(8, 20),
              labeled_praise: labeledPraise,
              correct_warning: randomInt(1, 4),
              correct_timeout: correctTimeout,
              negative_command: randomInt(0, 5),
              vague_command: randomInt(0, 5),
              chained_command: randomInt(0, 3),
              harsh_tone: randomInt(0, 3),
              neutral: randomInt(5, 15),
              totalEffective: directCommand + labeledPraise + correctTimeout,
              totalIneffective: indirectCommand,
              effectivePercent
            },
            childMetrics: {
              complianceRate,
              positiveResponses,
              negativeResponses,
              deescalationTime: randomInt(20, 90)
            },
            masteryAchieved: false,
            riskScore: 0,
            flaggedForReview: false,
            coachAlertSent: false,
            createdAt
          };

          sessions.push(session);
          sessionCount++;
        }
      }
    }

    console.log(`Generated ${sessionCount} mock sessions\n`);

    // Insert all sessions
    console.log('Inserting sessions into database...');
    for (const session of sessions) {
      await prisma.session.create({ data: session });
    }

    console.log(`✓ Successfully created ${sessionCount} mock sessions!\n`);

    // Show summary
    const cdiCount = sessions.filter(s => s.mode === 'CDI').length;
    const pdiCount = sessions.filter(s => s.mode === 'PDI').length;

    console.log('📊 Summary:');
    console.log(`   CDI Sessions: ${cdiCount}`);
    console.log(`   PDI Sessions: ${pdiCount}`);
    console.log(`   Total: ${sessionCount}`);
    console.log(`   User: ${user.email}`);
    console.log('\n✨ Mock data generation complete!');

  } catch (error) {
    console.error('❌ Error generating mock data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedMockData()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
