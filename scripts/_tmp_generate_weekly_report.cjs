/**
 * One-off: generate + publish weekly report for a specific user + week.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const prisma = require('../server/services/db.cjs');
const { generateWeeklyReport } = require('../server/services/weeklyReportService.cjs');
const { sendPushNotificationToUser } = require('../server/services/pushNotifications.cjs');

const USER_ID = 'a2b72cba-bbc5-46c7-bb60-dbbb3597deed';
const WEEK_START = '2026-05-11'; // Monday May 11

async function main() {
  console.log(`Generating weekly report for user ${USER_ID}, week starting ${WEEK_START}`);

  const report = await generateWeeklyReport(USER_ID, WEEK_START);

  if (report.skipped) {
    console.log('Skipped:', report.reason);
    return;
  }

  console.log(`Report saved: ${report.id} (visibility: ${report.visibility})`);

  // Publish
  const wasAlreadyVisible = report.visibility;
  await prisma.weeklyReport.update({
    where: { id: report.id },
    data: { visibility: true },
  });
  console.log('Published (visibility: true)');

  // Send push notification if newly published
  if (!wasAlreadyVisible) {
    const result = await sendPushNotificationToUser(USER_ID, {
      title: 'Your Weekly Report is Ready!',
      body: 'Check out your progress for the week of Apr 28',
      sound: 'default',
      data: { type: 'weekly_report', reportId: report.id, timestamp: Date.now() },
    });
    console.log('Push notification:', result.success ? 'sent' : 'failed', result);
  } else {
    console.log('Already visible — push notification skipped');
  }

  console.log('Done. Report ID:', report.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
