/**
 * One-off script: re-run end-to-end LLM analysis for an existing session.
 * Skips ElevenLabs transcription (utterances already in DB).
 * Resets analysis checkpoints so all LLM calls run fresh.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const prisma = require('../server/services/db.cjs');
const { analyzePCITCoding } = require('../server/services/pcitAnalysisService.cjs');

const SESSION_ID = 'cc33ca75-bf86-4442-99bb-94aba42b6173';

async function main() {
  // Fetch session to get userId and confirm it exists
  const session = await prisma.session.findUnique({
    where: { id: SESSION_ID },
    select: { id: true, userId: true, analysisStatus: true, transcribedAt: true, elevenLabsJson: true }
  });

  if (!session) throw new Error(`Session ${SESSION_ID} not found`);
  if (!session.transcribedAt) throw new Error('Session has not been transcribed yet — run ElevenLabs first');

  const languageCode = session.elevenLabsJson?.language_code;
  console.log(`Session found. Status: ${session.analysisStatus}, Language: ${languageCode || 'unknown'}`);

  // Reset analysis checkpoints so all LLM steps run fresh
  await prisma.session.update({
    where: { id: SESSION_ID },
    data: {
      analysisStatus: 'PROCESSING',
      roleIdDone: false,
      pcitCodingDone: false,
      roleIdentificationJson: null,
      pcitCoding: null,
      tagCounts: null,
      competencyAnalysis: null,
      overallScore: null,
      coachingSummary: null,
      coachingCards: null,
      aboutChild: null,
      enrichmentError: null,
    }
  });
  console.log('Checkpoints reset. Starting analysis...\n');

  await analyzePCITCoding(SESSION_ID, session.userId);

  await prisma.session.update({
    where: { id: SESSION_ID },
    data: { analysisStatus: 'COMPLETED' }
  });

  console.log('\n✅ Analysis complete. Session marked COMPLETED.');
}

main()
  .catch(e => { console.error('❌ Fatal error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
