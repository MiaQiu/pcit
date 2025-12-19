const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSession() {
  const sessions = await prisma.session.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: {
      id: true,
      createdAt: true,
      overallScore: true,
      competencyAnalysis: true,
      tagCounts: true,
      pcitCoding: true,
      _count: {
        select: { Utterance: true }
      }
    }
  });

  console.log('\n📊 Recent Sessions:\n');
  sessions.forEach((s, idx) => {
    console.log(`${idx + 1}. Session: ${s.id.substring(0, 8)}...`);
    console.log(`   Created: ${s.createdAt.toISOString()}`);
    console.log(`   Utterances: ${s._count.Utterance}`);
    console.log(`   Overall Score: ${s.overallScore || 'N/A'}`);
    console.log(`   Has PCIT Coding: ${!!s.pcitCoding && Object.keys(s.pcitCoding).length > 0}`);
    console.log(`   Has Competency Analysis: ${!!s.competencyAnalysis && Object.keys(s.competencyAnalysis).length > 0}`);
    if (s.competencyAnalysis) {
      console.log(`   - Top Moment: ${s.competencyAnalysis.topMoment?.substring(0, 50)}...`);
      console.log(`   - Tips: ${s.competencyAnalysis.tips?.substring(0, 50)}...`);
    }
    console.log('');
  });

  await prisma.$disconnect();
}

checkSession();
