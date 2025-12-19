const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const sessions = await prisma.session.findMany({
    where: {
      createdAt: {
        lt: new Date('2025-12-18T04:08:00Z') // Before my test
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      createdAt: true,
      userId: true,
      overallScore: true,
      competencyAnalysis: true,
      aiFeedbackJSON: true,
      _count: { select: { Utterance: true } }
    }
  });

  console.log('📊 Sessions BEFORE my test script:\n');
  sessions.forEach(s => {
    const userId = s.userId.substring(0, 20);
    const isTestUser = userId.includes('test');
    const hasAiFeedbackUtterances = s.aiFeedbackJSON?.utterances?.length || 0;

    console.log(`${s.createdAt.toISOString()}`);
    console.log(`  Score: ${s.overallScore || 'N/A'}`);
    console.log(`  Has Comp Analysis: ${!!s.competencyAnalysis}`);
    console.log(`  Utterances in table: ${s._count.Utterance}`);
    console.log(`  Utterances in JSON: ${hasAiFeedbackUtterances}`);
    console.log(`  User type: ${isTestUser ? 'TEST' : 'REAL'}`);
    console.log('');
  });

  await prisma.$disconnect();
})();
