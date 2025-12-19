const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const sessions = await prisma.session.findMany({
    where: {
      createdAt: {
        gt: new Date('2025-12-18T04:08:15Z') // After my test script
      }
    },
    orderBy: { createdAt: 'asc' },
    include: {
      Utterance: {
        orderBy: { order: 'asc' },
        take: 3
      }
    }
  });

  console.log(`\n📊 Found ${sessions.length} sessions AFTER test script:\n`);

  sessions.forEach((s, idx) => {
    console.log(`${'='.repeat(70)}`);
    console.log(`SESSION ${idx + 1}: ${s.id}`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Created: ${s.createdAt.toISOString()}`);
    console.log(`User ID: ${s.userId}`);
    console.log(`Mode: ${s.mode}`);
    console.log(`Storage: ${s.storagePath}`);

    console.log(`\n📝 Transcription:`);
    console.log(`  Transcript length: ${s.transcript?.length || 0} chars`);
    console.log(`  Transcribed at: ${s.transcribedAt || 'N/A'}`);
    console.log(`  Service: ${s.transcriptionService || 'N/A'}`);
    console.log(`  ElevenLabs JSON: ${s.elevenLabsJson ? 'Present' : 'Missing'}`);

    console.log(`\n📊 Utterances:`);
    const allUtterances = s.Utterance.length;
    const withRoles = s.Utterance.filter(u => u.role).length;
    const withTags = s.Utterance.filter(u => u.pcitTag).length;
    console.log(`  Total utterances: ${allUtterances}`);
    console.log(`  With roles: ${withRoles}/${allUtterances}`);
    console.log(`  With PCIT tags: ${withTags}/${allUtterances}`);

    console.log(`\n🏷️  Analysis Status:`);
    console.log(`  Role ID JSON: ${s.roleIdentificationJson ? 'Present' : 'Missing'}`);
    console.log(`  PCIT Coding: ${s.pcitCoding && Object.keys(s.pcitCoding).length > 0 ? 'Present' : 'Missing'}`);
    console.log(`  Tag Counts: ${s.tagCounts && Object.keys(s.tagCounts).length > 0 ? 'Present' : 'Missing'}`);
    console.log(`  Competency Analysis: ${s.competencyAnalysis && Object.keys(s.competencyAnalysis).length > 0 ? 'Present' : 'Missing'}`);
    console.log(`  Overall Score: ${s.overallScore || 'N/A'}`);

    if (s.Utterance.length > 0) {
      console.log(`\n📝 Sample Utterances (first 3):`);
      s.Utterance.slice(0, 3).forEach((u, i) => {
        console.log(`  ${i+1}. [${u.speaker}] ${u.role || 'NO_ROLE'} ${u.pcitTag || 'NO_TAG'}`);
        console.log(`     "${u.text.substring(0, 50)}..."`);
      });
    }

    console.log(`\n💡 Diagnosis:`);
    if (!s.transcript) {
      console.log(`  ❌ Transcription never completed`);
    } else if (allUtterances === 0) {
      console.log(`  ❌ Utterances never created in database`);
    } else if (withRoles === 0) {
      console.log(`  ❌ Role identification never ran`);
    } else if (withTags === 0) {
      console.log(`  ❌ PCIT coding never ran (roles present but no tags)`);
    } else if (!s.competencyAnalysis) {
      console.log(`  ❌ Competency analysis never ran (tags present but no analysis)`);
    } else {
      console.log(`  ✅ Full analysis completed successfully`);
    }

    console.log('');
  });

  await prisma.$disconnect();
})();
