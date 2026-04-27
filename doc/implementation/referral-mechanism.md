# Referral Mechanism Implementation Plan

**Date:** 2026-04-26  
**Domain:** `hinora.co`  
**Mobile app:** `nora-mobile/`  
**Backend:** `server/` (Express + Prisma + PostgreSQL)

---

## Overview

When User A refers User B:
1. A shares a personalised link: `https://hinora.co/join/NORA-A1B2`
2. B opens the link → web landing page (personalised with A's name)
3. B signs up on the web page (email + password) → account created, referral recorded server-side
4. B downloads the app → logs in → completes onboarding
5. B's 1-month free trial runs via RevenueCat / Apple
6. When B first becomes a paying customer, the server calls the **RevenueCat Grant Promotional Entitlement API** to give A 1 free month
7. A receives a push notification: "Your friend just subscribed — you earned 1 free month!"

**No deferred deep links (Branch.io) needed.** The web sign-up captures the referral before the App Store install.

**Apple compliance:** Reward is a RevenueCat promotional entitlement grant — no discount on Apple IAP pricing, no cash rewards.

---

## Key design decisions

| Decision | Choice | Reason |
|---|---|---|
| Referral capture method | Web sign-up before install | 100% reliable, no Branch.io needed |
| Web form fields | Email + password only | App onboarding handles the rest; existing `checkOnboardingCompletion()` resumes from `NameInput` |
| Reward trigger | B's first non-trial payment (`RENEWAL` from TRIAL, or `INITIAL_PURCHASE` without trial) | Covers all payment paths |
| Reward mechanism | RevenueCat Grant Promotional Entitlement REST API | App checks RevenueCat exclusively for access — backend `subscriptionEndDate` alone does not grant access |
| Code format | `NORA-XXXX` (4 alphanum) | Short enough to share verbally |

---

## ⚠️ Critical: why `subscriptionEndDate` alone is not enough

`SubscriptionContext.tsx` and `checkOnboardingCompletion()` in `RootNavigator.tsx` both check access via:

```js
const hasActiveSubscription =
  customerInfo.entitlements.active[REVENUECAT_CONFIG.entitlements.premium] !== undefined;
```

The backend `subscriptionEndDate` is only read in the **RevenueCat SDK error fallback**. Under normal conditions, extending `subscriptionEndDate` in the DB does **not** grant app access.

The correct reward mechanism is the **RevenueCat Grant Promotional Entitlement API**:

```
POST https://api.revenuecat.com/v1/subscribers/{app_user_id}/entitlements/Nora%20Premium/promotional
Authorization: Bearer {REVENUECAT_SECRET_KEY}
Content-Type: application/json

{ "duration": "monthly" }
```

This grants A a 1-month entitlement that `customerInfo.entitlements.active['Nora Premium']` picks up automatically — zero app code changes needed.

Note: `app_user_id` is `user.id` (UUID) and the entitlement identifier is `Nora Premium` (URL-encoded: `Nora%20Premium`), matching `REVENUECAT_CONFIG.entitlements.premium` in `src/config/revenuecat.ts`.

---

## Phase 1 — Database

**File:** `prisma/schema.prisma`

### New model

```prisma
model Referral {
  id         String         @id @default(uuid())   // consistent with User.id which uses randomUUID()
  referrerId String
  refereeId  String         @unique   // one referral per user, enforced at DB level
  code       String
  status     ReferralStatus @default(PENDING)
  rewardAt   DateTime?
  createdAt  DateTime       @default(now())

  referrer User @relation("ReferralsGiven",   fields: [referrerId], references: [id], onDelete: Cascade)
  referee  User @relation("ReferralReceived", fields: [refereeId],  references: [id], onDelete: Cascade)

  @@index([referrerId])
  @@index([status])
}

enum ReferralStatus {
  PENDING    // B signed up, trial running
  COMPLETED  // B made first payment, A rewarded
  EXPIRED    // B never paid within 90 days of signing up
}
```

### Changes to `User` model

```prisma
referralCode     String?    @unique   // A's shareable code, generated on demand
referralsGiven   Referral[] @relation("ReferralsGiven")
referralReceived Referral?  @relation("ReferralReceived")
```

### Migration

```bash
npx prisma migrate dev --name add_referral_mechanism
```

---

## Phase 2 — Backend API

**New file:** `server/routes/referral.cjs`

### Endpoint 1 — `GET /api/referral/referrer-name/:code` (public)

Used by the landing page to personalise with the referrer's first name.

```
Response: { firstName: "Sarah" }
Errors:   404 if code not found
```

- Looks up `User.referralCode = code`
- Returns only first name (decrypt `user.name` with `decryptSensitiveData`, split on space, take first)
- Rate limited: 20 req/min per IP (prevent enumeration)

---

### Endpoint 2 — `POST /api/referral/register` (public)

Called by the web landing page on form submit.

```
Body:     { email, password, referralCode }
Response: { message: "Account created! Download Nora to continue." }
Errors:   409 if email already registered
          404 if referralCode not found
          400 validation errors
```

Logic:
1. Validate email + password (same Joi rules as existing signup: 8 chars, upper+lower+digit)
2. Compute `emailHash = sha256(email.toLowerCase())`, check no existing user has it
3. Look up `User.referralCode = referralCode` → find referrer; 404 if not found
4. Reject if `referrer.emailHash === emailHash` (self-referral)
5. Hash password with `hashPassword()`
6. **Encrypt sensitive fields** using `encryptUserData({ email, name: 'User', childName: 'Child' })` — same pattern as `POST /api/auth/signup` (email is stored encrypted, looked up by `emailHash`)
7. Create `User` with:
   - `id: crypto.randomUUID()`
   - `email: encryptedData.email`, `emailHash`
   - `name: encryptedData.name` (`'User'` → triggers `NameInput` step in `checkOnboardingCompletion`)
   - `childName: encryptedData.childName` (`'Child'` → triggers `ChildName` step)
   - `childBirthYear: new Date().getFullYear() - 3`
   - `childConditions: '[]'`
   - `subscriptionPlan: 'FREE'`, `subscriptionStatus: 'INACTIVE'`
8. Create `Referral { referrerId: referrer.id, refereeId: newUser.id, code: referralCode, status: 'PENDING' }`
9. Return success — **no tokens issued** (user logs in via the app)

Rate limit: 5 requests/hour per IP.

---

### Endpoint 3 — `GET /api/referral/my-code` (authenticated)

Returns the current user's referral code, generating one if it doesn't exist yet.

```
Response: {
  code: "NORA-A1B2",
  shareUrl: "https://hinora.co/join/NORA-A1B2",
  stats: { totalReferred: 3, converted: 1, pendingConversion: 2 }
}
```

Logic:
1. If `user.referralCode` is null, generate a unique code (retry loop on collision):
   ```js
   function generateCode() {
     const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
     return 'NORA-' + Array.from({ length: 4 }, () =>
       chars[Math.floor(Math.random() * chars.length)]
     ).join('');
   }
   ```
2. Save to `user.referralCode` if newly generated
3. Count `Referral` rows by status for stats

---

### Endpoint 4 — `POST /api/referral/apply-existing` (authenticated)

For the edge case where B already has an account (installed the app first) and then taps A's link.

```
Body:     { code }
Response: { message: "Referral applied." }
Errors:   404 if code not found
          409 if user already has a referralReceived
          400 if self-referral
```

Logic:
1. Look up referrer by `referralCode = code`
2. Check `user.referralReceived` is null (reject if already referred)
3. Reject self-referral
4. Create `Referral { referrerId, refereeId: req.userId, code, status: 'PENDING' }`

---

### Mount in `server.cjs`

```js
const referralRoutes = require('./server/routes/referral.cjs');
app.use('/api/referral', referralRoutes);
```

---

## Phase 3 — Web landing page

**New file:** `public/join.html`  
**Served at:** `https://hinora.co/join/:code`

### Server route (add to `server.cjs`)

```js
app.get('/join/:code', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'join.html'));
});
```

### Page behaviour

**On load:**
1. Show the form immediately (don't wait for API)
2. In parallel, attempt app redirect: `window.location.href = 'nora://join?code=<code>'`
   — if app is installed iOS intercepts it and opens the app; if not, nothing happens (custom scheme silently fails on mobile web)
3. `GET /api/referral/referrer-name/:code` → if success, set heading to "Sarah invited you to Nora"; if 404, use "You're invited to Nora"

**On form submit:**
1. `POST /api/referral/register { email, password, code }`
2. Success → replace form with:
   > "Your account is ready! Download Nora to start your 1-month free trial."
   > [Download on App Store] button
3. 409 → "An account with this email already exists. Download the app and log in."
4. Validation errors → inline field messages

> **Note:** Do NOT use a timeout-based smart redirect. Show the form immediately. The `nora://` redirect attempt happens silently in parallel — if the app opens, great; if not, the user is already looking at the form.

---

## Phase 4 — Webhook changes

**File:** `server/routes/webhooks.cjs`

### Trigger: two payment paths

B becomes a paying customer in two ways:
- **Trial → paid:** `RENEWAL` event fires, `user.subscriptionPlan === 'TRIAL'` at time of event
- **Direct purchase (no trial):** `INITIAL_PURCHASE` event fires with `isTrialPeriod === false`

Both must trigger `handleReferralReward`.

### Modify the switch statement

```js
case 'INITIAL_PURCHASE':
case 'RENEWAL': {
  const wasOnTrial = user.subscriptionPlan === 'TRIAL';
  const isDirectPurchase = eventType === 'INITIAL_PURCHASE' && !isTrialPeriod;
  await handleSubscriptionActivation(user.id, event);
  if (wasOnTrial || isDirectPurchase) {
    await handleReferralReward(user.id);
  }
  break;
}
```

(`isTrialPeriod` is already computed at the top of the webhook handler from `handleSubscriptionActivation`'s logic — extract it to the outer scope.)

### New function `handleReferralReward(refereeId)`

```js
const { sendPushNotificationToUser } = require('../services/pushNotifications.cjs');

async function handleReferralReward(refereeId) {
  const referral = await prisma.referral.findUnique({
    where: { refereeId },
  });

  if (!referral || referral.status !== 'PENDING') return;

  // Fraud cap: max 3 rewards per referrer in the last 12 months
  const recentRewards = await prisma.referral.count({
    where: {
      referrerId: referral.referrerId,
      status: 'COMPLETED',
      rewardAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
    },
  });
  if (recentRewards >= 3) {
    console.warn(`Referral reward cap reached for referrer ${referral.referrerId}`);
    return;
  }

  // Grant 1-month promotional entitlement via RevenueCat REST API
  const rcResponse = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${referral.referrerId}/entitlements/Nora%20Premium/promotional`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.REVENUECAT_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ duration: 'monthly' }),
    }
  );

  if (!rcResponse.ok) {
    console.error(`RevenueCat promotional entitlement failed for ${referral.referrerId}:`, await rcResponse.text());
    // Don't rethrow — log and continue. Could add a retry queue here later.
    return;
  }

  await prisma.referral.update({
    where: { id: referral.id },
    data: { status: 'COMPLETED', rewardAt: new Date() },
  });

  // Push notification to referrer (takes userId, not pushToken)
  await sendPushNotificationToUser(referral.referrerId, {
    title: 'You earned 1 free month!',
    body: 'Your friend just subscribed to Nora. You have 1 extra month of access.',
  });

  console.log(`Referral reward granted: referrer=${referral.referrerId} referee=${refereeId}`);
}
```

---

## Phase 5 — Mobile changes

### 5a. Universal Link handling in `App.tsx`

When B already has the app installed and taps A's link, iOS intercepts `nora://join?code=...` and opens the app. Add the route to the linking config:

```js
// App.tsx — linking config
config: {
  screens: {
    Onboarding: {
      screens: {
        ResetPassword: 'reset-password',
        Login: { path: 'join', parse: { code: String } },  // add this
      },
    },
  },
},
```

In `LoginScreen`, read the `code` param from route:
- Store it in `AsyncStorage` with key `@nora_pending_referral_code`
- After successful login, check for stored code → call `POST /api/referral/apply-existing { code }`
- Clear from storage after calling (success or 409)
- If authenticated already: show toast "You were already logged in — referral can't be applied"

### 5b. `apple-app-site-association` file

For `https://hinora.co/join/:code` Universal Links to open the installed app, the AASA file at `https://hinora.co/.well-known/apple-app-site-association` must include the `/join/*` path:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["<TeamID>.<BundleID>"],
        "components": [
          { "/": "/join/*" },
          { "/": "/reset-password*" }
        ]
      }
    ]
  }
}
```

If this file doesn't exist yet, it must be created and served with `Content-Type: application/json`. The iOS device fetches it on app install to register Universal Links.

### 5c. New `ReferralScreen.tsx`

**Location:** `nora-mobile/src/screens/ReferralScreen.tsx`  
**Entry point:** Add a "Refer a Friend" row in `ProfileScreen.tsx`  
**Navigation:** Add `Referral` to `RootStackParamList` in `navigation/types.ts` + register in `RootNavigator.tsx`

Screen layout:
```
┌─────────────────────────────────┐
│  Refer a Friend                  │
│                                  │
│  Give a friend 1 month free.     │
│  You'll get 1 month free when    │
│  they subscribe.                 │
│                                  │
│  Your invite link:               │
│  ┌───────────────────────────┐   │
│  │ hinora.co/join/NORA-A1B2  │   │
│  └───────────────────────────┘   │
│                                  │
│  [    Share Invite Link    ]     │
│                                  │
│  ─────── Your referrals ──────   │
│  3 friends joined                │
│  1 subscribed → +1 month earned  │
│  2 on free trial                 │
└─────────────────────────────────┘
```

On mount: `GET /api/referral/my-code` to load code + stats.  
Share button: `Share.share({ message: 'Join me on Nora! Use my link: https://hinora.co/join/NORA-A1B2' })`.

---

## Phase 6 — Expiry cron job

**New file:** `server/jobs/referralExpiryJob.cjs`

Runs daily. Marks `PENDING` referrals older than 90 days as `EXPIRED`:

```js
await prisma.referral.updateMany({
  where: {
    status: 'PENDING',
    createdAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
  },
  data: { status: 'EXPIRED' },
});
```

Register it alongside existing jobs in `server.cjs` or wherever the cron scheduler is initialised.

---

## Fraud prevention

| Guard | Where |
|---|---|
| One referral per new user | `refereeId @unique` in DB — DB-level hard stop |
| Self-referral | `POST /api/referral/register` + `POST /api/referral/apply-existing` — compare emailHash / userId |
| Reward cap | `handleReferralReward` — max 3 `COMPLETED` in last 12 months |
| Code enumeration | Rate limit `GET /referrer-name/:code` — 20 req/min per IP |
| Account farming | Rate limit `POST /referral/register` — 5 req/hour per IP |
| Attribution window | `referralExpiryJob.cjs` — PENDING → EXPIRED after 90 days |
| Disposable emails | `POST /referral/register` — block known disposable domains |

---

## Files to create / modify

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add `Referral` model, `ReferralStatus` enum, 3 fields to `User` |
| `server/routes/referral.cjs` | **Create** — 4 endpoints |
| `server/routes/webhooks.cjs` | Fix `INITIAL_PURCHASE`/`RENEWAL` switch + add `handleReferralReward` |
| `server/services/pushNotifications.cjs` | No change — use existing `sendPushNotificationToUser(userId, {...})` |
| `server/jobs/referralExpiryJob.cjs` | **Create** — daily cron |
| `server.cjs` | Mount `/api/referral` routes + `/join/:code` page route + register cron |
| `public/join.html` | **Create** — web landing page |
| `public/.well-known/apple-app-site-association` | Add `/join/*` path (or update if it already exists) |
| `nora-mobile/App.tsx` | Add `join` path to linking config |
| `nora-mobile/src/screens/onboarding/LoginScreen.tsx` | Read `code` param from route, store + apply pending referral |
| `nora-mobile/src/screens/ReferralScreen.tsx` | **Create** |
| `nora-mobile/src/screens/ProfileScreen.tsx` | Add "Refer a Friend" row |
| `nora-mobile/src/navigation/types.ts` | Add `Referral` to `RootStackParamList` |
| `nora-mobile/src/navigation/RootNavigator.tsx` | Register `Referral` screen |

---

## Environment variables needed

| Variable | Used in |
|---|---|
| `REVENUECAT_SECRET_KEY` | `handleReferralReward` — RevenueCat REST API (Secret key, not the public SDK key) |

This is the **Secret API key** from RevenueCat dashboard → Project Settings → API Keys (different from the public SDK key already in the app).

---

## Build order

1. **Database** — schema + migration (unblocks everything)
2. **`POST /api/referral/register`** — unblocks landing page
3. **Landing page** (`public/join.html`) — testable end-to-end via browser
4. **`GET /api/referral/my-code`** — unblocks mobile referral screen
5. **Webhook changes + `handleReferralReward`** — reward logic (needs `REVENUECAT_SECRET_KEY` in env)
6. **`POST /api/referral/apply-existing`** — edge case for app-already-installed users
7. **Mobile `ReferralScreen`** — share + stats UI
8. **`App.tsx` + `LoginScreen` Universal Link handling** — app-installed deep link path
9. **AASA file** — enable Universal Links from `https://hinora.co/join/*`
10. **Expiry cron job** — harden before marketing push

---

## Testing checklist

- [ ] B signs up on web with A's code → `Referral` row created with `PENDING`
- [ ] B logs into app → onboarding resumes from `NameInput` step (name === 'User' triggers it)
- [ ] B completes onboarding + starts trial → `subscriptionPlan = TRIAL`
- [ ] Simulate `RENEWAL` webhook (`period_type = NORMAL`, user was on TRIAL) → RevenueCat promotional entitlement API called for A
- [ ] Simulate `INITIAL_PURCHASE` webhook (`isTrialPeriod = false`) → same reward path fires
- [ ] A's `customerInfo.entitlements.active['Nora Premium']` reflects the extra month (verify in RevenueCat dashboard)
- [ ] A receives push notification
- [ ] Referral `status = COMPLETED`
- [ ] Second `RENEWAL` for same B → `handleReferralReward` exits early (status !== PENDING)
- [ ] Self-referral rejected (web + apply-existing)
- [ ] Duplicate email on web sign-up → 409 with correct message
- [ ] Invalid code → 404
- [ ] App already installed + taps link → `nora://join?code=...` opens app, code stored in AsyncStorage
- [ ] Reward cap: 4th completed referral within 12 months → RevenueCat call skipped, logged
- [ ] Expiry job: PENDING referral > 90 days → status becomes EXPIRED
- [ ] `REVENUECAT_SECRET_KEY` missing from env → error logged, referral not marked COMPLETED (not silently swallowed)
