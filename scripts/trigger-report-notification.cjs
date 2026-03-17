/**
 * Trigger a "report ready" push notification for a session (no LLM calls)
 * Usage: node scripts/trigger-report-notification.cjs <sessionId>
 */
require('dotenv').config();
const prisma = require('../server/services/db.cjs');
const { sendReportReadyNotification } = require('../server/services/pushNotifications.cjs');

const SESSION_ID = process.argv[2];
if (!SESSION_ID) {
  console.error('Usage: node scripts/trigger-report-notification.cjs <sessionId>');
  process.exit(1);
}

async function run() {
  const session = await prisma.session.findUnique({
    where: { id: SESSION_ID },
    select: { id: true, userId: true, mode: true }
  });

  if (!session) {
    console.error('Session not found:', SESSION_ID);
    process.exit(1);
  }

  const sessionType = session.mode === 'PDI' ? 'discipline session' : 'play session';
  const result = await sendReportReadyNotification(session.userId, SESSION_ID, sessionType);
  console.log('Result:', result);

  await prisma.$disconnect();
}

run().catch(console.error);
