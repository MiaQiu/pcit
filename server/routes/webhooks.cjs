// RevenueCat Webhook Handler
const express = require('express');
const crypto = require('crypto');
const prisma = require('../services/db.cjs');

const router = express.Router();

const REVENUECAT_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;

/**
 * Verify webhook signature from RevenueCat
 */
const verifyWebhook = (body, signature) => {
  if (!REVENUECAT_WEBHOOK_SECRET) {
    console.error('REVENUECAT_WEBHOOK_SECRET not set');
    return false;
  }

  const hmac = crypto.createHmac('sha256', REVENUECAT_WEBHOOK_SECRET);
  const digest = hmac.update(body).digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
};

/**
 * Handle subscription activation (initial purchase or renewal)
 * RevenueCat is the source of truth for subscription dates
 */
async function handleSubscriptionActivation(userId, event) {
  // Check multiple fields for trial status (RevenueCat may use different fields)
  const isTrialPeriod = event.is_trial_period === true ||
                        event.period_type === 'TRIAL' ||
                        event.period_type === 'trial';
  const expirationDate = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
  const startDate = event.purchased_at_ms ? new Date(event.purchased_at_ms) : new Date();

  console.log(`Processing subscription activation: is_trial_period=${event.is_trial_period}, period_type=${event.period_type}, calculated isTrialPeriod=${isTrialPeriod}`);

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: 'ACTIVE',
      subscriptionPlan: isTrialPeriod ? 'TRIAL' : 'PREMIUM',
      subscriptionStartDate: startDate,
      subscriptionEndDate: expirationDate,
      revenueCatCustomerId: event.app_user_id,
    },
  });

  console.log(`Subscription activated for user ${userId} (trial: ${isTrialPeriod}, ends: ${expirationDate})`);
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCancellation(userId, event) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: 'CANCELLED',
      // Keep subscriptionPlan as PREMIUM - user still has access until expiration
      // Keep subscriptionEndDate - user still has access until then
    },
  });

  console.log(`Subscription cancelled for user ${userId}`);

  // Optional: Send email notification to user
}

/**
 * Handle subscription expiration
 */
async function handleSubscriptionExpiration(userId, event) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: 'EXPIRED',
      subscriptionPlan: 'FREE', // Revert to free plan after expiration
    },
  });

  console.log(`Subscription expired for user ${userId}`);

  // Optional: Send email notification
}

/**
 * Handle billing issues
 */
async function handleBillingIssue(userId, event) {
  console.warn(`Billing issue for user ${userId}`);

  // Optional:
  // - Update user status to BILLING_ISSUE
  // - Send email notification
  // - Give grace period before revoking access
}

/**
 * Handle RevenueCat webhook events
 * POST /api/webhooks/revenuecat
 */
router.post('/revenuecat', async (req, res) => {
  try {
    // Log headers for debugging
    console.log('Received webhook headers:', Object.keys(req.headers));

    // Get signature from header (try both cases)
    const signature = req.headers['x-revenuecat-signature'] ||
                     req.headers['authorization'];

    // For test events, RevenueCat might not send signature
    const eventType = req.body?.event?.type;
    const isTestEvent = eventType === 'TEST';

    if (!signature && !isTestEvent) {
      console.error('Missing signature header');
      console.error('Available headers:', req.headers);
      return res.status(401).json({ error: 'Missing signature' });
    }

    // Verify signature (skip for test events only)
    if (signature && !isTestEvent) {
      // Use raw body captured by express.json verify function
      const rawBody = req.rawBody;
      if (!rawBody) {
        console.error('Raw body not captured for signature verification');
        return res.status(500).json({ error: 'Internal error: raw body not available' });
      }
      if (!verifyWebhook(rawBody, signature)) {
        console.error('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
      console.log('Webhook signature verified successfully');
    } else if (isTestEvent) {
      console.log('Skipping signature verification for TEST event');
    }

    const { event } = req.body;
    const eventId = event.id; // RevenueCat provides unique event.id

    // Extract user ID based on event type
    let appUserId = event.app_user_id;

    // TRANSFER events don't have app_user_id, use transferred_to instead
    if (eventType === 'TRANSFER' && event.transferred_to && event.transferred_to.length > 0) {
      appUserId = event.transferred_to[0];
      console.log(`TRANSFER event: ${event.transferred_from?.[0]} -> ${appUserId}`);
    }

    console.log(`Received RevenueCat webhook: ${eventType} for user ${appUserId}`);
    console.log('Full webhook body:', JSON.stringify(req.body, null, 2));

    // Handle case where app_user_id is missing
    if (!appUserId) {
      console.warn('No app_user_id in webhook event');
      return res.status(200).json({ received: true, warning: 'No app_user_id' });
    }

    // CRITICAL: Check for duplicate events (idempotency)
    // RevenueCat retries webhooks, so we must handle duplicates
    const existingEvent = await prisma.subscriptionEvent.findUnique({
      where: { revenueCatEventId: eventId }
    });

    if (existingEvent) {
      console.log(`Duplicate event ${eventId} - already processed`);
      return res.status(200).json({ received: true, duplicate: true });
    }

    // Find user by ID (app_user_id is the user.id we set with Purchases.logIn)
    const user = await prisma.user.findUnique({
      where: { id: appUserId },
    });

    if (!user) {
      console.warn(`User not found for app_user_id: ${appUserId}`);
      // Still return 200 to acknowledge receipt
      return res.status(200).json({ received: true });
    }

    // Handle different event types
    switch (eventType) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
        await handleSubscriptionActivation(user.id, event);
        break;

      case 'TRANSFER':
        // When a subscription is transferred to a new user (e.g., after Purchases.logIn)
        // Activate subscription for the new user
        console.log(`Activating transferred subscription for user ${user.id}`);
        // Note: TRANSFER events don't have expiration_at_ms, subscription is already active
        await prisma.user.update({
          where: { id: user.id },
          data: {
            subscriptionStatus: 'ACTIVE',
            subscriptionPlan: 'PREMIUM',
            revenueCatCustomerId: appUserId,
          },
        });
        break;

      case 'CANCELLATION':
        await handleSubscriptionCancellation(user.id, event);
        break;

      case 'EXPIRATION':
        await handleSubscriptionExpiration(user.id, event);
        break;

      case 'BILLING_ISSUE':
        await handleBillingIssue(user.id, event);
        break;

      case 'PRODUCT_CHANGE':
        // Handle upgrade/downgrade if you add multiple subscription tiers later
        console.log(`Product change for user ${user.id}`);
        break;

      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    // Log event to database (with unique event ID for idempotency)
    await prisma.subscriptionEvent.create({
      data: {
        userId: user.id,
        revenueCatEventId: eventId, // CRITICAL: Prevents duplicate processing
        eventType,
        productId: event.product_id,
        expiresDate: event.expiration_at_ms ? new Date(event.expiration_at_ms) : null,
        revenueCatData: event,
      },
    });

    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to prevent retry
    res.status(200).json({ received: true, error: 'Processing failed' });
  }
});

module.exports = router;
