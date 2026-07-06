const express = require('express');
const prisma = require('../services/db.cjs');

const router = express.Router();

function discountLabel(discount) {
  if (!discount) return null;
  const amount = discount.percentOff
    ? `${discount.percentOff}% off`
    : `$${(discount.amountOff / 100).toFixed(2)} off`;
  if (discount.duration === 'forever') return `${amount} forever`;
  if (discount.duration === 'once') return `${amount} on first payment`;
  if (discount.duration === 'repeating') return `${amount} for ${discount.durationMonths} months`;
  return amount;
}

// GET /api/partner/validate/:slug
// Public — called by web SPA when user lands on /p/:slug
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

    res.json({
      name: partner.name,
      welcomeMessage: config.welcomeMessage ?? null,
      trialDays: config.trialDays ?? 7,
      plans: config.plans ?? ['monthly', 'yearly'],
      discountLabel: discountLabel(config.discount ?? null),
    });
  } catch (err) {
    console.error('[partner] validate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
