/**
 * Reprocess a session end-to-end: transcription → PCIT analysis → report
 * Mirrors startBackgroundProcessing() in server/routes/recordings.cjs
 *
 * Usage: node scripts/reprocess-session.cjs <sessionId>
 */
require('dotenv').config();
const prisma = require('../server/services/db.cjs');
const { transcribeRecording } = require('../server/services/transcriptionService.cjs');
const { processRecordingWithRetry } = require('../server/services/processingService.cjs');

const SESSION_ID = process.argv[2];
if (!SESSION_ID) {
  console.error('Usage: node scripts/reprocess-session.cjs <sessionId>');
  process.exit(1);
}

async function run() {
  console.log('='.repeat(80));
  console.log(`🔄 Reprocessing session ${SESSION_ID}`);
  console.log('='.repeat(80));

  const session = await prisma.session.findUnique({
    where: { id: SESSION_ID },
    select: { id: true, userId: true, storagePath: true, durationSeconds: true, analysisStatus: true, mode: true }
  });

  if (!session) {
    console.error('❌ Session not found');
    process.exit(1);
  }

  console.log(`✅ Session found — mode: ${session.mode}, status: ${session.analysisStatus}`);
  console.log(`   storagePath: ${session.storagePath}`);
  console.log(`   duration: ${session.durationSeconds}s`);

  if (!session.storagePath) {
    console.error('❌ No storagePath — cannot re-transcribe');
    process.exit(1);
  }

  // Reset session state for clean reprocessing
  console.log('\n🧹 Resetting session state...');
  await prisma.session.update({
    where: { id: SESSION_ID },
    data: {
      analysisStatus: 'PENDING',
      transcript: '',
      roleIdentificationJson: null,
      pcitCoding: null,
      tagCounts: null,
      competencyAnalysis: null,
      overallScore: null,
      coachingSummary: null,
      coachingCards: null,
      aboutChild: null,
      milestoneCelebrations: null,
    }
  });
  console.log('✅ Session reset to PENDING');

  // Step 1: Transcription
  console.log('\n🎤 Step 1: Transcription...');
  const t1 = Date.now();
  await transcribeRecording(SESSION_ID, session.userId, session.storagePath, session.durationSeconds);
  console.log(`✅ Transcription complete (${((Date.now() - t1) / 1000).toFixed(1)}s)`);

  // Update status to PROCESSING
  await prisma.session.update({
    where: { id: SESSION_ID },
    data: { analysisStatus: 'PROCESSING' }
  });

  // Step 2: Full PCIT analysis (with retry logic)
  console.log('\n🧠 Step 2: PCIT Analysis (including aboutChild)...');
  const t2 = Date.now();
  await processRecordingWithRetry(SESSION_ID, session.userId, 0);
  console.log(`✅ Analysis complete (${((Date.now() - t2) / 1000).toFixed(1)}s)`);

  // Verify result
  const result = await prisma.session.findUnique({
    where: { id: SESSION_ID },
    select: { analysisStatus: true, overallScore: true, aboutChild: true }
  });

  console.log('\n' + '='.repeat(80));
  console.log(`✅ Done — status: ${result.analysisStatus}, score: ${result.overallScore}`);
  console.log(`   aboutChild items: ${result.aboutChild ? result.aboutChild.length : 0}`);
  if (result.aboutChild && result.aboutChild.length > 0) {
    console.log(`   First item: "${result.aboutChild[0].Title}" — ${result.aboutChild[0].Description}`);
  }
  console.log('='.repeat(80));

  await prisma.$disconnect();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
