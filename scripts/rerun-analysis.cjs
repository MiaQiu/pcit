/**
 * Rerun PCIT analysis for a session (skips transcription, uses existing transcript)
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
    select: { id: true, userId: true, analysisStatus: true, transcript: true }
  });

  if (!session) {
    console.error('Session not found:', SESSION_ID);
    process.exit(1);
  }

  console.log(`Session: ${SESSION_ID}`);
  console.log(`Status: ${session.analysisStatus}`);
  console.log(`Transcript length: ${session.transcript?.length || 0} chars`);

  if (!session.transcript) {
    console.error('No transcript found — run reprocess-session.cjs instead');
    process.exit(1);
  }

  // Reset to PROCESSING so it can be re-analyzed
  await prisma.session.update({
    where: { id: SESSION_ID },
    data: { analysisStatus: 'PROCESSING' }
  });

  console.log('\nRunning PCIT analysis...');
  await processRecordingWithRetry(SESSION_ID, session.userId, 0);
  console.log('\nDone.');

  await prisma.$disconnect();
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
