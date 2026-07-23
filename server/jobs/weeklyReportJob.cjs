/**
 * Weekly Report Job
 *
 * Runs every Monday at 5:30pm SGT (09:30 UTC).
 * Generates reports for the week that just ended (previous Mon–Sun),
 * publishes them (visibility: true), and sends push notifications.
 */

const cron = require('node-cron');
const prisma = require('../services/db.cjs');
const { generateWeeklyReport } = require('../services/weeklyReportService.cjs');
const { sendPushNotificationToUser } = require('../services/pushNotifications.cjs');

const PUSH_STRINGS = {
  'en': {
    title: 'Your Weekly Report is Ready!',
    body: (weekLabel) => `Check out your progress for the week of ${weekLabel}`,
  },
  'zh-TW': {
    title: '您的週報已準備好了！',
    body: (weekLabel) => `查看您 ${weekLabel} 這週的進步`,
  },
  'zh-CN': {
    title: '您的周报已准备好了！',
    body: (weekLabel) => `查看您 ${weekLabel} 这周的进步`,
  },
};

/**
 * Returns the Monday 00:00:00 UTC for the week that ended last Sunday.
 * e.g. if called on Mon 2026-03-30, returns Mon 2026-03-23.
 */
function getPreviousWeekStart() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun ... 1=Mon
  // Days since the Monday that started last week
  const daysBack = day === 0 ? 13 : day + 6;
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - daysBack);
  weekStart.setUTCHours(0, 0, 0, 0);
  return weekStart;
}

async function runWeeklyReportJob() {
  console.log('[WeeklyReportJob] Starting weekly report generation + publish');

  const weekStart = getPreviousWeekStart();
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  console.log(`[WeeklyReportJob] Week: ${weekStart.toISOString()} → ${weekEnd.toISOString()}`);

  // Find all users with completed sessions in the week
  const sessions = await prisma.session.findMany({
    where: {
      analysisStatus: 'COMPLETED',
      overallScore: { not: null },
      createdAt: { gte: weekStart, lte: weekEnd },
    },
    select: { userId: true },
    distinct: ['userId'],
  });

  const userIds = sessions.map(s => s.userId);
  console.log(`[WeeklyReportJob] ${userIds.length} users to process`);

  let generated = 0, skipped = 0, failed = 0, notified = 0;

  for (const userId of userIds) {
    try {
      // Generate (or re-generate) the report
      const report = await generateWeeklyReport(userId, weekStart.toISOString());

      if (report.skipped) {
        skipped++;
        continue;
      }

      // Publish: set visibility + send push notification
      const wasAlreadyVisible = report.visibility;
      await prisma.weeklyReport.update({
        where: { id: report.id },
        data: { visibility: true },
      });

      generated++;

      // Only notify if this is the first time it's being published
      if (!wasAlreadyVisible) {
        const userRow = await prisma.user.findUnique({ where: { id: userId }, select: { preferredLocale: true } });
        const locale = userRow?.preferredLocale || 'en';
        const strings = PUSH_STRINGS[locale] || PUSH_STRINGS['en'];
        const dateLocale = (locale === 'zh-TW' || locale === 'zh-CN') ? locale : 'en-US';
        const weekLabel = weekStart.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
        const result = await sendPushNotificationToUser(userId, {
          title: strings.title,
          body: strings.body(weekLabel),
          sound: 'default',
          data: {
            type: 'weekly_report',
            reportId: report.id,
            timestamp: Date.now(),
          },
        });
        if (result.success) notified++;
      }
    } catch (err) {
      failed++;
      console.error(`[WeeklyReportJob] Failed for user ${userId}:`, err.message);
    }
  }

  console.log(`[WeeklyReportJob] Done — generated: ${generated}, skipped: ${skipped}, failed: ${failed}, notified: ${notified}`);
}

function scheduleWeeklyReportJob() {
  // Every Monday at 09:30 UTC = 5:30pm SGT
  cron.schedule('30 9 * * 1', () => {
    runWeeklyReportJob().catch(err => {
      console.error('[WeeklyReportJob] Unhandled error:', err);
    });
  }, {
    timezone: 'UTC',
  });

  console.log('[WeeklyReportJob] Scheduled: every Monday 09:30 UTC (5:30pm SGT)');
}

module.exports = { scheduleWeeklyReportJob, runWeeklyReportJob };
