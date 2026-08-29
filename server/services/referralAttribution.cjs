'use strict';

/**
 * Referral attribution — record which existing user referred a new/updated
 * account. This is the single source of truth for paying the referrer reward
 * (see referralReward.cjs). It is independent of the acquisition offer (the
 * 30-day trial), which is delivered by attaching the referee to the reserved
 * "referral" Partner row and letting the normal partner -> Stripe checkout
 * pipeline run.
 */

const crypto = require('crypto');
const prisma = require('./db.cjs');

const REFERRAL_PARTNER_SLUG = 'referral';

/**
 * The reserved Partner row that carries the referral trial config.
 * Returns null if it hasn't been seeded (migration 20260828130000).
 */
async function getReferralPartner(client = prisma) {
  return client.partner.findUnique({ where: { slug: REFERRAL_PARTNER_SLUG } });
}

/**
 * Create the PENDING Referral row linking referrer -> referee.
 *
 * Non-throwing: returns { created, reason? } so callers can treat a bad/absent
 * code as a soft failure (attribution is best-effort, it must never block
 * signup). Safe inside a transaction — pass the tx client as `client`.
 */
async function linkReferral({ client = prisma, refereeId, refereeEmailHash, code }) {
  if (!code || typeof code !== 'string') return { created: false, reason: 'no_code' };

  const referrer = await client.user.findUnique({ where: { referralCode: code } });
  if (!referrer) return { created: false, reason: 'code_not_found' };
  if (referrer.id === refereeId) return { created: false, reason: 'self_referral' };
  if (refereeEmailHash && referrer.emailHash === refereeEmailHash) {
    return { created: false, reason: 'self_referral' };
  }

  const existing = await client.referral.findUnique({ where: { refereeId } });
  if (existing) return { created: false, reason: 'already_linked' };

  await client.referral.create({
    data: {
      id: crypto.randomUUID(),
      referrerId: referrer.id,
      refereeId,
      code,
      status: 'PENDING',
    },
  });
  return { created: true };
}

module.exports = { REFERRAL_PARTNER_SLUG, getReferralPartner, linkReferral };
