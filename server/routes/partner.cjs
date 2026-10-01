const express = require('express');
const prisma = require('../services/db.cjs');
const { discountLabel, normalizeDiscounts } = require('../utils/partnerDiscount.cjs');
const { publicDisplayName } = require('../utils/partnerLanding.cjs');
const { resolveDragonImageUrl } = require('../services/storage-s3.cjs');
const { logError } = require('../utils/errorLogger.cjs');

const router = express.Router();

function planDiscountInfo(discount) {
  if (!discount) return null;
  return {
    label: discountLabel(discount),
    percentOff: discount.percentOff ?? null,
    amountOff: discount.amountOff ?? null, // cents, matches Stripe convention
  };
}

// Public signup-screen copy. imageKey is swapped for a presigned imageUrl
// (valid 1h — the web app falls back to its default image if it has expired).
async function publicLanding(landing) {
  if (!landing) return null;
  const { imageKey, ...text } = landing;
  return { ...text, imageUrl: imageKey ? await resolveDragonImageUrl(imageKey) : null };
}

// GET /api/partner/validate/:slug
// Public — called by web SPA when user lands on /p/:slug (and /join/:code for the
// reserved referral partner). Each successful call counts as a visit.
router.get('/validate/:slug', async (req, res) => {
  try {
    const partner = await prisma.partner.findUnique({ where: { slug: req.params.slug } });

    if (!partner || partner.status !== 'ACTIVE') {
      return res.status(404).json({ error: 'Partner link not found' });
    }
    if (partner.expiresAt && new Date(partner.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'This partner link has expired' });
    }
    const config = partner.config;
    if (config.maxRedemptions != null && partner.redemptions >= config.maxRedemptions) {
      return res.status(410).json({ error: 'This partner link has reached its limit' });
    }

    const discounts = normalizeDiscounts(config);

    // Best-effort visit counter for visit -> signup conversion; never blocks the response.
    prisma.partner.update({ where: { id: partner.id }, data: { visits: { increment: 1 } } })
      .catch(err => logError(err, { route: 'partner#[partner] visit count error' }));

    res.json({
      // Public display name (null for a campaign without one) — never a campaign's internal name.
      name: publicDisplayName(partner),
      kind: partner.kind,
      skipSubscription: config.skipSubscription === true,
      landing: await publicLanding(config.landing),
      welcomeMessage: config.welcomeMessage ?? null,
      trialDays: config.trialDays ?? 7,
      plans: config.plans ?? ['monthly', 'yearly'],
      discounts: {
        monthly: planDiscountInfo(discounts.monthly),
        yearly: planDiscountInfo(discounts.yearly),
      },
    });
  } catch (err) {
    logError(err, { route: 'partner#[partner] validate error', userId: req.user?.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
