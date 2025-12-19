const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getLatest() {
  const session = await prisma.session.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      Utterance: {
        orderBy: { order: 'asc' },
        take: 5
      }
    }
  });

  if (!session) {
    console.log('No sessions found');
    return;
  }

  console.log('\n🔍 Latest Session Debug:\n');
  console.log(`ID: ${session.id}`);
  console.log(`Created: ${session.createdAt}`);
  console.log(`Mode: ${session.mode}`);
  console.log(`Transcript length: ${session.transcript?.length || 0}`);
  console.log(`Transcribed at: ${session.transcribedAt || 'N/A'}`);
  console.log(`Service: ${session.transcriptionService || 'N/A'}`);

  console.log(`\nUtterances: ${session.Utterance.length} total in DB`);

  const withRoles = session.Utterance.filter(u => u.role).length;
  const withTags = session.Utterance.filter(u => u.pcitTag).length;

  console.log(`  - With roles: ${withRoles}/${session.Utterance.length}`);
  console.log(`  - With tags: ${withTags}/${session.Utterance.length}`);

  console.log(`\nProcessing Status:`);
  console.log(`  ✓ Transcription: ${session.transcript ? 'DONE' : 'NOT DONE'}`);
  console.log(`  ${withRoles > 0 ? '✓' : '✗'} Role ID: ${withRoles > 0 ? 'DONE' : 'NOT DONE'}`);
  console.log(`  ${withTags > 0 ? '✓' : '✗'} PCIT Coding: ${withTags > 0 ? 'DONE' : 'NOT DONE'}`);
  console.log(`  ${session.competencyAnalysis ? '✓' : '✗'} Competency: ${session.competencyAnalysis ? 'DONE' : 'NOT DONE'}`);
  console.log(`  ${session.overallScore ? '✓' : '✗'} Overall Score: ${session.overallScore || 'NOT DONE'}`);

  if (session.Utterance.length > 0) {
    console.log('\n📝 Sample Utterances:');
    session.Utterance.forEach((u, idx) => {
      console.log(`  ${idx + 1}. [${u.speaker}] [${u.role || 'NO ROLE'}] [${u.pcitTag || 'NO TAG'}]`);
      console.log(`     "${u.text.substring(0, 60)}${u.text.length > 60 ? '...' : ''}"`);
    });
  }

  await prisma.$disconnect();
}

getLatest();
