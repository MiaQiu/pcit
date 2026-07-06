# Subscription System

How the app decides whether a user has access to paid features.

## Flags and Storage

| Layer | Key / Field | Type | Purpose |
|-------|-------------|------|---------|
| Database | `User.isFreeAccount` | `Boolean` (default `false`) | Permanent bypass — user never hits the paywall |
| Database | `FreeAccountWhitelist.emailHash` | SHA-256 of email | Pre-signup grant — matched at account creation |
| Server response | `isFreeAccount` in `/api/auth/me` | boolean | Delivered to mobile on every force-refresh |
| Mobile (memory) | `SubscriptionContext.isSubscribed` | React state | Single source of truth consumed by all screens |
| Mobile (AsyncStorage) | `@nora_free_limit_reached` | `'true'` or absent | Cache: avoids an API call on every tab focus once the 3-session free limit is hit |

## Priority Order

When determining access, **the first truthy condition wins**:

1. `user.isFreeAccount === true` → full access, RevenueCat is never called
2. `user.isSubscribed === true` (server-computed) → full access, RevenueCat is never called
   - Covers Stripe subscribers (web signup) and partner subscribers — both invisible to RevenueCat
3. RevenueCat `customerInfo` has an active entitlement or active subscription → full access
4. Otherwise → free tier (up to 3 completed sessions, then paywall)

`isSubscribed` is computed in `GET /api/auth/me`:
```js
isSubscribed = isFreeAccount
  || (['ACTIVE', 'TRIAL', 'CANCELLED', 'PAST_DUE'].includes(subscriptionStatus)
      && subscriptionEndDate > now)
```

See `doc/partners.md` for the B2B2C partner flow and `doc/web-signup.md` for the Stripe web checkout flow.

## Check Points

### 1. App launch — `SubscriptionContext` init

File: `nora-mobile/src/contexts/SubscriptionContext.tsx`

Triggered once when `rcReady` becomes `true` (RevenueCat has been configured).

```
rcReady=true
  → authService.getCurrentUser(true)   ← force-refresh, bypasses 24h cache
      if user.isFreeAccount:
          setIsSubscribed(true)
          setIsLoading(false)
          loadOfferings() in background
          (RevenueCat skipped)
      else:
          loadOfferings() + checkSubscriptionStatus() in parallel
```

`checkSubscriptionStatus()` (also exposed via context and called manually):
```
authService.getCurrentUser(true)
  if user.isFreeAccount:
      setIsSubscribed(true)
      AsyncStorage.removeItem('@nora_free_limit_reached')
      return
  Purchases.getCustomerInfo()
    hasEntitlement OR activeSubscriptions.length > 0
      → setIsSubscribed(true/false)
```

### 2. Record tab focus — `RecordScreen` gate

File: `nora-mobile/src/screens/RecordScreen.tsx:75`

Runs on every `useFocusEffect` (every time the tab is opened).

```
if isSubscribed:
    clear @nora_free_limit_reached
    allow recording
else:
    wait for subscriptionLoading to settle
    read @nora_free_limit_reached from AsyncStorage
        if 'true' → navigate to SubscriptionScreen immediately (no API call)
    fetch completed session count from API
        if count >= 3:
            write @nora_free_limit_reached = 'true'
            navigate to SubscriptionScreen
        else:
            allow recording
```

`FREE_SESSIONS_LIMIT` is hardcoded to `3`.

### 3. Onboarding paywall — `SubscriptionScreen`

File: `nora-mobile/src/screens/onboarding/SubscriptionScreen.tsx:90`

Runs once on mount, before the paywall UI renders.

```
authService.getCurrentUser(true)
  if user.isFreeAccount:
      checkSubscriptionStatus()       ← syncs SubscriptionContext so isSubscribed=true
      completeOnboarding()
      navigate to MainTabs (reset stack)
  else:
      setCheckingFreeAccount(false)   ← paywall renders
```

While `checkingFreeAccount` is `true`, the component returns `null` — no paywall flash.

### 4. Signup — whitelist check

File: `server/routes/auth.cjs` (email/password signup)  
File: `server/routes/social-auth.cjs` (Google/Apple signup)

At account creation:

```
compute SHA-256(email.toLowerCase())
FreeAccountWhitelist.findUnique({ where: { emailHash } })
  if found:
      User.update({ isFreeAccount: true })
      (user object returned to mobile already has isFreeAccount=true)
```

The whitelist entry is **not deleted** after match — it stays as a record.

## Data Flow Diagram

```
Admin portal
  │  PUT /api/admin/users/:id/free-account
  │  POST /api/admin/free-account-whitelist
  ▼
Database
  ├── User.isFreeAccount
  └── FreeAccountWhitelist

App launch
  │  GET /api/auth/me  (force-refresh)
  ▼
authService (in-memory, 24h cache)
  │  user.isFreeAccount
  ▼
SubscriptionContext.isSubscribed  ──────────────────────────┐
  │                                                          │
  │  (if false) Purchases.getCustomerInfo()                 │
  │  RevenueCat → hasEntitlement                            │
  ▼                                                         │
isSubscribed (React state)                                  │
  │                                                         │
  ├── RecordScreen: gate check (useFocusEffect) ◄───────────┘
  ├── ProfileScreen: UI affordances
  └── SubscriptionScreen: bypass check on mount
```

## authService Caching

`getCurrentUser(forceRefresh: boolean)`:

- `forceRefresh=false` (default): returns 24-hour in-memory cache from AsyncStorage `cachedUser`. Triggers a background refresh for next call.
- `forceRefresh=true`: always hits `/api/auth/me`. Used by SubscriptionContext and SubscriptionScreen to ensure `isFreeAccount` is current.

Concurrent callers share one in-flight request via `_inflight` promise deduplication. The 401 retry is inlined (not recursive) to avoid a deadlock where `_inflight` would wait on itself.

## `@nora_free_limit_reached` Cache

Purpose: avoid hitting the API on every Record tab focus once the free limit is known.

| Event | Action |
|-------|--------|
| User hits 3 completed sessions | write `'true'` |
| User subscribes (isSubscribed becomes true) | removed by RecordScreen gate |
| User is granted `isFreeAccount` | removed by `checkSubscriptionStatus()` |
| User logs out | cleared with all AsyncStorage |

If the flag is stale (e.g. user subscribed on another device), the next `isSubscribed=true` state update clears it.

## Granting Free Access

### Existing user

Admin portal → Free Accounts page → enter email → Grant  
or  
Admin portal → Subscriptions page → Grant button on user row

Both call `PUT /api/admin/users/:id/free-account` with `{ isFreeAccount: true }`.

The mobile app picks this up on next app launch (SubscriptionContext force-refresh).

### Pre-signup (whitelist)

Admin portal → Free Accounts page → enter email → Grant  
(or `POST /api/admin/free-account-whitelist` directly)

If no account exists for that email, the entry goes into `FreeAccountWhitelist`. When the user signs up, the server hash-matches and sets `isFreeAccount: true` before returning the session — they never see the paywall.

### Seeding via script

```bash
# Apply to existing users in DB directly (dev or prod via tunnel)
node scripts/set-free-accounts.cjs

# Seed whitelist entries for emails not yet signed up
node scripts/seed-free-account-whitelist.cjs
```

## Revoking Free Access

Admin portal → Free Accounts page → Revoke button  
or  
Admin portal → Subscriptions page → Revoke button

Calls `PUT /api/admin/users/:id/free-account` with `{ isFreeAccount: false }`.

The app picks this up on next launch. AsyncStorage flag is **not** automatically cleared on revoke — it will be cleared naturally the next time `isSubscribed=true` (if user then subscribes) or on logout.

## Mobile App Rebuild Required

The following subscription-related fixes are in the mobile codebase and require a new app build to take effect for existing users:

- `SubscriptionContext`: force-refresh on launch, `isFreeAccount` short-circuit, AsyncStorage clear
- `SubscriptionScreen`: `checkingFreeAccount` guard (no paywall flash for whitelisted new users)
- `authService`: `_inflight` deadlock fix (inline retry instead of recursive `getCurrentUser`)

Old app builds call `getCurrentUser()` without force-refresh — `isFreeAccount` will be stale (always `false` from cache) until the 24h cache expires or the user restarts the app.
