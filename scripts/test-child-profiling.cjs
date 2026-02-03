/**
 * Test script: Process an audio file through the full pipeline
 * and display Phase 5 (Child Profiling) results.
 *
 * Usage: node scripts/test-child-profiling.cjs <audio-file-path> [user-id]
 */
require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');
const prisma = require('../server/services/db.cjs');
const storage = require('../server/services/storage-s3.cjs');
const { transcribeRecording } = require('../server/services/transcriptionService.cjs');
const { analyzePCITCoding } = require('../server/services/pcitAnalysisService.cjs');

const AUDIO_PATH = process.argv[2] || '/Users/yihui/Downloads/Anya_mama.m4a';
const USER_ID = process.argv[3] || '01a50a36-cd18-4311-ab2e-897d088dec02';

async function main() {
  console.log('='.repeat(80));
  console.log('TEST: Full Pipeline with Child Profiling (Phase 5)');
  console.log('='.repeat(80));
  console.log(`Audio: ${AUDIO_PATH}`);
  console.log(`User:  ${USER_ID}`);
  console.log('');

  // Verify file exists
  if (!fs.existsSync(AUDIO_PATH)) {
    console.error(`Audio file not found: ${AUDIO_PATH}`);
    process.exit(1);
  }
  const fileStats = fs.statSync(AUDIO_PATH);
  console.log(`File size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: USER_ID },
    select: { id: true, childName: true, childBirthYear: true, childGender: true, issue: true, childBirthday: true }
  });
  if (!user) {
    console.error(`User not found: ${USER_ID}`);
    process.exit(1);
  }
  console.log(`User found: childBirthYear=${user.childBirthYear}, gender=${user.childGender}, issue=${JSON.stringify(user.issue)}`);

  // Create session
  const sessionId = crypto.randomUUID();
  console.log(`\nCreating session: ${sessionId}`);

  await prisma.session.create({
    data: {
      id: sessionId,
      userId: USER_ID,
      mode: 'CDI',
      storagePath: 'test_pending',
      durationSeconds: 300,
      transcript: '',
      aiFeedbackJSON: {},
      pcitCoding: {},
      tagCounts: {},
      masteryAchieved: false,
      riskScore: 0,
      flaggedForReview: false,
      analysisStatus: 'PENDING'
    }
  });

  try {
    // Upload audio to S3
    console.log('\n--- Phase 1: Upload to S3 ---');
    const audioBuffer = fs.readFileSync(AUDIO_PATH);
    const storagePath = await storage.uploadAudioFile(audioBuffer, USER_ID, sessionId, 'audio/m4a');
    console.log(`Uploaded: ${storagePath}`);

    await prisma.session.update({
      where: { id: sessionId },
      data: { storagePath }
    });

    // Transcribe
    console.log('\n--- Phase 2: Transcription ---');
    await transcribeRecording(sessionId, USER_ID, storagePath, 300);
    console.log('Transcription complete');

    // Run full analysis (includes Phase 3-6)
    console.log('\n--- Phases 3-6: Analysis Pipeline ---');
    const result = await analyzePCITCoding(sessionId, USER_ID);

    // Mark as completed
    await prisma.session.update({
      where: { id: sessionId },
      data: { analysisStatus: 'COMPLETED' }
    });

    // Fetch child profiling results
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 5 RESULTS: Child Profiling');
    console.log('='.repeat(80));

    const childProfiling = await prisma.childProfiling.findUnique({
      where: { sessionId }
    });

    if (childProfiling) {
      console.log('\n--- Developmental Observation ---');
      console.log(`Summary: ${childProfiling.summary}`);
      console.log(`\nDomains (${Array.isArray(childProfiling.domains) ? childProfiling.domains.length : 0}):`);
      if (Array.isArray(childProfiling.domains)) {
        for (const domain of childProfiling.domains) {
          console.log(`\n  [${domain.category}] (${domain.framework})`);
          console.log(`    Status: ${domain.developmental_status}`);
          console.log(`    Level:  ${domain.current_level}`);
          console.log(`    Benchmark: ${domain.benchmark_for_age}`);
          if (domain.detailed_observations) {
            for (const obs of domain.detailed_observations) {
              console.log(`    - ${obs.insight}: ${obs.evidence}`);
            }
          }
        }
      }

      console.log('\n--- Session Metadata ---');
      console.log(JSON.stringify(childProfiling.metadata, null, 2));
    } else {
      console.log('No ChildProfiling record found (Gemini call may have been skipped)');
    }

    // Fetch coaching cards from session
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { coachingCards: true }
    });

    if (session?.coachingCards) {
      console.log('\n--- Coaching Cards ---');
      const cards = Array.isArray(session.coachingCards) ? session.coachingCards : [];
      for (const card of cards) {
        console.log(`\n  [Card ${card.card_id}] ${card.icon_suggestion || ''} ${card.title}`);
        console.log(`    Coaching tip: ${card.coaching_tip}`);
        if (card.scenario) {
          console.log(`    Scenario:`);
          console.log(`      Context: ${card.scenario.context}`);
          console.log(`      Instead of: ${card.scenario.instead_of}`);
          console.log(`      Try this: ${card.scenario.try_this}`);
        }
      }
    } else {
      console.log('\nNo coaching cards found on session');
    }

    // Print overall result summary
    console.log('\n' + '='.repeat(80));
    console.log('OVERALL RESULT SUMMARY');
    console.log('='.repeat(80));
    console.log(`Tag counts: ${JSON.stringify(result.tagCounts)}`);
    console.log(`Overall score: ${result.overallScore}`);
    console.log(`Child profiling present: ${!!result.childProfilingResult}`);
    console.log(`Session ID: ${sessionId}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);

    // Mark session as failed
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        analysisStatus: 'FAILED',
        analysisError: error.message
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}

main();
