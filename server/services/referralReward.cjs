'use strict';

/**
 * Referral reward — pay the *referrer* one free month once the *referee*
 * becomes a paying customer.
 *
 * Attribution lives in the Referral table (referrerId <-> refereeId, status).
 * This module only decides *how* to deliver the reward, based on how the
 * referrer pays:
 *
 *   - Stripe web subscriber  -> credit their Stripe customer balance by one
 *                               month's list price (auto-applied to next invoice)
 *   - Mobile IAP subscriber  -> RevenueCat promotional entitlement (1 month)
 *   - Not-yet-subscribed     -> RevenueCat promotional entitlement; the app
 *     free user               honours it via the SubscriptionContext fallthrough
 *                               while the server says isSubscribed=false
 *   - isFreeAccount referrer -> nothing to grant
 *
 * grantReferralReward() is idempotent: the Referral.status PENDING guard makes a
 * duplicate call (e.g. from the other payment webhook) a no-op.
 */

const prisma = require('./db.cjs');
const { sendPushNotificationToUser } = require('./pushNotifications.cjs');

const REWARD_CAP_PER_12_MONTHS = 3;
const RC_ENTITLEMENT = 'Nora Premium';

let _stripe = null;
function stripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

async function grantRevenueCatPromo(referrerId) {
  const secretKey = process.env.REVENUECAT_SECRET_KEY;
  if (!secretKey) {
    console.error('[ReferralReward] REVENUECAT_SECRET_KEY not set — cannot grant promotional entitlement');
    return false;
  }
  try {
    const res = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(referrerId)}/entitlements/${encodeURIComponent(RC_ENTITLEMENT)}/promotional`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: 'monthly' }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`[ReferralReward] RevenueCat promo failed for ${referrerId}: ${res.status} ${body}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[ReferralReward] RevenueCat promo error for ${referrerId}: ${err.message}`);
    return false;
  }
}

async function creditStripeBalance(stripeCustomerId) {
  const priceId = process.env.STRIPE_PRICE_MONTHLY;
  if (!priceId) {
    console.error('[ReferralReward] STRIPE_PRICE_MONTHLY not set — cannot credit referrer');
    return false;
  }
  try {
    const price = await stripe().prices.retrieve(priceId);
    // Negative amount = credit; Stripe auto-applies it to the customer's next invoice.
    await stripe().customers.createBalanceTransaction(stripeCustomerId, {
      amount: -price.unit_amount,
      currency: price.currency,
      description: 'Referral reward — 1 month free',
    });
    return true;
  } catch (err) {
    console.error(`[ReferralReward] Stripe balance credit failed for ${stripeCustomerId}: ${err.message}`);
    return false;
  }
}

/**
 * Deliver one free month to the referrer. Returns true on success.
 */
async function deliverReferrerReward(referrerId) {
  const u = await prisma.user.findUnique({
    where: { id: referrerId },
    select: {
      isFreeAccount: true,
      subscriptionSource: true,
      subscriptionStatus: true,
      stripeCustomerId: true,
    },
  });
  if (!u) return false;
  if (u.isFreeAccount) return true; // already free forever — nothing to grant

  const stripeSubscriber =
    u.subscriptionSource === 'stripe' &&
    u.stripeCustomerId &&
    ['ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELLED'].includes(u.subscriptionStatus);

  if (stripeSubscriber) {
    return creditStripeBalance(u.stripeCustomerId);
  }
  return grantRevenueCatPromo(referrerId);
}

/**
 * Called when the referee makes their first real payment. Safe to call from
 * multiple webhooks and on every renewal — it no-ops unless there is a PENDING
 * Referral for this referee.
 */
async function grantReferralReward(refereeId) {
  const referral = await prisma.referral.findUnique({ where: { refereeId } });
  if (!referral || referral.status !== 'PENDING') return;

  // Fraud cap: max N rewards per referrer in a rolling 12 months.
  const recentRewards = await prisma.referral.count({
    where: {
      referrerId: referral.referrerId,
      status: 'COMPLETED',
      rewardAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
    },
  });
  if (recentRewards >= REWARD_CAP_PER_12_MONTHS) {
    console.warn(`[ReferralReward] Reward cap reached for referrer ${referral.referrerId}`);
    return;
  }

  const delivered = await deliverReferrerReward(referral.referrerId);
  if (!delivered) {
    // Leave the Referral PENDING so a later payment signal retries delivery.
    console.error(`[ReferralReward] Delivery failed for referrer ${referral.referrerId} — left PENDING`);
    return;
  }

  await prisma.referral.update({
    where: { id: referral.id },
    data: { status: 'COMPLETED', rewardAt: new Date() },
  });

  await sendPushNotificationToUser(referral.referrerId, {
    title: 'You earned 1 free month!',
    body: 'Your friend just subscribed to Nora. Enjoy an extra month on us.',
  }).catch((err) => console.error('[ReferralReward] push failed:', err?.message));

  console.log(`[ReferralReward] Reward granted: referrer=${referral.referrerId} referee=${refereeId}`);
}

module.exports = { grantReferralReward, deliverReferrerReward };
