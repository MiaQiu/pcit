# Unified Referral + Partner Acquisition Flow

**Date:** 2026-08-28
**Status:** Implemented (backend + web SPA). Needs the DB migration applied and a
coordinated deploy — see "Implementation status" below.
**Supersedes:** the server-side trial-grant approach sketched for the referee in
`referral-mechanism.md` (see "Update 2026-08-28" note there).

---

## Implementation status

Shipped:

- **Migration** `prisma/migrations/20260828130000_seed_referral_partner/` — seeds
  the reserved `referral` `Partner` row (`trialDays: 30`, no discount).
- **`server/services/referralReward.cjs`** — `grantReferralReward(refereeId)` +
  `deliverReferrerReward()` (Stripe balance credit for web-subscriber referrers,
  RevenueCat promo entitlement otherwise). Moved out of `webhooks.cjs`.
- **`server/services/referralAttribution.cjs`** — `getReferralPartner()`,
  `linkReferral()` (creates the PENDING `Referral` row, best-effort).
- **`server/routes/webhooks.cjs`** — imports the shared reward; call site renamed
  to `grantReferralReward`.
- **`server/routes/stripe.cjs`** — `handleInvoicePaid` calls `grantReferralReward`
  on any `amount_paid > 0` invoice (idempotent; the real trigger is the
  first post-trial charge).
- **`server/routes/auth.cjs`** — `POST /api/auth/signup` accepts `referralCode`,
  resolves it to the `referral` partner, sets `subscriptionSource: 'referral'`,
  and links the `Referral` row.
- **`server/routes/referral.cjs`** — `POST /register` marked deprecated; still
  works but now also attaches the referee to the `referral` partner.
- **`server.cjs`** — `/join/:code` → 302 to `${SIGNUP_APP_URL}/join/:code`.
- **`web/`** — new `ReferralLandingScreen` + `/join/:code` route;
  `OnboardingContext` gains `referralCode` / `referrerName`; `CreateAccountScreen`
  sends `referralCode`; `api.ts` gains `referrerName()`.
- **`web/vercel.json`** — removed the `/join/:code` → backend rewrite so the SPA
  handles it (otherwise the new backend redirect loops).

Still to do:

1. **Apply the migration** to dev and prod (`prisma migrate deploy` over a
   tunnel — `.dockerignore` excludes `prisma/migrations`, so it won't auto-apply
   on deploy). Without the `referral` `Partner` row, referred users still sign up
   and get the `Referral` row, but no 30-day trial.
2. **Deploy order:** ship the `web/` build (Vercel) and the backend together, or
   web first. If the backend redirect lands while Vercel still has the old
   `/join/:code` rewrite, `/join/:code` briefly loops.
3. **Copy:** `public/join.html` still says "1 month free" / points at the
   deprecated `/register`; it's now unreachable via `/join/:code` but still
   served at `/join.html`. Retire it when convenient.
4. **Mobile IAP gap** (§5.2) — unchanged, shared with partners, not addressed here.

---

## 1. Why

We have two acquisition pipelines that do almost the same thing:

| | **Partner** (`partners.md`) | **Referral** (`referral-mechanism.md`) |
|---|---|---|
| Entry | `hinora.co/p/:slug` → SPA landing → normal signup | `hinora.co/join/:code` → `join.html` → bespoke `POST /api/referral/register` |
| Config carried | `trialDays`, per-plan `discounts`, `plans` from `Partner.config` | none — bespoke |
| Trial delivery | `trial_period_days` in the **web Stripe checkout** | **nothing today** — referee gets the standard free-recordings gate, despite `join.html` promising "1 month free" |
| Attribution | `User.partnerId` (informational) + `Partner.redemptions` | `Referral` row (`referrerId` ↔ `refereeId`) |
| Reward | none | RevenueCat promotional entitlement to the **referrer** on the referee's first real payment |

The referral side reinvents signup and never actually grants the promised
trial. The partner side already has a working "carry an offer from a signup link
through to Stripe checkout" pipeline. **This plan routes referred users through
the partner pipeline** and keeps referral-specific concerns (who referred whom,
paying the reward) in the `Referral` table where they already live.

---

## 2. Design principle — two independent concerns

```
┌─────────────────────────────┐     ┌──────────────────────────────────────┐
│ ACQUISITION OFFER           │     │ REFERRAL ATTRIBUTION LEDGER          │
│ "30-day trial, no discount, │     │ "NORA-68ZG: userA referred userB,   │
│  billed via Stripe"         │     │  status PENDING, reward not paid"   │
│                             │     │                                      │
│ Partner row slug="referral" │     │ Referral table — UNCHANGED           │
│ + user.partnerId            │     │ referrerId, refereeId (unique),     │
│ → create-checkout-session   │     │ code, status, rewardAt              │
└─────────────────────────────┘     └──────────────────────────────────────┘
        shared with real partners            referral-only
```

`user.partnerId` pointing at the `referral` pseudo-partner means only "this user
arrived through a referral link, give them the referral offer at checkout." It
is **not** the attribution. The `Referral` row is the attribution, and it is the
single source of truth for paying the reward.

---

## 3. Target architecture

### 3.1 One reserved `Partner` row

Seed once (migration or admin action):

```jsonc
{
  "slug": "referral",
  "name": "Referral",
  "status": "ACTIVE",
  "expiresAt": null,
  "config": {
    "trialDays": 30,
    "plans": ["monthly", "yearly"],
    "discounts": { "monthly": null, "yearly": null },
    "maxRedemptions": null
  }
}
```

One row for the whole referral cohort. `Partner.redemptions` then doubles as a
free "referred signups" counter. Changing the referral trial length later is a
one-field edit in the admin portal, same as any partner.

### 3.2 Referral landing → partner landing pattern

Replace `public/join.html` + `GET /join/:code` (`server.cjs:310`) with the same
shape as `PartnerLandingScreen` (`web/src/screens/PartnerLandingScreen.tsx`):

- `hinora.co/join/:code` → Express 302 → `signup.hinora.co/join/:code` (new SPA
  route), mirroring the `/p/:slug` redirect (`server.cjs:300`).
- The SPA `ReferralLandingScreen` (no visible UI):
  1. `GET /api/referral/referrer-name/:code` (existing) → set the
     "{firstName} invited you to Nora" heading in context.
  2. Set `OnboardingContext.partnerInfo` to the `referral` partner's config —
     either hard-coded `{ slug: 'referral', trialDays: 30, plans: [...],
     discounts: { monthly: null, yearly: null } }` or via
     `GET /api/partner/validate/referral`.
  3. Set a new `OnboardingContext.referralCode` field (persisted to
     `localStorage`, cleared on completion).
  4. `navigate('/', { replace: true })` into the normal signup flow.

From here the referred user **is** a partner signup. The web `SubscriptionScreen`
already renders `partnerInfo.trialDays` ("30 days free") and filters plan cards —
**no new rendering code**.

> `join.html` can be kept as a thin fallback for users with the app already
> installed (its `nora://` de- link iframe), but the primary path becomes the SPA
> route. If `join.html` is retained, change its form `POST` target from
> `/api/referral/register` to `/api/auth/signup` with
> `{ partnerSlug: 'referral', referralCode: code, email, password }`.

### 3.3 Unified signup endpoint

`POST /api/auth/signup` already accepts `partnerSlug` (`auth.cjs:63,81–152`).
Add an optional `referralCode`:

```js
// after resolving `partner` from partnerSlug:
if (referralCode && !partnerSlug) {
  partner = await prisma.partner.findUnique({ where: { slug: 'referral' } });
  // (same active / expiry / cap checks as any partner)
}

// ... existing user.create with:
//   partnerId: partner?.id ?? null,
//   subscriptionSource: referralCode ? 'referral' : (partner ? 'partner' : null),

// after user.create, if referralCode:
const referrer = await prisma.user.findUnique({ where: { referralCode } });
if (referrer && referrer.id !== user.id) {
  const existing = await prisma.referral.findUnique({ where: { refereeId: user.id } });
  if (!existing) {
    await prisma.referral.create({
      data: {
        id: crypto.randomUUID(),
        referrerId: referrer.id,
        refereeId: user.id,
        code: referralCode,
        status: 'PENDING',
      },
    });
  }
}
```

Move the referral-code validation (disposable-domain block, referrer lookup,
self-referral block) into a shared helper reused by both this endpoint and the
deep-link `apply-existing` path.

**Deprecate `POST /api/referral/register`** — delete it, or keep it for one
release as a thin wrapper that calls the same internal signup path. `join.html`
and the SPA both stop using it.

### 3.4 Checkout — no change

`POST /api/stripe/create-checkout-session` (`stripe.cjs:98–155`) already reads
`user.partner.config`:

- `trial_period_days = partnerConfig?.trialDays ?? 7` → **30** for referred users
- `stripeCouponId = normalizeDiscounts(partnerConfig)[plan]?.stripeCouponId` →
  `null` for referred users (no discount)
- plan validated against `partnerConfig.plans`

The referred user completes the **same Stripe Checkout** as an `sgh-family`
partner user, with a 30-day trial and no coupon. Zero code change.

### 3.5 Reward — shared module, dual triggers, referrer-aware delivery

**Extract** `handleReferralReward` (`webhooks.cjs:104–159`) into
`server/services/referralReward.cjs` as `grantReferralReward(refereeId)`:

```js
async function grantReferralReward(refereeId) {
  const referral = await prisma.referral.findUnique({ where: { refereeId } });
  if (!referral || referral.status !== 'PENDING') return;          // idempotent

  // fraud cap: max REWARD_CAP rewards per referrer per rolling 12 months
  const recent = await prisma.referral.count({
    where: {
      referrerId: referral.referrerId,
      status: 'COMPLETED',
      rewardAt: { gte: new Date(Date.now() - 365 * 864e5) },
    },
  });
  if (recent >= REWARD_CAP) { /* log + return */ }

  const ok = await deliverReferrerReward(referral.referrerId);       // see below
  if (!ok) return;                                                   // leave PENDING, retry next signal

  await prisma.referral.update({
    where: { id: referral.id },
    data: { status: 'COMPLETED', rewardAt: new Date() },
  });
  await sendPushNotificationToUser(referral.referrerId, {
    title: 'You earned 1 free month!',
    body: 'Your friend just subscribed to Nora. Enjoy an extra month on us.',
  });
}
```

**`deliverReferrerReward(referrerId)` — branch on how the referrer pays:**

```js
async function deliverReferrerReward(referrerId) {
  const u = await prisma.user.findUnique({
    where: { id: referrerId },
    select: {
      isFreeAccount: true, subscriptionSource: true, subscriptionStatus: true,
      stripeCustomerId: true, stripeSubscriptionId: true,
    },
  });
  if (!u) return false;
  if (u.isFreeAccount) return true;   // nothing to reward — already free forever

  const stripeActive =
    u.subscriptionSource === 'stripe' &&
    u.stripeCustomerId &&
    ['ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELLED'].includes(u.subscriptionStatus);

  if (stripeActive) {
    // Web subscriber: credit their Stripe customer balance by one month's list
    // price. Auto-applies to the next invoice. Stacks cleanly — does NOT touch
    // subscription-level discounts (unlike coupon replacement).
    const price = await stripe().prices.retrieve(process.env.STRIPE_PRICE_MONTHLY);
    await stripe().customers.createBalanceTransaction(u.stripeCustomerId, {
      amount: -price.unit_amount,               // negative = credit
      currency: price.currency,
      description: `Referral reward — 1 month free (referral ${referrerId})`,
    });
    return true;
  }

  // Mobile subscriber OR not-yet-subscribed free user: RevenueCat promotional
  // entitlement. The app checks RC entitlements whenever the server says
  // isSubscribed is false (SubscriptionContext falls through), so a free
  // referrer gets a usable free month; RC also honours it for a real IAP
  // subscriber. Only Stripe web subscribers need the branch above.
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(referrerId)}/entitlements/Nora%20Premium/promotional`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.REVENUECAT_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ duration: 'monthly' }),
    }
  );
  return res.ok;
}
```

**Triggers — call `grantReferralReward` from both payment webhooks:**

| Referee pays via | Webhook file | Hook point | Condition |
|---|---|---|---|
| **Stripe** (web — the main path now) | `stripe.cjs` | `handleInvoicePaid` (`:335`) | `invoice.billing_reason === 'subscription_cycle' && invoice.amount_paid > 0` (first real charge after the 30-day trial) |
| **RevenueCat** (referee subscribed via mobile IAP) | `webhooks.cjs` | existing `isFirstPayment` branch (`:260`) | unchanged |

Both call the same function; the `status !== 'PENDING'` guard makes a duplicate
signal a no-op.

---

## 4. What changes, by file

| File | Change |
|---|---|
| `prisma` seed / admin | Insert the `referral` `Partner` row |
| `server.cjs` | `/join/:code` → 302 to `signup.hinora.co/join/:code` (or keep `join.html` as installed-app fallback) |
| `web/src/screens/ReferralLandingScreen.tsx` | **New** — mirrors `PartnerLandingScreen`; sets `partnerInfo` + `referralCode` |
| `web/src/App.tsx` | Route `/join/:code` → `ReferralLandingScreen` |
| `web/src/contexts/OnboardingContext.tsx` | Add `referralCode` field (+ `localStorage` persist/clear) |
| `web/src/screens/CreateAccountScreen.tsx` | Pass `referralCode: data.referralCode` in the `signup()` payload |
| `web/src/api.ts` | `signup()` — add `referralCode?: string` |
| `server/routes/auth.cjs` | Accept `referralCode`; resolve to `referral` partner; create the `Referral` row after `user.create`; set `subscriptionSource: 'referral'` |
| `server/routes/referral.cjs` | Extract shared code-validation helper; **delete `POST /register`** (or stub); keep `referrer-name`, `my-code`, `apply-existing` |
| `server/services/referralReward.cjs` | **New** — `grantReferralReward` + `deliverReferrerReward` (moved out of `webhooks.cjs`) |
| `server/routes/webhooks.cjs` | Import reward from the shared module; no logic change |
| `server/routes/stripe.cjs` | `handleInvoicePaid` — call `grantReferralReward(user.id)` on first post-trial charge |
| `server/jobs/referralExpiryJob.cjs` | Unchanged (still expires stale `PENDING` rows after 90d). Drop the referral-trial `subscriptionStatus` cleanup from the abandoned server-grant approach if it was added |
| `public/join.html` | Retire, or repoint its form to `/api/auth/signup` |
| `nora-mobile` | **No change required** for the happy path (web checkout). See §5.2 for the IAP gap |

---

## 5. Decisions & edge cases

### 5.1 Card-upfront trial vs. no-card access grant — **decided: card-upfront**

The partner pipeline is a *free trial that auto-converts to a paid Stripe
subscription unless cancelled* — the referee enters a card at web checkout to
start the 30 days. This differs from a "30 days of free access, no card"
grant. It is the right model here because:

- the referrer reward is explicitly defined around *"the referee became a paying
  customer"* — a card-upfront trial converts far better;
- it reuses 100% of the partner plumbing.

**Copy change:** `join.html` / landing / `SubscriptionScreen` should read
"Start your 30-day free trial" rather than implying no-strings free access.

### 5.2 Mobile IAP gap — shared with partners, fix once

If a referred user skips web checkout and later subscribes from the **mobile
app**, they get RevenueCat's standard store pricing (the App Store / Play
offering has no trial) — the 30 days are lost, not deferred. This is the exact
gap documented in `partners.md` → "Pending decisions". Recommended shared fix:
when `user.partnerId` is set and `subscriptionSource !== 'stripe'`, gate the IAP
button in `nora-mobile/src/screens/onboarding/SubscriptionScreen.tsx` and route
the user back to web to finish. Requires adding `partnerId` to the
`GET /api/auth/me` select (`auth.cjs:558–583`) and the shared `User` type
(`packages/nora-core/src/types/index.ts`).

Until that lands: a referred user who skips web checkout falls into the normal
free-recordings gate (`RecordScreen.tsx` `FREE_SESSIONS_LIMIT`), same as a
partner skipper. The `Referral` row still exists, so the reward still fires
if/when they eventually pay by any route.

### 5.3 Referrer reward delivery — resolved in §3.5

- **Stripe web subscriber referrer** → customer-balance credit of one month's
  list price, auto-applied to their next invoice.
- **Mobile IAP subscriber referrer** → RevenueCat promotional entitlement
  (existing mechanism).
- **Not-yet-subscribed free referrer** → RevenueCat promotional entitlement;
  the app honours it via the `SubscriptionContext` fall-through when server
  `isSubscribed` is false. Known limitation: `duration: 'monthly'` starts
  immediately, so if the free referrer never opens the app within the month it
  is wasted. Acceptable for v1; revisit with a lazy grant if it matters.
- **`isFreeAccount` (whitelisted) referrer** → no-op; already free.

One `Stripe.Coupon` is *not* needed — the balance-credit approach avoids
touching subscription discounts and any conflict with a partner discount the
referrer might carry.

### 5.4 Reward criteria / trigger precision

30-day Stripe trial timeline:

```
checkout.session.completed   → trial starts, Referral stays PENDING
   (30 days)
invoice.paid                 → billing_reason: 'subscription_cycle', amount_paid > 0
                             → grantReferralReward(refereeId)  ✅
```

The first trial invoice (`billing_reason: 'subscription_create'`, usually $0) is
explicitly excluded. A referee who cancels during the trial never triggers a
reward; their `Referral` row expires via `referralExpiryJob` after 90 days.

### 5.5 Existing users / deep-link path

`POST /api/referral/apply-existing` (used by `LoginScreen` after a `nora://join`
deep link) stays. Decision from prior discussion: **an existing account gets no
trial** — `apply-existing` only records the `Referral` row for attribution. (It
never granted a trial and won't start.) Note the pre-existing param-name bug:
`App.tsx` linking parses `?referralCode=` but `join.html` sends `?code=` and the
web URL uses a path segment — the deep-link capture is effectively dead today
and should be fixed or removed as separate cleanup.

### 5.6 Self-referral, disposable email, caps

- Self-referral: blocked in the shared validation helper (`referrer.id !== refereeId`, emailHash compare).
- Disposable email: existing `DISPOSABLE_DOMAINS` block moves into the shared helper / stays in signup.
- Referred-signup volume: `Partner.redemptions` on the `referral` row (no cap by default; set `maxRedemptions` to throttle if abused).
- Reward payouts: `REWARD_CAP` per referrer per rolling 12 months in `grantReferralReward` (carry over the existing cap of 3, or raise).

---

## 6. Rollout

1. **Seed** the `referral` `Partner` row (prod + dev).
2. Ship `server/services/referralReward.cjs` extraction + the Stripe
   `handleInvoicePaid` trigger + `deliverReferrerReward` branching. This is
   backward-compatible — the current `/api/referral/register` flow keeps working
   and now also pays Stripe-subscriber referrers correctly.
3. Ship the web `ReferralLandingScreen` + `OnboardingContext.referralCode` +
   `CreateAccountScreen` / `signup()` wiring + `auth.cjs` `referralCode` handling.
4. Repoint `/join/:code` to the SPA route; retire `join.html` (or repoint its
   form).
5. Delete `POST /api/referral/register` once traffic to it is zero.
6. (Separate) Close the mobile IAP gap for both partner and referral users.

---

## 7. Open questions

- **Referrer reward for a Stripe referrer on the *yearly* plan** — credit one
  monthly-price, or 1/12 of the yearly price, or a fixed amount? §3.5 assumes
  monthly list price.
- **Should the `referral` partner offer a discount** (e.g. 10% off first
  payment) in addition to the trial, to lift referee conversion? Trivial to add
  later — it's just editing `config.discounts`.
- **`welcomeMessage`** on the `referral` partner is unused (as for all partners);
  worth wiring into the landing heading instead of the ad-hoc
  `referrer-name` call?
