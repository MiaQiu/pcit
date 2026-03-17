/**
 * Simulate processing state: set session to PROCESSING, then COMPLETED after 5 seconds
 * Usage: node scripts/simulate-processing.cjs <sessionId>
 */
require('dotenv').config();
const prisma = require('../server/services/db.cjs');

const SESSION_ID = process.argv[2];
if (!SESSION_ID) {
  console.error('Usage: node scripts/simulate-processing.cjs <sessionId>');
  process.exit(1);
}

async function run() {
  await prisma.session.update({
    where: { id: SESSION_ID },
    data: { analysisStatus: 'PROCESSING' }
  });
  console.log('Set to PROCESSING. Waiting 5 seconds...');

  await new Promise(resolve => setTimeout(resolve, 5000));

  await prisma.session.update({
    where: { id: SESSION_ID },
    data: { analysisStatus: 'COMPLETED' }
  });
  console.log('Set to COMPLETED.');

  await prisma.$disconnect();
}

run().catch(console.error);
