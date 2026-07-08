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
  ├── GET  /api/auth/me              ← returns isSubscribed (computed server-side)
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
  └─ /create-account     Register (email + password) — FIRST step after Landing
  └─ /login              Returning user

After auth:

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

**Flow order:** Landing → Create Account → Onboarding → Play sessions → Subscribe → Success. Account creation happens *before* onboarding (not after, as an earlier version of this flow had it) — the account is created with placeholder/default profile fields, then `ChildBirthdayScreen` and `WacbQuestionScreen` PATCH the real collected data into the profile via `completeOnboarding()`/`submitWacbSurvey()` once `data.accessToken` exists. Back-button targets (`backTo` prop on `OnboardingLayout`, and `CreateAccountScreen`'s `BackButton`) must stay in sync with this order — check every screen along the chain if you reorder it again.

`/demo/1…5` and `/onboarding/parenting-intro` still exist as screens/routes but nothing currently navigates into them from the live flow — they're orphaned, not part of the reachable app. Worth cleaning up or reconnecting, but left as-is since removing them wasn't in scope of the flow-order fix.

The `OnboardingContext` (`web/src/contexts/OnboardingContext.tsx`) holds all collected data (name, child info, WACB answers, JWT, and `partnerInfo` if the user arrived via a partner link — see `doc/partners.md`) in memory (persisted to `localStorage`) across the flow and submits it to the API at the right steps.

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
| `VITE_API_URL` | **Build-time** env var for the web SPA — set to the server's public URL |

`STRIPE_WEBHOOK_SECRET` is validated at startup; if missing, webhook signature verification fails and all events are rejected.

Create the products and prices in the Stripe dashboard first, then copy the price IDs into your environment.

### Checkout Flow

1. User selects monthly or yearly on `/subscribe`.
2. Frontend calls `POST /api/stripe/create-checkout-session` with the plan and success/cancel URLs.
3. Server looks up the Stripe Customer by email (or creates one if none exists), applies the user's partner discount for the selected plan if any (see `doc/partners.md`), then creates a Checkout Session with the applicable trial length.
4. Server returns the hosted Checkout URL; browser redirects there.
5. Stripe handles payment collection. On success, Stripe redirects to `/signup/success` and fires a webhook.

**Race condition guard:** The customer-creation step searches Stripe by email before creating, to prevent duplicate customers when two simultaneous requests both see `stripeCustomerId = null` in the DB.

**Decrypt before sending to Stripe:** `User.email`/`User.name` are stored encrypted at rest (`server/utils/encryption.cjs`, applied uniformly regardless of environment). `create-checkout-session` must decrypt them (`decryptSensitiveData`) before passing to `stripe().customers.list`/`.create` — passing the raw ciphertext fails with Stripe's `email_invalid` error, since it's not a real email address. This bit us once; every route that touches `user.email`/`user.name` from a fresh Prisma fetch needs the same decryption step.

### Webhook Events

All events arrive at `POST /api/stripe/webhook`. The raw request body is captured by the Express JSON middleware (`req.rawBody`) for signature verification.

| Event | Handler | Action |
|---|---|---|
| `checkout.session.completed` | `handleCheckoutCompleted` | Writes `stripeSubscriptionId`; sets `subscriptionStatus` to `TRIAL` or `ACTIVE`, `subscriptionPlan` to `PREMIUM`, `subscriptionSource` to `'stripe'`; writes trial start/end dates from Stripe timestamps |
| `customer.subscription.updated` | `handleSubscriptionUpdated` | Syncs `subscriptionStatus` and `subscriptionEndDate` |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | Sets status to `CANCELLED`, plan to `FREE`, keeps `subscriptionEndDate` so access holds until period end |
| `invoice.paid` | `handleInvoicePaid` | Updates `subscriptionEndDate` on every renewal — critical for keeping access after the first billing cycle |
| `invoice.payment_failed` | `handlePaymentFailed` | Sets `subscriptionStatus` to `PAST_DUE`; user retains access during Stripe's retry window (~14 days) |
| `customer.subscription.trial_will_end` | — | Logged (3-day warning; hook point for reminder email) |
| `invoice.payment_action_required` | — | Logged (3D Secure edge case) |
| `charge.refunded` | `handleChargeRefunded` | Sets status to `EXPIRED`, plan to `FREE` immediately |

Register these events in the Stripe dashboard webhook settings:

```
https://hinora.co/api/stripe/webhook
```

Events to enable: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `customer.subscription.trial_will_end`, `charge.refunded`.

### Subscription Status Lifecycle

```
(checkout)
    │
    ▼
TRIAL ──────────────────────────────────────────────────────► ACTIVE
  (trial_end, invoice.paid)                                   │
                                                              │ (payment fails)
                                                              ▼
                                                          PAST_DUE
                                                              │
                        ┌─────────────────────────────────────┤
                        │ (all retries fail,                  │ (payment recovers,
                        │  subscription.deleted)              │  invoice.paid)
                        ▼                                     ▼
                     EXPIRED                              ACTIVE
                     
(cancel) ──► CANCELLED  (access continues until subscriptionEndDate)
(refund)  ──► EXPIRED   (immediate)
```

`subscriptionPlan` is `PREMIUM` during TRIAL, ACTIVE, PAST_DUE, and CANCELLED; reverts to `FREE` on EXPIRED.

### Database Fields

Migration `20260616000000_add_stripe_fields` added:

```prisma
stripeCustomerId     String? @unique
stripeSubscriptionId String? @unique
```

Migration `20260617000000_add_subscription_source` added:

```prisma
subscriptionSource   String?   // 'stripe' | 'revenuecat' | 'admin'
```

And extended the `SubscriptionStatus` enum with `PAST_DUE`.

---

## Server-side `isSubscribed`

`GET /api/auth/me` now returns a computed `isSubscribed` boolean alongside the raw subscription fields:

```js
isSubscribed = isFreeAccount
  || (subscriptionStatus in ['ACTIVE', 'TRIAL', 'CANCELLED', 'PAST_DUE']
      && subscriptionEndDate > now)
```

Clients should use `isSubscribed` as their single gating check rather than inspecting individual status/plan fields. `CANCELLED` is included because users retain access until `subscriptionEndDate` even after cancellation.

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

The web app API client (`web/src/api.ts`) uses `import.meta.env.VITE_API_URL`. In development, leave it unset — the Vite dev server proxy routes `/api` to `localhost:3001` automatically.

To test the Stripe webhook locally, use the Stripe CLI:

```bash
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

Copy the signing secret it prints and set it as `STRIPE_WEBHOOK_SECRET` in your `.env`.

---

## Production Build (Docker)

The `Dockerfile` builds the web app before copying server files, injecting the API URL at build time:

```dockerfile
COPY web/package*.json ./web/
RUN cd web && npm ci
COPY web ./web/
ARG VITE_API_URL=https://wpwpawhz29.ap-southeast-1.awsapprunner.com
RUN cd web && VITE_API_URL=$VITE_API_URL npm run build
```

To point a staging build at a different backend:

```bash
docker build --build-arg VITE_API_URL=https://staging.example.com .
```

The compiled output lands in `web/dist`. Express serves it in production:

```
GET /signup/*  →  web/dist/index.html   (SPA fallback)
```

---

## B2B2C Partner Signups

Business partners (clinics, employers) receive unique QR codes (`hinora.co/p/:slug`) that route users into the standard web signup flow with a customised offer — extended trial, group discount coupon, and filtered plan selection applied automatically at Stripe checkout.

The partner flow is a superset of this flow: all the same screens, same webhook lifecycle, same `isSubscribed` check. The only differences are the `partnerSlug` sent at signup, and the checkout session being configured from the partner's `config` JSON.

See `doc/partners.md` for the full partner documentation.

---

## Relationship to the Mobile Subscription Flow

| | Web portal (Stripe) | Mobile app (RevenueCat) |
|---|---|---|
| Entry point | hinora.co/signup | App Store / Play Store |
| Payment processor | Stripe | Apple / Google via RevenueCat |
| Subscription record | `stripeCustomerId` + `stripeSubscriptionId` | RevenueCat entitlement |
| `subscriptionStatus` set by | Stripe webhooks | RevenueCat webhook |
| `subscriptionSource` | `'stripe'` | `'revenuecat'` |
| Access gate (mobile) | Server `isSubscribed` + RevenueCat fallback | Server `isSubscribed` + RevenueCat fallback |

Both paths converge on the same `User` row. The mobile `SubscriptionContext` checks the server's `isSubscribed` flag first (from `/api/auth/me`), which is true for Stripe subscribers. If `isSubscribed` is true, RevenueCat is not consulted for gating — it is only used for the in-app purchase flow itself. This means a user who subscribes on the web and then opens the mobile app will not see a paywall, even without a RevenueCat entitlement.

A new mobile app build is required for this change to take effect for existing installs.

### WACB Survey Field Names

The WACB survey (`POST /api/wacb-survey`) requires these exact field names — the web app was previously sending different keys and receiving 400 errors:

| Field | Required | Notes |
|---|---|---|
| `parentingStressLevel` | Yes | 1–7; web app defaults to `3` if not collected |
| `q1Dawdle` | Yes | 1–5 |
| `q2MealBehavior` | Yes | 1–5 |
| `q3Disobey` | Yes | 1–5 |
| `q4Angry` | Yes | 1–5 |
| `q5Scream` | Yes | 1–5 |
| `q6Destroy` | Yes | 1–5 |
| `q7ProvokeFights` | Yes | 1–5 |
| `q8Interrupt` | Yes | 1–5 |
| `q9Attention` | Yes | 1–5 |
