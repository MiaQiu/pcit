/**
 * Test run of generateCrisis (hero text + crisis-moment coaching) for a
 * specific session using the current pipeline. Read-only — prints the
 * result, does not write anything back to the DB.
 *
 * Usage:
 *   DATABASE_URL="postgresql://nora_admin:<pwd>@localhost:5433/nora" \
 *   node scripts/test-crisis-coaching.cjs <sessionId>
 */
require('dotenv').config();

const prisma = require('../server/services/db.cjs');
const { getUtterances } = require('../server/utils/utteranceUtils.cjs');
const { generateCrisis } = require('../server/services/pcitAnalysisService.cjs');
const { decryptSensitiveData } = require('../server/utils/encryption.cjs');

const SESSION_ID = process.argv[2];
if (!SESSION_ID) {
  console.error('Usage: node scripts/test-crisis-coaching.cjs <sessionId>');
  process.exit(1);
}

async function main() {
  console.log(`Test run of generateCrisis for session: ${SESSION_ID}\n`);

  const session = await prisma.session.findUnique({ where: { id: SESSION_ID } });
  if (!session) throw new Error(`Session ${SESSION_ID} not found`);
  console.log(`Session: mode=${session.mode}, status=${session.analysisStatus}`);

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  const childName = user?.childName ? decryptSensitiveData(user.childName) : 'the child';

  const isCDI = session.mode === 'CDI';
  const coachingText = isCDI
    ? session.coachingSummary
    : session.competencyAnalysis?.pdiSummary;
  console.log(`Child: ${childName}`);
  console.log(`coachingText present: ${!!coachingText} (source: ${isCDI ? 'coachingSummary' : 'competencyAnalysis.pdiSummary'})`);

  const utterances = await getUtterances(SESSION_ID);
  console.log(`Utterances: ${utterances.length}`);

  const language = session.elevenLabsJson?.language_code || null;
  console.log(`language: ${language || 'null (defaults to English)'}\n`);

  console.log('--- Running generateCrisis ---\n');
  const result = await generateCrisis(utterances, coachingText, childName, null, SESSION_ID, language);

  console.log('\n' + '='.repeat(80));
  console.log('CRISIS COACHING RESULT');
  console.log('='.repeat(80));
  console.log(JSON.stringify(result, null, 2));
  console.log('='.repeat(80));

  await prisma.$disconnect();
}

main().catch(async err => {
  console.error('Fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
