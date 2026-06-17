// Stripe payment routes for web onboarding
const express = require('express');
const prisma = require('../services/db.cjs');
const { requireAuth } = require('../middleware/auth.cjs');

let _stripe = null;
function stripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

const router = express.Router();

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Price IDs — set these in env after creating products in Stripe dashboard
const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY,
  yearly: process.env.STRIPE_PRICE_YEARLY,
};

// GET /api/stripe/prices
// Returns formatted prices for the monthly and yearly plans (no auth required)
router.get('/prices', async (req, res) => {
  try {
    const [monthly, yearly] = await Promise.all([
      PRICE_IDS.monthly ? stripe().prices.retrieve(PRICE_IDS.monthly) : null,
      PRICE_IDS.yearly ? stripe().prices.retrieve(PRICE_IDS.yearly) : null,
    ]);

    const format = (price) => {
      if (!price) return null;
      const amount = price.unit_amount / 100;
      const currency = price.currency.toUpperCase();
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: price.currency,
      }).format(amount);
      return { amount, currency, formatted, priceId: price.id };
    };

    const monthlyData = format(monthly);
    const yearlyData = format(yearly);

    let savingsPercent = 0;
    let yearlyPerMonth = null;
    if (monthlyData && yearlyData) {
      savingsPercent = Math.round((1 - yearlyData.amount / (monthlyData.amount * 12)) * 100);
      const perMonth = yearlyData.amount / 12;
      yearlyPerMonth = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: yearly.currency,
      }).format(perMonth);
    }

    res.json({ monthly: monthlyData, yearly: yearlyData, savingsPercent, yearlyPerMonth });
  } catch (error) {
    console.error('Stripe prices fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

// POST /api/stripe/create-checkout-session
// Creates a Stripe Checkout Session for web subscription
router.post('/create-checkout-session', requireAuth, async (req, res) => {
  try {
    const { plan, successUrl, cancelUrl } = req.body;
    const userId = req.user.id;

    if (!['monthly', 'yearly'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be monthly or yearly.' });
    }

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      return res.status(500).json({ error: `Stripe price ID for ${plan} plan not configured.` });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Create or retrieve Stripe customer
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe().customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: String(userId) },
      });
      stripeCustomerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId },
      });
    }

    const session = await stripe().checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { userId: String(userId) },
      },
      success_url: successUrl || `${process.env.WEB_APP_URL || 'https://hinora.co'}/success`,
      cancel_url: cancelUrl || `${process.env.WEB_APP_URL || 'https://hinora.co'}/subscribe`,
      metadata: { userId: String(userId), plan },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Stripe create-checkout-session error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/stripe/webhook
// Raw body is captured by the global express.json verify callback into req.rawBody
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!req.rawBody) {
    console.error('Stripe webhook: rawBody not available. Check express.json verify config.');
    return res.status(400).send('Webhook Error: raw body not captured');
  }

  let event;
  try {
    event = stripe().webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutCompleted(session);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await handleSubscriptionUpdated(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await handlePaymentFailed(invoice);
        break;
      }
      default:
        // Ignore unhandled event types
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error(`Stripe webhook handler error for ${event.type}:`, error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

async function handleCheckoutCompleted(session) {
  const userId = session.metadata?.userId;
  if (!userId) return;

  const subscriptionId = session.subscription;
  if (!subscriptionId) return;

  const subscription = await stripe().subscriptions.retrieve(subscriptionId);
  const isTrialActive = subscription.status === 'trialing';
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;

  await prisma.user.update({
    where: { id: parseInt(userId) },
    data: {
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: isTrialActive ? 'TRIAL' : 'ACTIVE',
      subscriptionPlan: isTrialActive ? 'TRIAL' : 'PREMIUM',
      subscriptionStartDate: new Date(subscription.start_date * 1000),
      subscriptionEndDate: currentPeriodEnd,
      trialStartDate: isTrialActive ? new Date() : undefined,
      trialEndDate: trialEnd,
    },
  });

  console.log(`[STRIPE] Checkout completed for user ${userId}, status: ${subscription.status}`);
}

async function handleSubscriptionUpdated(subscription) {
  const user = await prisma.user.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (!user) return;

  const isActive = ['active', 'trialing'].includes(subscription.status);
  const isTrialActive = subscription.status === 'trialing';
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: isTrialActive ? 'TRIAL' : isActive ? 'ACTIVE' : 'EXPIRED',
      subscriptionPlan: isActive ? 'PREMIUM' : 'FREE',
      subscriptionEndDate: currentPeriodEnd,
      trialEndDate: trialEnd,
    },
  });

  console.log(`[STRIPE] Subscription updated for user ${user.id}: ${subscription.status}`);
}

async function handleSubscriptionDeleted(subscription) {
  const user = await prisma.user.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (!user) return;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: 'CANCELLED',
      subscriptionPlan: 'FREE',
      subscriptionEndDate: new Date(subscription.current_period_end * 1000),
    },
  });

  console.log(`[STRIPE] Subscription cancelled for user ${user.id}`);
}

async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;
  if (!customerId) return;

  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
  if (!user) return;

  console.log(`[STRIPE] Payment failed for user ${user.id}, invoice: ${invoice.id}`);
  // Could send notification here
}

module.exports = router;
