# B2B2C Partner Flow

Business partners (clinics, employers, health plans) receive a unique QR code / URL. When their end-users sign up through that link, they automatically receive a customised Stripe checkout — partner-configured trial period, group discount coupon, and plan selection applied without any user action.

The same mechanism powers **marketing campaign links** (see "Campaign links"), which can also customise the signup screens (first two and the last) and skip the web offer page.

---

## How it works end-to-end

```
Partner QR code → signup.hinora.co/p/sgh-family
                        │  (web SPA route on Vercel; the API also serves
                        │   /p/:slug as a 302 to SIGNUP_APP_URL/p/:slug)
                        ▼
              signup.hinora.co/p/sgh-family
                        │  (web SPA, PartnerLandingScreen — no visible UI)
                        │
              GET /api/partner/validate/sgh-family
              ← { name, trialDays, plans, welcomeMessage,
                   discounts: { monthly: {...}|null, yearly: {...}|null } }
                        │
              Saved into OnboardingContext (→ localStorage), then
              immediately redirected to signup.hinora.co/ (replace, no history entry)
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
              Server reads user.partner.config (even if the partner has since been
              deactivated), resolves discounts for the SELECTED plan only:
                - trial_period_days = config.trialDays
                - discounts = [{ coupon: discounts[plan].stripeCouponId }]  (if set for that plan
                  and the partner's expiresAt hasn't passed)
                - validates requested plan is in config.plans
                        │
              Stripe Checkout (discounted per the selected plan's own coupon)
                        │
              checkout.session.completed webhook → existing lifecycle
```

**Note:** the partner landing page (`PartnerLandingScreen`) used to show a partner-branded offer page with its own "Get Started" button. It no longer does — visiting `/p/:slug` now silently loads and saves the partner config, then redirects straight into the normal signup flow. This was a deliberate simplification; see "Web SPA changes" below.

---

## Campaign links

A **campaign** is a marketing signup link (e.g. one per ad, audience or channel): a `Partner` row with `kind = CAMPAIGN`. It reuses the whole partner pipeline (link + QR, attribution via `User.partnerId`, signup counter, optional trial/discount, users list), and adds three things, all stored in `config`:

| Setting | Effect |
|---|---|
| `landing` | Custom copy for the web signup screens — `headline`, `subtext`, `ctaText` (screen 1, `LandingScreen`), `accountTitle`, `accountSubtitle` (screen 2, `CreateAccountScreen`), `successTitle`, `successSubtitle` (last screen, `SuccessScreen` — "You're all set!" / download the app), plus an optional hero image (`imageKey`). Any blank field keeps the default copy/image. Available to partners too. |
| `skipSubscription` | Web signup never shows `/subscribe`: `SubscriptionScreen` redirects to `/success` (the "download the app" page), so there's no web trial or checkout. Users can still subscribe later in the mobile app at standard pricing. |
| `campaignRules` | `{ title, content }`, campaigns only. Campaign signups must tick a consent checkbox on `/create-account`: "I am the parent or legal guardian of the participating child, and I agree to the [*title*] and Nora Parenting's standard Terms of Service and Privacy Policy." The title opens a pop-up with `content` (plain text, line breaks kept). No content → `null`, and the checkbox omits the rules part. Limits: title 120, content 20,000. Returned by the public validate API only for `kind = CAMPAIGN`. |
| `displayName` | Public name on the subscribe page ("Special discount for X"). A campaign's `name` is internal and is **never** sent to the browser; with no `displayName` the badge just says "Special discount". Partners fall back to `name`. |

Links are the same `/p/<slug>` format as partners. See "Launch a campaign" in the runbook.

### Messages and channels

One campaign row is **one offer** (trial, discounts, `skipSubscription`, rules, cap, expiry). To A/B different copy and track different ad channels you don't create more rows:

| Dimension | How | Stored as |
|---|---|---|
| **Message** (copy variant) | `CampaignMessage` child row with its own `key`, internal `name`, `landing` (same shape as `config.landing`) and hero image. Link: `/p/<slug>/<key>` | `User.campaignMessageId` |
| **Channel** | Free-form `?src=<channel>` on any link — no setup. Normalised to lowercase `a-z0-9_-`, max 40 chars (`Face Book` → `face-book`) | `User.signupSource` |

So 3 messages × 2 channels = 1 campaign + 3 messages, giving 6 links like `signup.hinora.co/p/oct-challenge/tantrums?src=instagram`. Editing a message updates it for every channel.

- **Copy inheritance** — a message's blank landing field (and image) falls back to the campaign's `config.landing`, then to the app default. The plain `/p/<slug>` link is the "Default" message (the campaign's own copy).
- **Key** — `a-z0-9-`, max 40, unique per campaign, immutable (it's in published links).
- **Archive** — `active = false`. Its links keep working but show the campaign's default copy, and new signups aren't attributed to the message. There is no hard delete (signed-up users reference it).
- **Unknown / archived key** → validate returns `messageKey: null` and the default copy; the user is still attributed to the campaign.
- **Message images** — S3 `partners/<slug>/<key>/hero-<timestamp>.<ext>`.
- **Visits** — every validate call also upserts `CampaignVisit(partnerId, messageKey, source)` (`''` = default message / no `src`), alongside the raw `Partner.visits` total. Visits from before this tracking existed are only in the total.
- **Stickiness** — the resolved `messageKey`/`source` are stored inside `partnerInfo` in localStorage, so a returning visitor stays attributed to the same message and channel. Referral links override them, like the rest of `partnerInfo`.
- Works for `PARTNER` rows too (e.g. a clinic poster vs. a newsletter), though the main use is campaigns.

Migration: `20261001140000_add_campaign_messages_and_sources` (adds `CampaignMessage`, `CampaignVisit`, `User.campaignMessageId`, `User.signupSource`).

**Partner vs campaign** — `kind` only changes defaults and labelling; both kinds support every setting:

| | Partner (`PARTNER`) | Campaign (`CAMPAIGN`) |
|---|---|---|
| Typical use | Clinic, employer, health plan | Ad, social post, newsletter, event |
| `name` | Public — shown on the subscribe page unless `displayName` is set | Internal label only, never sent to the browser |
| Admin | Counted in "active partners"; Partners filter | Purple CAMPAIGN tag; counted in "active campaigns"; Campaigns filter |

**Campaign signup flow:**

```
signup.hinora.co/p/oct-toddlers[/<messageKey>][?src=<channel>]
      │  PartnerLandingScreen (no UI): GET /api/partner/validate/oct-toddlers?m=<messageKey>&src=<channel>
      │  → visits += 1 (+ CampaignVisit per message × channel)
      │  → { name: displayName|null, kind, skipSubscription, landing{…, imageUrl} (message merged over campaign),
      │      messageKey, source, offer… }
      │  → saved to OnboardingContext / localStorage, redirect to /
      ▼
/  LandingScreen         — landing.headline / subtext / ctaText / imageUrl (else defaults)
/intro                   — advisor intro (AdvisorIntroScreen, web port of mobile OB2); all signups
/create-account          — landing.accountTitle / accountSubtitle (else defaults); signup sends partnerSlug,
                           campaignMessageKey, signupSource
                           → User.partnerId / campaignMessageId / signupSource set, redemptions += 1
onboarding → play sessions
/subscribe               — skipSubscription ? redirect to /success : offer page (trial/discounts as partners)
/success                 — landing.successTitle / successSubtitle (else defaults)
```

**Hero image** — uploaded via `POST /api/admin/partners/:id/landing-image` (multipart `image`, ≤10 MB) to S3 `partners/<slug>/hero-<timestamp>.<ext>`; `DELETE` on the same path reverts to the default image (the S3 object is kept, since a duplicated campaign may share it). The public API returns a presigned `imageUrl` (1h); the web app falls back to the default image if it fails to load. Text limits (server-enforced, `server/utils/partnerLanding.cjs`): headline 120, subtext 300, button 40, account title 80, account subtitle 300, success title 80, success message 300, display name 80.

**Visits** — `Partner.visits` counts successful `GET /api/partner/validate/:slug` calls (i.e. link opens, including referral-link opens on the `referral` row). The admin table shows visits, signups, and signup conversion %. It's a raw counter: refreshes, bots and link-preview crawlers that run JS can inflate it slightly.

Note that the campaign config (incl. copy) is saved in the browser's `localStorage`, so someone who opened a campaign link and later returns to `signup.hinora.co` directly still sees the campaign copy and is still attributed to it — same as partner links. A referral link (`/join/:code`) overrides it, and screen 2 always shows the referral copy for referred users.

Migration: `20261001120000_add_partner_kind_and_visits` (adds `Partner.kind` enum `PARTNER|CAMPAIGN`, default `PARTNER`, and `Partner.visits`).

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
  kind        PartnerKind   @default(PARTNER) // PARTNER | CAMPAIGN
  redemptions Int           @default(0) // signup counter
  visits      Int           @default(0) // link opens (successful validate calls)
  qrCodeUrl   String?                  // S3 key partners/<slug>/qr.png (presigned on read)
  createdAt   DateTime      @default(now())
  users       User[]
}

enum PartnerStatus { ACTIVE  PAUSED  EXPIRED }

// Added to User:
partnerId  String?
partner    Partner? @relation(...)
```

Migrations: `20260701000000_add_partner`, `20260729024440_add_partner_qr_code_url`, `20260828130000_seed_referral_partner`, `20261001120000_add_partner_kind_and_visits`.

### Reserved `referral` partner

`20260828130000_seed_referral_partner` inserts a partner with slug `referral` (30-day trial, no discounts). Users who sign up via a referral link (and no partner link) are attached to it, so they get the referral trial through the same checkout pipeline; per-referrer attribution lives in the `Referral` table (see `doc/implementation/unified-referral-partner.md`). It appears on the admin Partners page labelled "Reserved"; editing its trial changes the referral offer, and deactivating it stops referred users getting the trial (the portal warns before doing so). Its `redemptions` counts referred signups.

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
  displayName?: string | null;                // public name on the subscribe page (see Campaign links)
  skipSubscription?: boolean;                 // skip /subscribe in web signup
  campaignRules?: { title: string | null; content: string } | null; // consent-checkbox rules (campaigns)
  landing?: {                                 // custom signup copy; null fields = default
    headline: string | null; subtext: string | null; ctaText: string | null;
    accountTitle: string | null; accountSubtitle: string | null;
    successTitle: string | null; successSubtitle: string | null;
    imageKey: string | null;                  // S3 key; set only via the landing-image endpoints
  } | null;
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
| Change `expiresAt` or `maxRedemptions` | Every discounted plan's coupon is recreated — both values are baked into the coupon as `redeem_by` / `max_redemptions`, so a stale coupon would otherwise be rejected by Stripe at checkout |
| Update partner without changing a plan's discount or the limits | That plan's existing coupon unchanged |
| Untick a plan under "Available plans" | That plan's discount is dropped (no coupon for a plan that isn't offered) |
| Deactivate partner (status=EXPIRED) | Coupons left in Stripe; already-signed-up users can still check out with them |

Change detection ignores key order and `stripeCouponId`. Note `max_redemptions` on a coupon counts **checkouts on that plan**, whereas the partner cap counts **signups** — the signup cap is the real limit.

The coupon is attached to the checkout session via `session.discounts`, not to the subscription directly.

---

## URL / QR code

The partner link is `${SIGNUP_APP_URL}/p/<slug>` (prod: `https://signup.hinora.co/p/sgh-family`), built by `buildPartnerUrl()` in `server/utils/partnerQr.cjs`. The API returns it as `signupUrl` on every admin partner response, and the portal's **Copy** button and QR modal both use it, so the copied link always matches the QR code for the environment you're viewing.

**QR code** — generated automatically on create: a 512px PNG of `signupUrl`, uploaded to S3 at `partners/<slug>/qr.png`, stored in `Partner.qrCodeUrl` and served as a presigned URL. Generation is best-effort (a failure never blocks create). Use **QR → Generate / Regenerate** in the portal to backfill or refresh one (`POST /api/admin/partners/:id/qr-code`). The App Runner role needs S3 access to the `partners/*` prefix.

---

## Access gates

**Deactivating a partner only blocks new signups.** Users already attributed to it keep its trial length, plan list and discount at checkout (`stripe.cjs` does not gate on partner status). After the partner's `expiresAt` the discount is no longer applied (its coupon's `redeem_by` has passed), but the trial length still is.

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
| `GET /api/partner/validate/:slug?m=<messageKey>&src=<channel>` | none | Validate slug + return display info. Returns 404 if not found / PAUSED / EXPIRED, 410 if cap reached or expired. `m` and `src` are optional (see "Messages and channels"). |

Each successful call also increments `Partner.visits` and the matching `CampaignVisit` row. The response also carries `messageKey` (resolved active message, else `null`), `source` (normalised channel, else `null`) and, for campaigns, `campaignRules`; `landing` is the message's copy merged over the campaign's.

Response:
```json
{
  "name": "SGH Family Medicine",
  "kind": "PARTNER",
  "skipSubscription": false,
  "landing": null,
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
| `/api/admin/partners` | GET | List all partners |
| `/api/admin/partners` | POST | Create partner + auto-create Stripe coupon(s) for whichever plans have a discount |
| `/api/admin/partners/:id` | GET | Single partner detail |
| `/api/admin/partners/:id` | PATCH | Update config / status; re-creates a plan's coupon only if that plan's discount (or the expiry/cap) changed |
| `/api/admin/partners/:id` | DELETE | Soft-deactivate (sets status=EXPIRED) |
| `/api/admin/partners/:id/qr-code` | POST | (Re)generate the QR code |
| `/api/admin/partners/:id/users` | GET | Users attributed to the partner, with subscription status |
| `/api/admin/partners/:id/landing-image` | POST | Upload/replace the signup hero image (multipart `image`) |
| `/api/admin/partners/:id/landing-image` | DELETE | Revert to the default signup image |
| `/api/admin/partners/:id/messages` | POST | Create a message `{ key, name, landing }` → updated partner |
| `/api/admin/partners/:id/messages/:messageId` | PATCH | `{ name?, landing?, active? }` (key is immutable) → updated partner |
| `/api/admin/partners/:id/messages/:messageId/landing-image` | POST / DELETE | Upload / remove the message's hero image (falls back to the campaign's) |
| `/api/admin/partners/:id/link?m=&src=` | GET | `{ url, source, qrDataUrl }` for one message × channel (QR not stored) |
| `/api/admin/partners/:id/stats` | GET | `{ totalVisits, rows: [{ messageKey, source, visits, signups }] }` (`''` = default / no src) |

Partner responses include `messages: [{ id, key, name, landing, active, createdAt, landingImageUrl }]`. The users list also returns `messageKey` and `signupSource` per user.

Every partner response (list, get, create, update, qr-code) has the same shape: the row plus `config.discounts` (normalized per-plan), presigned `qrCodeUrl`, `signupUrl`, `landingImageUrl` (presigned preview of the hero image), `userCount` and `discountLabels: {monthly, yearly}`. Create/update also accept `kind`, `displayName`, `skipSubscription` and `landing` (text fields; `landing.imageKey` is honored on create only, for Duplicate). Over-limit text returns 400.

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

`slug` is immutable after creation. `discounts.<plan>.stripeCouponId` is always set by the server — omit it from requests. On a PATCH, an omitted field is left unchanged and `null` clears it — e.g. `{ "maxRedemptions": null, "expiresAt": null, "welcomeMessage": null }` makes the partner unlimited with no expiry. Omitting `discounts` leaves existing discounts untouched. A discount for a plan not in `plans` is dropped.

---

## Admin portal

**Partners & Campaigns page** (`/partners` in the admin portal):

- **Create** — **+ New Partner** or **+ New Campaign** opens the same form with `kind` preset (switchable via the Type radio); all config fields; the slug is typed manually (lowercased, anything outside `a-z0-9-` becomes `-`)
- **Public display name** — optional; placeholder explains the default (partner name, or hidden for campaigns)
- **Skip the subscription / offer page** — checkbox for `skipSubscription`; when ticked, trial days are disabled and the plans/discounts blocks are hidden (they'd never be shown)
- **Signup screen messages** — hero image (upload/replace, or **Use default image**; a new file uploads on save), headline, subtext, button text (screen 1), title, subtitle (screen 2) and title, message (last screen — "You're all set!"). Blank fields show the default copy greyed out; line breaks are kept; per-field character limits match the server. A **phone preview** of all three screens updates live
- **Campaign rules** (campaigns only) — rules title (e.g. "21-Day Challenge Campaign Rules") and content for the create-account consent checkbox; empty content drops the rules part
- **Duplicate** — opens the create form pre-filled from a row (offer, messages, hero image; name gets "(copy)", slug blank)
- **Filter** — All / Partners / Campaigns tabs with counts; campaigns carry a purple CAMPAIGN tag
- **Funnel column** — visits, signups (vs cap) and signup conversion % (`redemptions / visits`), plus attributed user count
- **Edit** — same form, slug is read-only; each plan's discount block is independent — editing yearly's discount doesn't touch monthly's, and vice versa. Emptying Max redemptions, Expires or Welcome message clears them
- **Discounts** — one block per plan currently checked under "Available plans"; each has its own "Apply a discount" toggle, type (percent/amount), amount, and duration
- **Copy / QR** — copy the partner's `signupUrl`, or open the QR modal (view, open, generate/regenerate)
- **Table** — shows offer summary (trial days, plans — or "No offer page (skipped)"), a discount line per plan that has one, signups vs cap, attributed user count (click to list them with subscription status), status badge, created date
- **Messages, links & stats** (link under each row's slug) — modal with three tabs:
  - **Messages** — Default (the row's own copy) plus each message variant: name, `/p/<slug>/<key>` link, headline, signups; **+ New message**, **Edit**, **Duplicate**, **Archive/Restore**. The editor is the same copy/image/phone-preview editor as the main form, with the campaign's copy as greyed-out placeholders
  - **Link builder** — pick messages and channels (presets: facebook, instagram, tiktok, whatsapp, google, email, plus any custom one) → a table of every message × channel link with **Copy** / **QR** (QR generated on the fly, downloadable PNG), and **Copy all** (tab-separated, pastes into a sheet)
  - **Stats** — grid of messages × channels, each cell `signups / visits (conversion %)`, with totals
- **Users modal** — also shows each user's message and channel
- **Deactivate / Reactivate** — Deactivate sets status=EXPIRED (new signups blocked; signed-up users keep their offer). Reactivate sets it back to ACTIVE
- **Env toggle** — the portal can target the dev or prod API; the PROD badge shows which

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

interface SignupLanding {        // campaign signup copy; null = default
  headline: string | null;
  subtext: string | null;
  ctaText: string | null;
  imageUrl: string | null;       // presigned, ~1h
  accountTitle: string | null;
  accountSubtitle: string | null;
  successTitle: string | null;
  successSubtitle: string | null;
}

interface PartnerInfo {
  slug: string;
  name: string | null;           // public display name; null for a campaign without one
  kind?: 'PARTNER' | 'CAMPAIGN';
  skipSubscription?: boolean;
  landing?: SignupLanding | null;
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

**`LandingScreen`** — uses `partnerInfo.landing` `headline` / `subtext` / `ctaText` / `imageUrl` when set, else the default copy and image. Line breaks in custom copy are preserved (`whitespace-pre-line`). If the presigned hero image fails to load (e.g. expired after ~1h in a stale tab), it falls back to the default image.

**`AdvisorIntroScreen`** (`/intro`) — web port of the mobile `OB2Screen_v2` (clinical advisor intro, same `OB-2_v2.png` art as `advisor.png` with text overlaid). Shown in every web signup (campaign, partner, referral and direct): `LandingScreen`'s CTA goes here, and `CreateAccountScreen`'s back button returns here.

**`CreateAccountScreen`** — for campaigns (not referrals), the footer "By creating an account…" line is replaced by a required consent checkbox (parent/guardian + campaign rules + Terms/Privacy); **Create Account** stays disabled until it's ticked. The rules title opens `campaignRules.content` in a pop-up. The consent is not recorded server-side. Title/subtitle come from `partnerInfo.landing.accountTitle` / `accountSubtitle` when set, except for referred users (`referralCode` set), who always see the referral copy. Passes `partnerSlug: data.partnerInfo?.slug` in the signup payload. It's also now the **first** screen after Landing (see flow-order change below), so `partnerInfo` (if any) is already set by the time this fires.

**`SuccessScreen`** — title/message come from `partnerInfo.landing.successTitle` / `successSubtitle` when set (except for referred users, as on `CreateAccountScreen`), else "You're all set!" and the default download-the-app message.

**`SubscriptionScreen`** — if `partnerInfo.skipSubscription` is true, it renders `<Navigate to="/success" replace />`, so every route into `/subscribe` (Intro3 "Skip for Now", PlaySession5 "Continue") lands on the download page instead. Otherwise, when `partnerInfo` is set, each plan card is independent:
- Filters plan cards to `partnerInfo.plans` only
- Each plan shows its **own** discount (or none) — strikethrough original price + discounted price, computed client-side with the same percentOff/amountOff math Stripe's checkout applies, so the display isn't just a promise
- Each plan's top-left badge shows "Special discount for {partner name}: X% off" (just "Special discount: X% off" when `name` is null) if that specific plan has a discount, otherwise Yearly falls back to the generic "BEST VALUE · SAVE X%" badge (Monthly has no fallback badge)
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
5. Click **Copy** next to the partner's slug to get `signup.hinora.co/p/hospital-name`
6. Click **QR** to open the auto-generated QR code (use **Generate** if it's missing), then **Open in new tab** to save it
7. Hand off URL / QR code to partner

### Launch a campaign

1. Admin portal → Partners → **+ New Campaign** (or **Duplicate** an existing campaign to reuse its offer, messages and image)
2. Fill: internal name (e.g. "Oct FB ad — toddler parents"; never shown to users), slug (e.g. `oct-toddlers`), optional public display name, cap and expiry
3. Choose the offer:
   - **No web offer** — tick **Skip the subscription / offer page**; users finish onboarding on the download page and subscribe in the app at standard pricing
   - **Web offer** — leave it unticked and set trial days, plans and per-plan discounts as for a partner
4. Optionally customise **Signup screen messages** (hero image, headline, subtext, button, create-account title/subtitle, last-screen title/message) and check the phone preview
5. **Create campaign**
6. To test several messages: **Messages, links & stats** → **Messages** → **+ New message** for each variant (key e.g. `tantrums`; only fill the fields that differ from the campaign's copy)
7. **Link builder** → tick the messages and channels you're running → **Copy** each link (or **Copy all**) into the matching ad. Need a new channel later? Just add it here — nothing to create
8. Track it in **Stats** (messages × channels), or the row's funnel column for the totals; click the user count for subscription status

Use one campaign per offer, not per ad: messages and `?src=` channels give the per-ad numbers. To change copy, edit the message once and every channel's link picks it up.

### Pause a partner temporarily

Admin portal → Partners → **Deactivate**. Sets status=EXPIRED. New visitors silently fall through to normal signup with no partner attached. Users who already signed up still get the partner offer at checkout.

To re-activate: **Reactivate** on the same row. If the partner's expiry date has passed, also clear or extend **Expires** via Edit, or the link will still be rejected.

### Change a partner's discount

Admin portal → Partners → **Edit** → update the specific plan's discount block → **Save changes**. The server archives that plan's old Stripe coupon and creates a new one — the other plan's coupon is untouched. The URL stays the same; subsequent signups get the new discount.

### Check usage

Partners table shows visits (link opens), redemptions (signup count) vs cap with conversion %, and user count — every user currently attributed to the partner, whether or not they subscribed. Click the user count to see each user's subscription status (TRIAL / ACTIVE / INACTIVE…). Deleted accounts are excluded from the user count but not from redemptions, so redemptions can be higher.

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
