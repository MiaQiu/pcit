const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugSession() {
  const sessionId = '7914e3cb-b3d6-42f8-8b12-cd5d2ec31adc'; // The failed session

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      Utterance: {
        orderBy: { order: 'asc' },
        take: 10
      }
    }
  });

  if (!session) {
    console.log('Session not found');
    return;
  }

  console.log('\n🔍 Session Debug Info:\n');
  console.log(`ID: ${session.id}`);
  console.log(`User: ${session.userId}`);
  console.log(`Mode: ${session.mode}`);
  console.log(`Created: ${session.createdAt}`);
  console.log(`Transcript: ${session.transcript ? 'Yes (' + session.transcript.length + ' chars)' : 'No'}`);
  console.log(`Transcribed At: ${session.transcribedAt || 'N/A'}`);
  console.log(`Service: ${session.transcriptionService || 'N/A'}`);
  console.log(`Storage Path: ${session.storagePath}`);

  console.log(`\nUtterances: ${session.Utterance.length} total`);

  // Check utterance states
  const withRoles = session.Utterance.filter(u => u.role).length;
  const withTags = session.Utterance.filter(u => u.pcitTag).length;

  console.log(`  - With roles: ${withRoles}`);
  console.log(`  - With tags: ${withTags}`);

  console.log(`\nRole Identification JSON: ${session.roleIdentificationJson ? 'Yes' : 'No'}`);
  console.log(`PCIT Coding: ${session.pcitCoding ? Object.keys(session.pcitCoding).length > 0 ? 'Yes' : 'Empty' : 'No'}`);
  console.log(`Tag Counts: ${session.tagCounts ? Object.keys(session.tagCounts).length > 0 ? 'Yes' : 'Empty' : 'No'}`);
  console.log(`Competency Analysis: ${session.competencyAnalysis ? Object.keys(session.competencyAnalysis).length > 0 ? 'Yes' : 'Empty' : 'No'}`);
  console.log(`Overall Score: ${session.overallScore || 'N/A'}`);

  console.log('\n📝 First 5 utterances:');
  session.Utterance.slice(0, 5).forEach((u, idx) => {
    console.log(`\n${idx + 1}. Speaker: ${u.speaker}, Role: ${u.role || 'NOT SET'}`);
    console.log(`   Tag: ${u.pcitTag || 'NOT SET'}`);
    console.log(`   Text: "${u.text}"`);
  });

  console.log('\n\n💡 Diagnosis:');
  if (session.transcript && !withRoles) {
    console.log('⚠️  Transcription completed, but role identification not started or failed');
  } else if (withRoles && !withTags) {
    console.log('⚠️  Role identification completed, but PCIT coding not started or failed');
  } else if (withTags && !session.competencyAnalysis) {
    console.log('⚠️  PCIT coding completed, but competency analysis not started or failed');
  } else if (!session.transcript) {
    console.log('⚠️  Transcription not completed');
  }

  await prisma.$disconnect();
}

debugSession();
