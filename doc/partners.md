# B2B2C Partner Flow

Business partners (clinics, employers, health plans) receive a unique QR code / URL. When their end-users sign up through that link, they automatically receive a customised Stripe checkout — partner-configured trial period, group discount coupon, and plan selection applied without any user action.

---

## How it works end-to-end

```
Partner QR code → hinora.co/p/sgh-family
                        │  (Express redirect)
                        ▼
              hinora.co/signup/p/sgh-family
                        │  (web SPA, PartnerLandingScreen)
                        │
              GET /api/partner/validate/sgh-family
              ← { name, trialDays, plans, discountLabel, welcomeMessage }
                        │
              User sees partner-branded landing page
              Clicks "Get Started"
                        │
              /create-account
              POST /api/auth/signup { email, password, ..., partnerSlug: "sgh-family" }
              Server: validates partner (active? not expired? under cap?)
                      writes User.partnerId
                      increments Partner.redemptions
                        │
              Onboarding (unchanged)
                        │
              /subscribe  ← shows partner trial days + discount badge
                           shows only plans allowed by partner config
                        │
              POST /api/stripe/create-checkout-session
              Server reads user.partner.config:
                - trial_period_days = config.trialDays
                - discounts = [{ coupon: config.discount.stripeCouponId }]
                - validates requested plan is in config.plans
                        │
              Stripe Checkout (discounted)
                        │
              checkout.session.completed webhook → existing lifecycle
```

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

```ts
interface PartnerConfig {
  trialDays:       number;                    // free trial length (default 7)
  plans:           ('monthly'|'yearly')[];    // which plans to show at checkout
  discount: {
    percentOff?:   number;                    // e.g. 20 = 20% off
    amountOff?:    number;                    // in cents (mutually exclusive with percentOff)
    currency?:     string;                    // required if amountOff set, default 'sgd'
    duration:      'once'|'repeating'|'forever';
    durationMonths?: number;                  // required if duration='repeating'
    stripeCouponId?: string;                  // auto-populated by server; do not set manually
  } | null;
  welcomeMessage?: string;                    // shown on partner landing page
  maxRedemptions?: number | null;             // null = unlimited
}
```

**Example configs:**

```jsonc
// 30-day trial, 20% off forever, both plans
{
  "trialDays": 30, "plans": ["monthly","yearly"],
  "discount": { "percentOff": 20, "duration": "forever" },
  "welcomeMessage": "Welcome, SGH partners!"
}

// 14-day trial, $10 off first payment, monthly only, 500-person cap
{
  "trialDays": 14, "plans": ["monthly"],
  "discount": { "amountOff": 1000, "currency": "sgd", "duration": "once" },
  "maxRedemptions": 500
}

// 90-day trial, 100% off for 3 months (free quarter), yearly only
{
  "trialDays": 90, "plans": ["yearly"],
  "discount": { "percentOff": 100, "duration": "repeating", "durationMonths": 3 }
}

// Extended trial only, no discount
{
  "trialDays": 30, "plans": ["monthly","yearly"], "discount": null
}
```

---

## Stripe coupon lifecycle

When a partner is created or its discount config changes, the server **auto-creates a Stripe coupon** and stores the coupon ID in `config.discount.stripeCouponId`. Admins never touch Stripe directly.

| Admin action | Stripe effect |
|---|---|
| Create partner with discount | New coupon created, ID written to config |
| Update partner with changed discount | Old coupon archived (deleted), new coupon created |
| Update partner without changing discount | Existing coupon unchanged |
| Deactivate partner (status=EXPIRED) | Coupon left in Stripe (existing users unaffected) |

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
  "discountLabel": "20% off forever"
}
```

`discountLabel` is a human-readable string computed from the discount config. It is safe to display verbatim.

### Admin (requires admin JWT)

| Endpoint | Method | Description |
|---|---|---|
| `/api/admin/partners` | GET | List all partners (includes `userCount`, `discountLabel`) |
| `/api/admin/partners` | POST | Create partner + auto-create Stripe coupon |
| `/api/admin/partners/:id` | GET | Single partner detail |
| `/api/admin/partners/:id` | PATCH | Update config; re-creates coupon if discount changed |
| `/api/admin/partners/:id` | DELETE | Soft-deactivate (sets status=EXPIRED) |

**Create/update body:**
```json
{
  "slug": "sgh-family",
  "name": "SGH Family Medicine",
  "trialDays": 30,
  "plans": ["monthly", "yearly"],
  "discount": {
    "percentOff": 20,
    "duration": "forever"
  },
  "welcomeMessage": "Welcome, SGH partners!",
  "maxRedemptions": 500,
  "expiresAt": "2027-12-31"
}
```

`slug` is immutable after creation. `discount.stripeCouponId` is always set by the server — omit it from requests.

---

## Admin portal

**Partners page** (`/partners` in the admin portal):

- **Create** — form with all config fields; slug is auto-suggested from name (lowercased, spaces → hyphens)
- **Edit** — same form, slug is read-only; discount changes trigger coupon re-creation
- **URL copy** — one-click copy of the short partner URL (`hinora.co/p/:slug`)
- **Table** — shows offer summary (trial days, plans, discount label), redemption count vs cap, user count, status badge, created date
- **Deactivate** — sets status=EXPIRED; existing users retain access, new signups are blocked

---

## Web SPA changes

**`PartnerLandingScreen`** (`web/src/screens/PartnerLandingScreen.tsx`):
- Route: `/signup/p/:slug`
- Calls `/api/partner/validate/:slug` on mount
- Shows partner name, welcome message, offer highlights (trial days, discount label)
- Stores `PartnerInfo` (slug + config) in `OnboardingContext` and `localStorage` — survives page refresh across the flow
- Invalid/expired slug shows an error state with a link to the standard signup

**`OnboardingContext`** — new `partnerInfo` field:
```ts
interface PartnerInfo {
  slug: string;
  name: string;
  welcomeMessage: string | null;
  trialDays: number;
  plans: ('monthly' | 'yearly')[];
  discountLabel: string | null;
}
```

Persisted to `localStorage` under key `partnerInfo`. Cleared when set to null.

**`CreateAccountScreen`** — passes `partnerSlug: data.partnerInfo?.slug` in the signup payload.

**`SubscriptionScreen`** — when `partnerInfo` is set:
- Filters plan cards to `partnerInfo.plans` only
- Replaces "7 days free" with the partner's trial days throughout
- Shows a discount badge in the header
- Button label and footer copy reflect the actual trial length

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
2. Fill: name, slug (e.g. `hospital-name`), trial days, discount config, optional cap + expiry
3. Click **Create partner** — Stripe coupon is auto-created
4. Click **Copy** next to the partner's slug to get `hinora.co/p/hospital-name`
5. Generate a QR code from that URL (any QR generator; encode as-is)
6. Hand off URL / QR code to partner

### Pause a partner temporarily

Admin portal → Partners → **Deactivate**. Sets status=EXPIRED. The URL returns 404 for new visitors. Existing users are unaffected.

To re-activate: `PATCH /api/admin/partners/:id` with `{ "status": "ACTIVE" }` (direct API call for now — re-activate button can be added to the portal later).

### Change a partner's discount

Admin portal → Partners → **Edit** → update discount fields → **Save changes**. The server archives the old Stripe coupon and creates a new one. The URL stays the same; subsequent signups get the new discount.

### Check usage

Partners table shows redemptions (signup count) vs cap, and user count (those who completed checkout). The gap between the two is users who signed up but haven't subscribed yet.
