/**
 * Rerun PCIT analysis for a session (skips transcription if already done, uses existing transcript)
 * Usage: node scripts/rerun-analysis.cjs <sessionId>
 */
require('dotenv').config();
const prisma = require('../server/services/db.cjs');
const { processRecordingWithRetry } = require('../server/services/processingService.cjs');

const SESSION_ID = process.argv[2];
if (!SESSION_ID) {
  console.error('Usage: node scripts/rerun-analysis.cjs <sessionId>');
  process.exit(1);
}

async function run() {
  const session = await prisma.session.findUnique({
    where: { id: SESSION_ID },
    select: { id: true, userId: true, storagePath: true, durationSeconds: true, analysisStatus: true, transcript: true, transcribedAt: true }
  });

  if (!session) {
    console.error('Session not found:', SESSION_ID);
    process.exit(1);
  }

  console.log(`Session: ${SESSION_ID}`);
  console.log(`Status: ${session.analysisStatus}`);
  console.log(`Transcript length: ${session.transcript?.length || 0} chars`);
  console.log(`transcribedAt: ${session.transcribedAt || 'not set'}`);

  if (!session.transcript) {
    console.error('No transcript found — run reprocess-session.cjs instead to re-transcribe from audio');
    process.exit(1);
  }

  if (!session.transcribedAt) {
    console.warn('⚠️  transcribedAt is not set — processRecordingWithRetry will attempt transcription again.');
    console.warn('   If you want to skip transcription, set transcribedAt manually or use reprocess-session.cjs.');
  }

  // Reset analysis state (keep transcript and transcribedAt intact to skip re-transcription)
  await prisma.session.update({
    where: { id: SESSION_ID },
    data: {
      analysisStatus: 'PENDING',
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
    }
  });

  console.log('\nRunning PCIT analysis...');
  await processRecordingWithRetry(SESSION_ID, session.userId, session.storagePath, session.durationSeconds, 0);
  console.log('\nDone.');

  await prisma.$disconnect();
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
