const express = require('express');
const prisma = require('../services/db.cjs');
const { discountLabel, normalizeDiscounts } = require('../utils/partnerDiscount.cjs');
const { publicDisplayName, normalizeSource, mergeLanding } = require('../utils/partnerLanding.cjs');
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

// GET /api/partner/validate/:slug?m=<messageKey>&src=<source>
// Public — called by web SPA when user lands on /p/:slug[/:messageKey][?src=…] (and
// /join/:code for the reserved referral partner). Each successful call counts as a visit,
// both in the raw Partner.visits total and per (message, source) in CampaignVisit.
// An unknown or archived message key falls back to the link's own copy (messageKey: null).
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

    const requestedKey = typeof req.query.m === 'string' ? req.query.m.trim().toLowerCase() : '';
    const message = requestedKey
      ? await prisma.campaignMessage.findUnique({
          where: { partnerId_key: { partnerId: partner.id, key: requestedKey } },
        })
      : null;
    const activeMessage = message?.active ? message : null;
    const source = normalizeSource(req.query.src);

    // Best-effort visit counters for visit -> signup conversion; never block the response.
    const messageKey = activeMessage?.key ?? '';
    Promise.all([
      prisma.partner.update({ where: { id: partner.id }, data: { visits: { increment: 1 } } }),
      prisma.campaignVisit.upsert({
        where: { partnerId_messageKey_source: { partnerId: partner.id, messageKey, source: source ?? '' } },
        create: { partnerId: partner.id, messageKey, source: source ?? '', count: 1 },
        update: { count: { increment: 1 } },
      }),
    ]).catch(err => logError(err, { route: 'partner#[partner] visit count error' }));

    res.json({
      // Public display name (null for a campaign without one) — never a campaign's internal name.
      name: publicDisplayName(partner),
      kind: partner.kind,
      skipSubscription: config.skipSubscription === true,
      // Web signup asks for the account at the end of onboarding instead of the start.
      accountLast: config.accountLast === true,
      landing: await publicLanding(mergeLanding(config.landing, activeMessage?.landing)),
      // Resolved attribution — echoed back by the web app in the signup request.
      messageKey: activeMessage?.key ?? null,
      source,
      // Shown behind the consent checkbox on the campaign create-account screen.
      campaignRules: partner.kind === 'CAMPAIGN' ? (config.campaignRules ?? null) : null,
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
