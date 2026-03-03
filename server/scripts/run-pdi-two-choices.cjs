'use strict';

/**
 * One-off script: run generatePDITwoChoicesAnalysis for a single session.
 * Usage: node server/scripts/run-pdi-two-choices.cjs <sessionId>
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const prisma = require('../services/db.cjs');
const { generatePDITwoChoicesAnalysis } = require('../services/pcitAnalysisService.cjs');
const { getUtterances } = require('../utils/utteranceUtils.cjs');

const sessionId = process.argv[2];
if (!sessionId) {
  console.error('Usage: node server/scripts/run-pdi-two-choices.cjs <sessionId>');
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

  const childName = session.User?.childName || 'the child';
  console.log(`Session: ${sessionId} | mode: ${session.mode} | child: ${childName}`);

  const utterances = await getUtterances(sessionId);
  console.log(`Utterances loaded: ${utterances.length}`);

  const result = await generatePDITwoChoicesAnalysis(utterances, childName);

  console.log('\n=== RESULT ===');
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
