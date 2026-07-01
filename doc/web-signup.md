# Web Signup & Payment Portal

A browser-based onboarding and subscription flow for users who discover Nora on the web (marketing site, ads, etc.) rather than directly in the App Store. Users create an account, complete onboarding, and start a Stripe subscription — then download the mobile app to begin using it.

## Why a Web Portal

Apple and Google take a 15–30% cut on in-app purchases. Stripe charges ~2.9% + $0.30. By routing web-acquired users through a web checkout before they install the app, subscription revenue avoids the App Store fee entirely. The mobile app continues to use RevenueCat for users who subscribe inside the app.

---

## Architecture

```
Browser (hinora.co/signup)
  │
  │  Vite + React SPA  (web/)
  │  served as static files from Express
  │
  ▼
Express server  (server.cjs)
  │
  ├── POST /api/auth/signup          ← create account
  ├── POST /api/auth/login           ← return JWT
  ├── PATCH /api/auth/complete-onboarding
  ├── POST /api/wacb-survey
  │
  ├── GET  /api/stripe/prices        ← fetch plan amounts from Stripe
  ├── POST /api/stripe/create-checkout-session  (requireAuth)
  └── POST /api/stripe/webhook       ← Stripe event delivery
        │
        ▼
      Prisma → PostgreSQL (User table)
```

The web app is a standard SPA rooted at `/signup`. In production it is built into `web/dist` during the Docker image build and served by Express as static files. In development, run it separately with `npm run dev` from the `web/` directory (listens on port 5174).

---

## Screen Flow

```
/signup                  Landing
  └─ /create-account     Register (email + password)
  └─ /login              Returning user

After auth:

/demo/1 → 1b → 2 → 2b → 3 → 4 → 5        Product demo slides

/onboarding/parenting-intro
/onboarding/name
/onboarding/relationship
/onboarding/child-name
/onboarding/child-gender
/onboarding/child-birthday
/onboarding/child-issue
/onboarding/snapshot-intro
/onboarding/wacb/1 … /wacb/9              WACB behavior survey
/onboarding/behavior-profile
/onboarding/intro3

/play/1 … /play/5                          Intro to play sessions

/subscribe                                 Plan picker → Stripe Checkout
/success                                   Confirmation + App Store / Play Store links
```

The `OnboardingContext` (`web/src/contexts/OnboardingContext.tsx`) holds all collected data (name, child info, WACB answers, JWT) in memory across the flow and submits it to the API at the right steps.

---

## Stripe Integration

### Environment Variables

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe API secret key (`sk_live_…` or `sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret from Stripe dashboard (`whsec_…`) |
| `STRIPE_PRICE_MONTHLY` | Stripe Price ID for the monthly plan (`price_…`) |
| `STRIPE_PRICE_YEARLY` | Stripe Price ID for the yearly plan (`price_…`) |
| `WEB_APP_URL` | Base URL for redirect after checkout (default: `https://hinora.co`) |

Create the products and prices in the Stripe dashboard first, then copy the price IDs into your environment.

### Checkout Flow

1. User selects monthly or yearly on `/subscribe`.
2. Frontend calls `POST /api/stripe/create-checkout-session` with the plan and success/cancel URLs.
3. Server creates (or reuses) a Stripe Customer for the user, then creates a Checkout Session with a 7-day trial.
4. Server returns the hosted Checkout URL; browser redirects there.
5. Stripe handles payment collection. On success, Stripe redirects to `/signup/success` and fires a webhook.

### Webhook Events

All events arrive at `POST /api/stripe/webhook`. The raw request body is captured by the Express JSON middleware (`req.rawBody`) for signature verification.

| Event | Handler |
|---|---|
| `checkout.session.completed` | Saves `stripeSubscriptionId` to user; sets `subscriptionStatus` to `TRIAL` or `ACTIVE` and writes trial/end dates |
| `customer.subscription.updated` | Syncs `subscriptionStatus` (`TRIAL` / `ACTIVE` / `EXPIRED`) and `subscriptionEndDate` |
| `customer.subscription.deleted` | Sets status to `CANCELLED`, plan to `FREE` |
| `invoice.payment_failed` | Logs the failure (notification hook point) |

Register the webhook endpoint in the Stripe dashboard:

```
https://hinora.co/api/stripe/webhook
```

Events to enable: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

### Database Fields

Two fields were added to `User` in `prisma/migrations/20260616000000_add_stripe_fields/migration.sql`:

```prisma
stripeCustomerId     String? @unique
stripeSubscriptionId String? @unique
```

These sit alongside the existing RevenueCat and subscription status fields. The webhook handlers write to the same `subscriptionStatus` / `subscriptionPlan` / `subscriptionEndDate` columns that the mobile RevenueCat flow uses, so the admin portal and `isFreeAccount` logic continue to work unchanged.

---

## Local Development

```bash
# Terminal 1 — API server
npm run dev          # runs on port 3001

# Terminal 2 — web app
cd web
npm install
npm run dev          # runs on port 5174, proxies /api to 3001 via vite.config.ts
```

The web app API client (`web/src/api.ts`) auto-selects `http://localhost:3001` when the hostname is not `hinora.co`.

To test the Stripe webhook locally, use the Stripe CLI:

```bash
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

Copy the signing secret it prints and set it as `STRIPE_WEBHOOK_SECRET` in your `.env`.

---

## Production Build (Docker)

The `Dockerfile` builds the web app before copying server files:

```dockerfile
COPY web/package*.json ./web/
RUN cd web && npm ci
COPY web ./web/
RUN cd web && npm run build
```

The compiled output lands in `web/dist`. Express serves it in production:

```
GET /signup/*  →  web/dist/index.html   (SPA fallback)
```

---

## Relationship to the Mobile Subscription Flow

| | Web portal (Stripe) | Mobile app (RevenueCat) |
|---|---|---|
| Entry point | hinora.co/signup | App Store / Play Store |
| Payment processor | Stripe | Apple / Google via RevenueCat |
| Subscription record | `stripeCustomerId` + `stripeSubscriptionId` | RevenueCat entitlement |
| `subscriptionStatus` set by | Stripe webhook | RevenueCat webhook |
| `isFreeAccount` bypass | Works for both — checked first, skips payment | Same |

Both paths converge on the same `User` row and `subscriptionStatus` field. The mobile app's `SubscriptionContext` reads `isFreeAccount` and calls RevenueCat's `getCustomerInfo()` — it has no awareness of the Stripe fields. If a user subscribes via the web and then opens the mobile app, their `subscriptionStatus` will be `ACTIVE` in the database, but the mobile app will still call RevenueCat and may show a paywall unless `isFreeAccount` is set. For web-acquired subscribers, consider setting `isFreeAccount = true` in the `checkout.session.completed` webhook handler as an interim bridge until RevenueCat-less mobile access is implemented.
