/**
 * Reprocess a session end-to-end: transcription → PCIT analysis → report
 * Mirrors startBackgroundProcessing() in server/routes/recordings.cjs
 *
 * Usage: node scripts/reprocess-session.cjs <sessionId>
 */
require('dotenv').config();
const prisma = require('../server/services/db.cjs');
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
      transcribedAt: null,
      roleIdentificationJson: null,
      roleIdDone: false,
      pcitCoding: null,
      pcitCodingDone: false,
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

  // Full pipeline (transcription + PCIT analysis) with retry logic
  console.log('\n🧠 Running full pipeline (transcription + analysis)...');
  const t = Date.now();
  await processRecordingWithRetry(SESSION_ID, session.userId, session.storagePath, session.durationSeconds, 0);
  console.log(`✅ Pipeline complete (${((Date.now() - t) / 1000).toFixed(1)}s)`);

  // Verify result
  const result = await prisma.session.findUnique({
    where: { id: SESSION_ID },
    select: { analysisStatus: true, enrichmentStatus: true, overallScore: true, aboutChild: true }
  });

  console.log('\n' + '='.repeat(80));
  console.log(`✅ Done — status: ${result.analysisStatus}, enrichment: ${result.enrichmentStatus}, score: ${result.overallScore}`);
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
