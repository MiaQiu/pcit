'use strict';

/**
 * One-off script: run generateReportHighlights for a single session, using its
 * already-stored coaching narrative (coachingSummary for CDI, pdiSummary for PDI)
 * and its already-identified top-moment quote.
 * Usage: DATABASE_URL="..." node server/scripts/run-report-highlights.cjs <sessionId>
 */

// Allow DATABASE_URL override via env before dotenv loads
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const prisma = require('../services/db.cjs');
const { generateReportHighlights } = require('../services/pcitAnalysisService.cjs');
const { decryptSensitiveData } = require('../utils/encryption.cjs');

const sessionId = process.argv[2];
if (!sessionId) {
  console.error('Usage: DATABASE_URL="..." node server/scripts/run-report-highlights.cjs <sessionId>');
  process.exit(1);
}

async function main() {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { User: true },
  });

  if (!session) {
    console.error(`Session ${sessionId} not found`);
    process.exit(1);
  }

  const user = session.User;
  const childName = user?.childName ? decryptSensitiveData(user.childName) : 'the child';

  const coachingNarrativeText = session.coachingSummary || session.competencyAnalysis?.pdiSummary || null;
  const topMomentQuote = session.competencyAnalysis?.topMoment || null;
  const counts = session.tagCounts || {};

  console.log(`Session: ${sessionId} | mode: ${session.mode} | child: ${childName}`);
  console.log(`Coaching narrative source: ${session.coachingSummary ? 'coachingSummary' : (session.competencyAnalysis?.pdiSummary ? 'pdiSummary' : 'NONE')}`);
  console.log(`Narrative length: ${coachingNarrativeText?.length || 0} chars`);
  console.log(`Top moment quote: ${topMomentQuote ? `"${topMomentQuote}"` : 'NONE'}\n`);

  if (!coachingNarrativeText) {
    console.error('No coaching narrative available for this session — nothing to extract from.');
    process.exit(1);
  }

  const result = await generateReportHighlights(coachingNarrativeText, topMomentQuote, counts, childName, sessionId);

  console.log('\n=== REPORT HIGHLIGHTS RESULT ===');
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
