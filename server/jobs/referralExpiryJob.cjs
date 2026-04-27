'use strict';

const cron = require('node-cron');
const prisma = require('../services/db.cjs');

const EXPIRY_DAYS = 90;

async function runReferralExpiryJob() {
  console.log('[ReferralExpiryJob] Starting');

  const cutoff = new Date(Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const result = await prisma.referral.updateMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: cutoff },
    },
    data: { status: 'EXPIRED' },
  });

  console.log(`[ReferralExpiryJob] Expired ${result.count} stale referral(s)`);
  return result.count;
}

function scheduleReferralExpiryJob() {
  // Run daily at 03:00 UTC (11:00am SGT)
  cron.schedule('0 3 * * *', async () => {
    try {
      await runReferralExpiryJob();
    } catch (err) {
      console.error('[ReferralExpiryJob] Error:', err);
    }
  }, { timezone: 'UTC' });

  console.log('[ReferralExpiryJob] Scheduled — runs daily at 03:00 UTC');
}

module.exports = { scheduleReferralExpiryJob, runReferralExpiryJob };
