/**
 * Simulate report completion for testing notifications/toast.
 * Runs only the quality check (1 cheap LLM call), then marks COMPLETED + sends push.
 * Usage: node scripts/simulate-completion.cjs <sessionId>
 */
require('dotenv').config();
const prisma = require('../server/services/db.cjs');
const { sendReportReadyNotification } = require('../server/services/pushNotifications.cjs');

const SESSION_ID = process.argv[2];
if (!SESSION_ID) {
  console.error('Usage: node scripts/simulate-completion.cjs <sessionId>');
  process.exit(1);
}

async function run() {
  const session = await prisma.session.findUnique({
    where: { id: SESSION_ID },
    select: { id: true, userId: true, mode: true, analysisStatus: true }
  });

  if (!session) {
    console.error('Session not found:', SESSION_ID);
    process.exit(1);
  }

  console.log(`Session: ${SESSION_ID}, status: ${session.analysisStatus}`);

  // Set to PROCESSING so the app's polling/AppState check can detect the transition
  await prisma.session.update({
    where: { id: SESSION_ID },
    data: { analysisStatus: 'PROCESSING' }
  });
  console.log('Set to PROCESSING. Waiting 5 seconds...');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Mark as COMPLETED
  await prisma.session.update({
    where: { id: SESSION_ID },
    data: { analysisStatus: 'COMPLETED' }
  });
  console.log('Set to COMPLETED.');

  // Send push notification
  const sessionType = session.mode === 'PDI' ? 'discipline session' : 'play session';
  const result = await sendReportReadyNotification(session.userId, SESSION_ID, sessionType);
  console.log('Push notification result:', result);

  await prisma.$disconnect();
}

run().catch(console.error);
