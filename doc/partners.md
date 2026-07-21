# B2B2C Partner Flow

Business partners (clinics, employers, health plans) receive a unique QR code / URL. When their end-users sign up through that link, they automatically receive a customised Stripe checkout — partner-configured trial period, group discount coupon, and plan selection applied without any user action.

---

## How it works end-to-end

```
Partner QR code → hinora.co/p/sgh-family
                        │  (Express redirect)
                        ▼
              hinora.co/signup/p/sgh-family
                        │  (web SPA, PartnerLandingScreen — no visible UI)
                        │
              GET /api/partner/validate/sgh-family
              ← { name, trialDays, plans, welcomeMessage,
                   discounts: { monthly: {...}|null, yearly: {...}|null } }
                        │
              Saved into OnboardingContext (→ localStorage), then
              immediately redirected to hinora.co/signup/ (replace, no history entry)
                        │
              User clicks "Get Started" on the (undifferentiated) landing page
                        │
              /create-account
              POST /api/auth/signup { email, password, ..., partnerSlug: "sgh-family" }
              Server: validates partner (active? not expired? under cap?)
                      writes User.partnerId
                      increments Partner.redemptions
                        │
              Onboarding (name → ... → intro3) → Play sessions 1–5
                        │
              /subscribe  ← each plan card shows its OWN discount (if configured),
                             its own "Special discount for X" badge, and independent pricing
                        │
              POST /api/stripe/create-checkout-session { plan }
              Server reads user.partner.config, resolves discounts for the SELECTED plan only:
                - trial_period_days = config.trialDays
                - discounts = [{ coupon: discounts[plan].stripeCouponId }]  (if set for that plan)
                - validates requested plan is in config.plans
                        │
              Stripe Checkout (discounted per the selected plan's own coupon)
                        │
              checkout.session.completed webhook → existing lifecycle
```

**Note:** the partner landing page (`PartnerLandingScreen`) used to show a partner-branded offer page with its own "Get Started" button. It no longer does — visiting `/p/:slug` now silently loads and saves the partner config, then redirects straight into the normal signup flow. This was a deliberate simplification; see "Web SPA changes" below.

---

## Partner model

```prisma
model Partner {
  id          String        @id @default(uuid())
  slug        String        @unique    // URL token: "sgh-family"
  name        String                   // display name
  status      PartnerStatus @default(ACTIVE)
  config      Json                     // PartnerConfig — see below
  expiresAt   DateTime?                // optional hard expiry
  redemptions Int           @default(0) // signup counter
  createdAt   DateTime      @default(now())
  users       User[]
}

enum PartnerStatus { ACTIVE  PAUSED  EXPIRED }

// Added to User:
partnerId  String?
partner    Partner? @relation(...)
```

Migration: `prisma/migrations/20260701000000_add_partner/`

---

## PartnerConfig schema

The `config` column is a JSON object. All behaviour is driven by editing this field — no code change is needed to onboard a new partner or change their offer.

Discounts are configured **per plan** — `plans` controls which plans are offered at all, and `discounts.monthly` / `discounts.yearly` independently control whether (and how) each of those plans is discounted. A plan can be shown with no discount, both plans can have different discounts, or only one plan can have a discount at all.

```ts
interface PartnerDiscount {
  percentOff?:     number;                    // e.g. 20 = 20% off
  amountOff?:      number;                    // in cents (mutually exclusive with percentOff)
  currency?:       string;                    // required if amountOff set, default 'sgd'
  duration:        'once'|'repeating'|'forever';
  durationMonths?: number;                    // required if duration='repeating'
  stripeCouponId?: string;                    // auto-populated by server; do not set manually
}

interface PartnerConfig {
  trialDays:       number;                    // free trial length (default 7)
  plans:           ('monthly'|'yearly')[];    // which plans to show at checkout
  discounts: {
    monthly: PartnerDiscount | null;
    yearly:  PartnerDiscount | null;
  };
  welcomeMessage?: string;                    // stored + returned by the API, not currently rendered anywhere
  maxRedemptions?: number | null;             // null = unlimited
}
```

**Back-compat:** partners created before per-plan discounts existed still have the old shape — a single `config.discount` field shared across all plans, instead of `config.discounts`. `server/utils/partnerDiscount.cjs`'s `normalizeDiscounts(config)` reads either shape transparently (old configs are treated as if the shared discount applied to every plan listed in `config.plans`), so nothing needed to be manually migrated. The next time an admin saves that partner through the portal, it's rewritten in the new per-plan shape.

**Example configs:**

```jsonc
// 30-day trial, 20% off forever on yearly only, both plans shown
{
  "trialDays": 30, "plans": ["monthly","yearly"],
  "discounts": {
    "monthly": null,
    "yearly": { "percentOff": 20, "duration": "forever" }
  },
  "welcomeMessage": "Welcome, SGH partners!"
}

// 14-day trial, $10 off first payment on monthly, monthly only, 500-person cap
{
  "trialDays": 14, "plans": ["monthly"],
  "discounts": {
    "monthly": { "amountOff": 1000, "currency": "sgd", "duration": "once" },
    "yearly": null
  },
  "maxRedemptions": 500
}

// 90-day trial, different discounts on each plan
{
  "trialDays": 90, "plans": ["monthly", "yearly"],
  "discounts": {
    "monthly": { "percentOff": 10, "duration": "once" },
    "yearly": { "percentOff": 100, "duration": "repeating", "durationMonths": 3 }
  }
}

// Extended trial only, no discount on either plan
{
  "trialDays": 30, "plans": ["monthly","yearly"], "discounts": { "monthly": null, "yearly": null }
}
```

---

## Stripe coupon lifecycle

Each plan's discount gets its **own independent Stripe coupon** — a partner with discounts on both monthly and yearly has two separate coupons, named `"{partner name} Partner Discount (monthly)"` / `"(yearly)"`. The server auto-creates/re-creates these and stores each coupon ID in `config.discounts.<plan>.stripeCouponId`. Admins never touch Stripe directly.

Changing one plan's discount only touches that plan's coupon — editing the yearly discount does not recreate or affect the monthly coupon (`syncDiscounts()` in `server/routes/admin.cjs` diffs each plan independently).

| Admin action | Stripe effect |
|---|---|
| Create partner with a plan's discount | New coupon created for that plan, ID written to config |
| Update a plan's discount | That plan's old coupon archived (deleted), new coupon created |
| Update partner without changing a plan's discount | That plan's existing coupon unchanged |
| Deactivate partner (status=EXPIRED) | Coupons left in Stripe (existing users unaffected) |

The coupon is attached to the checkout session via `session.discounts`, not to the subscription directly.

---

## URL / QR code

| Format | URL |
|---|---|
| Short (QR-friendly) | `hinora.co/p/sgh-family` |
| Full (SPA route) | `hinora.co/signup/p/sgh-family` |

The short URL is an Express redirect (`302`) to the full SPA route. Use the short form on QR codes — it's shorter and survives future path changes.

---

## Access gates

Partner users go through the **same Stripe checkout** as self-serve users. After checkout, they are indistinguishable in the DB — their `subscriptionStatus` becomes `ACTIVE` (or `TRIAL`), and `isSubscribed` is computed server-side. The mobile app sees them as subscribed via the normal `isSubscribed` check.

`User.partnerId` is informational — used for attribution/reporting and to look up the discount config at checkout time. It does not gate access independently.

### If a partner user skips the subscription step

Both the web signup flow (`web/src/screens/SubscriptionScreen.tsx`, "Skip for Now") and the mobile onboarding flow (`nora-mobile/src/screens/onboarding/SubscriptionScreen.tsx`, "Continue with free version") let a user proceed without ever calling Stripe/RevenueCat. `subscriptionStatus` stays `INACTIVE` (its default at signup, `server/routes/auth.cjs:142`), so `isSubscribed` is `false` — a skipped partner user is not distinguishable from a skipped self-serve user.

- **Partner attribution is not lost, but the partner offer only applies via web Stripe checkout.** `partnerId` and the redemption count are written at signup time regardless of whether checkout happens (`auth.cjs:150`; see "Redemption counter" note above), and `subscriptionSource` is set to `'partner'` at signup (`auth.cjs:140`). The `trialDays`/discount config, however, is only ever read from `user.partner.config` inside the **web** checkout route (`server/routes/stripe.cjs:107,138,140`) — the mobile app's `SubscriptionScreen`/`SubscriptionContext` (RevenueCat) have no partner awareness at all (no `partnerId`/`trialDays`/`discount` references anywhere in that code path). So the partner's trial length and coupon are only honored if the user completes checkout on **web**; if they skip on web and later subscribe from the **mobile app**, they get RevenueCat's standard App Store/Play pricing and trial — the partner discount is lost, not just deferred.
- **Mobile falls back to the 3-free-session cap.** `RecordScreen.tsx`'s `FREE_SESSIONS_LIMIT = 3` gate is skipped entirely while `isSubscribed` is true, but for a skipped user it applies exactly as it would for a non-partner user. After 3 completed sessions, `RecordScreen` redirects to the mobile `SubscriptionScreen` — a generic RevenueCat paywall with no partner-specific pricing/trial shown. Tapping skip again there just bounces the user straight back — `@nora_free_limit_reached` is cached locally, so the gate re-triggers on the next visit to `RecordScreen` without needing to re-count sessions. The rest of the app (Lessons, Profile, etc.) stays accessible; only recording is blocked.
- **"Manage Subscription" routing depends on `subscriptionSource`, not partner status.** `ProfileScreen.tsx:219` sends the user to Stripe's Billing Portal only if `subscriptionSource === 'stripe'` (set only on a completed web Stripe checkout, `stripe.cjs:282`). A partner user who skipped web checkout has `subscriptionSource: 'partner'`, and one who later subscribes via mobile IAP has it overwritten to `'revenuecat'` (`webhooks.cjs:53`) — in both cases `!== 'stripe'`, so they always land on native Apple/Google subscription management instead, never the Stripe portal.

---

## API reference

### Public

| Endpoint | Auth | Description |
|---|---|---|
| `GET /api/partner/validate/:slug` | none | Validate slug + return display info. Returns 404 if not found / PAUSED / EXPIRED, 410 if cap reached or expired. |

Response:
```json
{
  "name": "SGH Family Medicine",
  "welcomeMessage": "Welcome, SGH partners!",
  "trialDays": 30,
  "plans": ["monthly", "yearly"],
  "discounts": {
    "monthly": null,
    "yearly": { "label": "20% off forever", "percentOff": 20, "amountOff": null }
  }
}
```

`discounts.<plan>.label` is a human-readable string computed from that plan's discount config, safe to display verbatim. `percentOff`/`amountOff` are the raw values, used by the client to compute and display the actual discounted price (not just show the label).

### Admin (requires admin JWT)

| Endpoint | Method | Description |
|---|---|---|
| `/api/admin/partners` | GET | List all partners (includes `userCount`, `discountLabels: {monthly, yearly}`) |
| `/api/admin/partners` | POST | Create partner + auto-create Stripe coupon(s) for whichever plans have a discount |
| `/api/admin/partners/:id` | GET | Single partner detail |
| `/api/admin/partners/:id` | PATCH | Update config; re-creates a plan's coupon only if that plan's discount changed |
| `/api/admin/partners/:id` | DELETE | Soft-deactivate (sets status=EXPIRED) |

**Create/update body:**
```json
{
  "slug": "sgh-family",
  "name": "SGH Family Medicine",
  "trialDays": 30,
  "plans": ["monthly", "yearly"],
  "discounts": {
    "monthly": null,
    "yearly": { "percentOff": 20, "duration": "forever" }
  },
  "welcomeMessage": "Welcome, SGH partners!",
  "maxRedemptions": 500,
  "expiresAt": "2027-12-31"
}
```

`slug` is immutable after creation. `discounts.<plan>.stripeCouponId` is always set by the server — omit it from requests. Omitting `discounts` entirely on a PATCH leaves existing discounts untouched.

---

## Admin portal

**Partners page** (`/partners` in the admin portal):

- **Create** — form with all config fields; slug is auto-suggested from name (lowercased, spaces → hyphens)
- **Edit** — same form, slug is read-only; each plan's discount block is independent — editing yearly's discount doesn't touch monthly's, and vice versa
- **Discounts** — one block per plan currently checked under "Available plans"; each has its own "Apply a discount" toggle, type (percent/amount), amount, and duration
- **URL copy** — one-click copy of the short partner URL (`hinora.co/p/:slug`)
- **Table** — shows offer summary (trial days, plans), a discount line per plan that has one, redemption count vs cap, user count, status badge, created date
- **Deactivate** — sets status=EXPIRED; existing users retain access, new signups are blocked

---

## Web SPA changes

**`PartnerLandingScreen`** (`web/src/screens/PartnerLandingScreen.tsx`) — **no visible UI**:
- Route: `/signup/p/:slug`
- Calls `/api/partner/validate/:slug` on mount
- On success, saves `PartnerInfo` into `OnboardingContext` (→ `localStorage`)
- Always redirects to `/` (`navigate('/', { replace: true })`) whether validation succeeded or failed — an invalid/expired slug just falls through to the normal signup flow with no partner attached, rather than showing an error dead-end. `replace` means the partner-link URL never sits in browser history.
- This used to render a partner-branded landing page with its own "Get Started" button and offer highlights; that was removed in favor of the silent-redirect-into-normal-flow behavior described above.

**`OnboardingContext`** — `partnerInfo` field, now with per-plan discounts:
```ts
interface PlanDiscountInfo {
  label: string;
  percentOff: number | null;
  amountOff: number | null; // cents
}

interface PartnerInfo {
  slug: string;
  name: string;
  welcomeMessage: string | null;
  trialDays: number;
  plans: ('monthly' | 'yearly')[];
  discounts: {
    monthly: PlanDiscountInfo | null;
    yearly: PlanDiscountInfo | null;
  };
}
```

Persisted to `localStorage` under key `partnerInfo`. Cleared when set to null. Since this is set by `PartnerLandingScreen` *before* the redirect to `/`, it's already available by the time the user reaches `/create-account` and `/subscribe`, regardless of the fact that visiting `/p/:slug` no longer shows its own screen.

**`CreateAccountScreen`** — passes `partnerSlug: data.partnerInfo?.slug` in the signup payload. It's also now the **first** screen after Landing (see flow-order change below), so `partnerInfo` (if any) is already set by the time this fires.

**`SubscriptionScreen`** — when `partnerInfo` is set, each plan card is independent:
- Filters plan cards to `partnerInfo.plans` only
- Each plan shows its **own** discount (or none) — strikethrough original price + discounted price, computed client-side with the same percentOff/amountOff math Stripe's checkout applies, so the display isn't just a promise
- Each plan's top-left badge shows "Special discount for {partner name}: X% off" if that specific plan has a discount, otherwise Yearly falls back to the generic "BEST VALUE · SAVE X%" badge (Monthly has no fallback badge)
- For partner customers with a yearly discount, both the crossed-out "original" per-month price and the discounted "offer" price on the Yearly card are derived from the **yearly plan's own base price** (yearly amount ÷ 12), before and after the discount respectively
- Replaces "7 days free" with the partner's trial days throughout
- Footer copy shows the discount label only for whichever plan is currently selected

---

## Validation and error handling

| Condition | Response |
|---|---|
| Slug not found | 404 |
| Partner status is PAUSED or EXPIRED | 404 |
| `expiresAt` in the past | 410 |
| `maxRedemptions` reached | 410 |
| Signup with expired/paused slug | 400 (ValidationError) |
| Signup with slug over cap | 400 (ValidationError) |
| Checkout with plan not in `config.plans` | 400 |
| `STRIPE_SECRET_KEY` not set when creating coupon | 500 (server startup issue) |

Redemption counter is incremented **at signup time**, not at checkout completion. A user who signs up through a partner link but never completes checkout still counts against the cap. This prevents cap bypass via multiple signups.

---

## Operational runbook

### Onboard a new partner

1. Admin portal → Partners → **+ New Partner**
2. Fill: name, slug (e.g. `hospital-name`), trial days, available plans, optional cap + expiry
3. For each available plan you want discounted, tick **Apply a discount** in that plan's block and fill in its type/amount/duration
4. Click **Create partner** — a Stripe coupon is auto-created per discounted plan
5. Click **Copy** next to the partner's slug to get `hinora.co/p/hospital-name`
6. Generate a QR code from that URL (any QR generator; encode as-is)
7. Hand off URL / QR code to partner

### Pause a partner temporarily

Admin portal → Partners → **Deactivate**. Sets status=EXPIRED. The URL returns 404 for new visitors. Existing users are unaffected.

To re-activate: `PATCH /api/admin/partners/:id` with `{ "status": "ACTIVE" }` (direct API call for now — re-activate button can be added to the portal later).

### Change a partner's discount

Admin portal → Partners → **Edit** → update the specific plan's discount block → **Save changes**. The server archives that plan's old Stripe coupon and creates a new one — the other plan's coupon is untouched. The URL stays the same; subsequent signups get the new discount.

### Check usage

Partners table shows redemptions (signup count) vs cap, and user count (those who completed checkout). The gap between the two is users who signed up but haven't subscribed yet.

---

## Pending decisions

### Partner users silently losing their offer via mobile IAP

**Problem:** if a partner user skips checkout on web and later subscribes from the mobile app instead, they get RevenueCat's standard App Store/Play pricing and trial — the partner's discount and custom trial length are silently lost, not just deferred (see "If a partner user skips the subscription step" above). Today the mobile app has no way to even detect this case: `GET /api/auth/me` (`server/routes/auth.cjs:558-583`) doesn't select `partnerId`, and the shared `User` type (`packages/nora-core/src/types/index.ts:21-50`) doesn't have a `partnerId`/`partner` field either — so `nora-mobile/src/screens/onboarding/SubscriptionScreen.tsx` can't tell a partner user apart from a self-serve one before showing the generic RevenueCat paywall.

**Industry-standard fix:** don't try to replicate the Stripe coupon/trial inside RevenueCat (that requires App Store Promotional Offers / Play offer codes — signed per-product offers generated server-side, real ongoing engineering). Instead, gate the in-app purchase button for partner-attributed users who haven't completed web checkout and redirect them back to finish it there, which is the standard way sponsored/enterprise subscriptions are handled outside platform IAP.

**Where the gate would go (traced, not yet implemented):**
1. `server/routes/auth.cjs:558-583` — add `partnerId` (and a `partner: { slug, name }` include) to the `/api/auth/me` select.
2. `packages/nora-core/src/types/index.ts:21-50` — add `partnerId`/`partner` to the `User` type; also fix `subscriptionSource`'s type union, which is missing the `'partner'` literal that `auth.cjs:140` actually assigns at signup.
3. `nora-mobile/src/screens/onboarding/SubscriptionScreen.tsx:93-104` — in the `else` branch (currently just `setCheckingFreeAccount(false)`, falling through to the standard paywall), branch on `partnerId` set + `subscriptionSource !== 'stripe'` to show a different state instead.
4. `nora-mobile/src/screens/ProfileScreen.tsx:120-148` (`loadProfile`) — same field-whitelisting pattern; would need the same fields added if the Profile tab should also reflect a pending partner offer.

**Scope options, not yet decided:**
- **Scoped-down:** keep the same detection, but just block/warn on the existing paywall (e.g. an `Alert` plus a link out to web signup) rather than build a bespoke screen. Minimal effort.
- **Full treatment:** replace the paywall with a dedicated partner-offer view (partner name/branding, actual discount/trial pulled from `GET /api/partner/validate/:slug`, custom copy). More design/engineering work for what's likely a small volume of users.

No implementation has started on this — flagging so it isn't forgotten before a partner user actually hits it in practice.
