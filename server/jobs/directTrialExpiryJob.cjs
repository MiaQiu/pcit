'use strict';

const cron = require('node-cron');
const prisma = require('../services/db.cjs');

// Marks ended "direct" trials as EXPIRED. These are the card-free trials granted at
// signup for campaign/partner links with skipSubscription (see POST /api/auth/signup).
// Nothing else ever updates them — unlike Stripe/RevenueCat trials, no webhook fires
// when they end — so without this they'd sit at TRIAL forever. Access is unaffected
// either way (isSubscribed checks subscriptionEndDate); this only keeps the status
// accurate for admin views and reporting.
//
// Stripe/RevenueCat webhooks set subscriptionSource to 'stripe'/'revenuecat', so
// filtering on 'partner'/'referral' never touches a store-managed subscription.

async function runDirectTrialExpiryJob() {
  console.log('[DirectTrialExpiryJob] Starting');

  const result = await prisma.user.updateMany({
    where: {
      subscriptionStatus: 'TRIAL',
      subscriptionSource: { in: ['partner', 'referral'] },
      stripeSubscriptionId: null,
      subscriptionEndDate: { lt: new Date() },
    },
    data: { subscriptionStatus: 'EXPIRED' },
  });

  console.log(`[DirectTrialExpiryJob] Expired ${result.count} ended direct trial(s)`);
  return result.count;
}

function scheduleDirectTrialExpiryJob() {
  // Run daily at 03:15 UTC (11:15am SGT)
  cron.schedule('15 3 * * *', async () => {
    try {
      await runDirectTrialExpiryJob();
    } catch (err) {
      console.error('[DirectTrialExpiryJob] Error:', err);
    }
  }, { timezone: 'UTC' });

  console.log('[DirectTrialExpiryJob] Scheduled — runs daily at 03:15 UTC');
}

module.exports = { scheduleDirectTrialExpiryJob, runDirectTrialExpiryJob };
