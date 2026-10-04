# Account-Last Signup for Partner & Campaign Links

**Date:** 2026-10-04
**Status:** Implemented (2026-10-04) — API, web SPA, admin. Migration applied to **dev
only**; prod needs the migration backlog cleared first (see "Rollout"). Every link has
`accountLast` off until switched on in the admin portal.
**Scope:** web signup SPA (`web/`), API (`server/`, new endpoints only), one Prisma
migration, admin portal (`admin/`). **No mobile app changes.**

---

## Goal

For visitors arriving through a partner or campaign link (`/p/:slug`,
`/p/:slug/:messageKey`) with the new `accountLast` switch on, move the
create-account screen from the start of the web signup flow to the end, so people
see the value (child profile, behavior snapshot, Emotional Massage intro) before
being asked for email/phone/password.

To keep visibility into people who drop off before the account screen, the server
records an anonymous **signup draft** per visitor: child birth year, selected
concerns, WACB total score and the last screen reached. No name, child name, exact
birthday, email, phone, IP or free text is stored in a draft.

Referral links (`/join/:code`), plain visits to `/`, and links with the switch off
keep the current account-first flow.

### Constraint: no mobile app impact

Nothing the mobile app calls or reads changes. `POST /api/auth/signup`,
`PATCH /api/auth/complete-onboarding` and `POST /api/wacb-survey` are untouched;
all server work is new, web-only endpoints plus a new table the app never reads.
See "Mobile app" below.

---

## Flow

### Today (all visitors)

```
/p/:slug → / → /intro → /create-account → /onboarding/name → relationship
  → child-name → child-gender → child-birthday → child-issue → snapshot-intro
  → wacb/1..10 → behavior-profile → intro3 → (play/1..5 | Skip for Now)
  → /subscribe → Stripe → /success
```

### After (partner & campaign links with `accountLast` on)

```
/p/:slug → / → /intro → /onboarding/name → … → intro3 → (play/1..5 | Skip for Now)
  → /create-account → /subscribe → Stripe → /success
                     (skipSubscription campaigns: /create-account → /success)
```

The account screen sits **before `/subscribe`**, not directly before `/success`:
`POST /api/stripe/create-checkout-session` is `requireAuth` and reads
`user.partner.config` for the trial, coupon and allowed plans, so checkout needs a
real account. For `skipSubscription` campaigns `/subscribe` already redirects to
`/success`, so for them the account screen is the last step before success.

### The `accountLast` switch

A per-link boolean in `Partner.config`, **default off**, editable in the admin
portal and returned by `GET /api/partner/validate/:slug`. The web rule:

```ts
// web/src/contexts/OnboardingContext.tsx (or a small flow helper)
export const accountLast = (d: OnboardingData) =>
  !!d.partnerInfo?.accountLast && !d.referralCode;
```

`ReferralLandingScreen` also sets `partnerInfo` (the referral trial config), hence
the `!referralCode`. An invalid/expired slug sets no `partnerInfo`, so those
visitors stay account-first.

Recommendation: keep it **off for `skipSubscription` campaigns**. Their trial is
granted at signup, so a visitor who leaves early and later signs up in the app
loses the whole offer (see "Trade-offs").

---

## Data model

New table — one migration (`prisma/migrations/<ts>_signup_draft/`):

```prisma
model SignupDraft {
  id                String           @id @default(uuid()) // unguessable; held by the browser
  partnerId         String
  campaignMessageId String?
  signupSource      String?          // normalized ?src=, same as User.signupSource
  childBirthYear    Int?
  concerns          String[]         // ChildIssueScreen option keys only (see below)
  wacbScore         Int?             // set only when all 10 items are answered
  lastStep          String?          // last route reached, e.g. "/onboarding/wacb/6"
  convertedUserId   String?          // not unique: one user can finish several visits
  convertedAt       DateTime?
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  partner           Partner          @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  campaignMessage   CampaignMessage? @relation(fields: [campaignMessageId], references: [id], onDelete: SetNull)

  @@index([partnerId, createdAt])
  @@index([convertedUserId])
}
```

Plus the back-relations on `Partner` and `CampaignMessage`. `accountLast` lives in
the existing `Partner.config` JSON, so it needs no migration.

Field rules:

- **`concerns`** — only keys from the fixed `issueOptions` list in
  `web/src/screens/onboarding/ChildIssueScreen.tsx` (`big_feelings_tantrums`, …,
  `other`). The parent's free text for "Other" is **not** stored in the draft (it
  can contain anything, including names); the draft keeps just `other`. The server
  validates against an allowlist and drops unknown values.
- **`wacbScore`** — `computeWacbScore()` from `OnboardingContext`, sent only when
  all 10 `SNAPSHOT_ITEMS` are answered; partial surveys and the "locked" skip path
  leave it `null` so averages aren't skewed.
- **`childBirthYear`** — year only, from `data.childBirthday`.
- No encrypted columns are needed; nothing in the row identifies a person.

Why a separate table rather than a placeholder `User`: `User` requires a unique
`email`/`emailHash`/`passwordHash`, partner signups increment `redemptions` against
`maxRedemptions`, and placeholder rows would leak into every user list, count and
job (`trialExpiryJob`, weekly reports, push, admin lists, Amplitude) — and into the
mobile app's login. Drafts never touch `User`, `redemptions` or the existing signup
stats.

---

## API (new endpoints only)

All in a new `server/routes/signup-draft.cjs`, mounted next to `partner.cjs`.

### `POST /api/signup-draft` (public, rate-limited)

Body: `{ partnerSlug, messageKey?, source?, childBirthYear?, concerns?, wacbScore?, lastStep? }`
— the progress fields are included so the row is complete even if the tab closes before
any update follows.
Validates the link exactly like `GET /api/partner/validate/:slug` (active, not
expired, under cap, `accountLast` on) and resolves `campaignMessageId` / normalized
`source` the same way signup does. Returns `{ id }`. An invalid link returns 400
and the client simply continues without a draft.

### `PATCH /api/signup-draft/:id` (public, rate-limited)

Body: any subset of `{ childBirthYear, concerns, wacbScore, lastStep }`.
Validated with Joi (`childBirthYear` 1900–current year, `concerns` allowlisted,
`wacbScore` integer in the survey's range, `lastStep` ≤ 100 chars and must start
with `/`). No-op once `convertedAt` is set. 404 for an unknown id.

### `POST /api/signup-draft/:id/convert` (`requireAuth`)

Body: the final progress fields. Sets them plus `convertedUserId = req.user.id` and
`convertedAt` in one write — screen updates still queued in the browser are ignored once
converted, so the final state must travel with the conversion. Idempotent: a draft that's
already converted is left as is. Used after both a new signup and the existing-account
login path.

There is deliberately **no GET** — nothing needs to read a draft back (the browser
holds the answers), so the endpoints can't be used to enumerate data.

Rate limit: reuse the `authLimiter` pattern with a looser budget (one PATCH per
screen ≈ 25 per signup).

### Existing endpoints — unchanged

- `POST /api/auth/signup` — the web keeps sending today's fields (name, phone,
  child name, birthday/birth year, `childConditions`, `issue`, partner attribution).
  In the account-last flow these are now populated, because the answers were
  collected first.
- `PATCH /api/auth/complete-onboarding` and `POST /api/wacb-survey` — called by the
  web right after signup with the new token, as the account-first flow already does
  mid-flow.
- `GET /api/partner/validate/:slug` — only change: include `accountLast` in the
  response (the app doesn't call it).

---

## Web SPA changes (`web/src`)

### State (`contexts/OnboardingContext.tsx`)

- Add `accountLast()` helper, `accountLast?: boolean` on `PartnerInfo`
  (`api.ts` too) and `signupDraftId` on `OnboardingData`.
- Persist `name`, `relationshipToChild`, `childName`, `childGender`,
  `childBirthday` (as ISO string, revived to `Date` on load), `issue`, `issueOther`,
  `wacb` and `signupDraftId` to **`sessionStorage`**. With the account at the end, a
  refresh or a mobile browser discarding the tab would otherwise lose every answer.
  Cleared after a successful signup/login.
- Add a `resolvedIssues(data)` helper ("Other" → parent's text, as `ChildIssueScreen`
  builds it) for `CreateAccountScreen` and the post-auth save.
  `ChildIssueScreen` keeps its own inline version (it works on the not-yet-saved
  textarea value).

### Draft sync (`App.tsx`)

A `DraftSync` component next to `AnalyticsTracker`:

- Only active when `accountLast(data)` and there's no `accessToken`.
- On the first onboarding screen (`/onboarding/name`), if there's no
  `signupDraftId`, `POST /api/signup-draft` and store the id.
- On every route change, `PATCH` `{ lastStep: pathname, childBirthYear, concerns,
  wacbScore }` from current state. Fire-and-forget; errors ignored. Updates are sent one
  at a time (a slow request can't overwrite a newer step), and redirect-only routes
  (`/p/`, `/join/`, `/subscribe`, `/success`) aren't recorded.
- Creation is abandoned after 3 failures (e.g. the link was switched off meanwhile).

No individual screen needs draft code.

### After signup (`CreateAccountScreen`, account-last branch)

1. `signup(...)` with today's fields, now populated: `childConditions` and `issue`
   from `resolvedIssues(data)` (fallback `['General parenting support']` as today).
2. `completeOnboarding(...)` with name, relationship, child name, gender, birthday
   and concerns — the same payload `ChildIssueScreen` builds today.
3. `submitWacbSurvey(...)` if all 10 items are answered (same payload
   `WacbQuestionScreen` sends today).
4. `POST /api/signup-draft/:id/convert` with the final progress, if there's a draft id.
5. Navigate to `/subscribe`.

Steps 2–4 retry once on failure, then are skipped without blocking — same
non-blocking behavior as today's mid-flow calls. If a profile save still fails, the
mobile app's existing safety nets apply: `onboardingCheck.ts` resumes onboarding at
the first missing field, and a missing survey shows the existing "Unlock My Child's
Plan" card.

### Navigation

| File | Change |
|---|---|
| `screens/PartnerLandingScreen.tsx` | On a valid **account-last** link, clear `accessToken` and `signupDraftId` (a stale token from an earlier signup in this browser would otherwise make mid-flow saves write to the old account). Also ignores the response of a superseded run (StrictMode's double effect in dev), so a late response can't reset state. |
| `screens/AdvisorIntroScreen.tsx` | Continue → `/onboarding/name` when `accountLast`, else `/create-account`. |
| `screens/onboarding/NameInputScreen.tsx` | `backTo` → `/intro` when `accountLast`. |
| `screens/onboarding/Intro3Screen.tsx` | "Skip for Now" → `/create-account` when `accountLast` and no token, else `/subscribe`. |
| `screens/play/PlaySession5Screen.tsx` | Continue → same rule as above. |
| `screens/CreateAccountScreen.tsx` | Account-last branch as above. Back button → `navigate(-1)`. Add "Already have an account? Log in" → `/login` with `next`. |
| `screens/LoginScreen.tsx` | Honour a `next` route (router state). In the account-last flow: `completeOnboarding` + `submitWacbSurvey` + draft convert, then `/subscribe`. |
| `screens/SubscriptionScreen.tsx`, `screens/SuccessScreen.tsx` | Guard: `accountLast && !accessToken` → `<Navigate to="/create-account" replace />`. |
| `screens/onboarding/ChildIssueScreen.tsx`, `WacbQuestionScreen.tsx` | No change needed — they already skip server calls without a token. |

Existing-account login: the user's `partnerId` is **not** changed — checkout uses
whatever partner they originally signed up through. Call this out in the runbook.

Campaign custom copy keeps working: `landing.accountTitle` / `accountSubtitle` still
apply to `CreateAccountScreen` wherever it sits, and the campaign consent checkbox
stays on that screen.

### Analytics (`analytics.ts`)

- Add `accountStep: 'first' | 'last'` to the `'User Signed Up'` event so funnels can
  separate the two flows.
- Update `doc/web-signup-analytics.md` funnel definitions.

---

## Admin (`admin/`)

- **Switch:** add an "Account at end of signup" toggle to the partner/campaign
  editor, stored as `config.accountLast` (validated as boolean in the
  create/update handlers in `server/routes/admin.cjs`). Show a hint on
  `skipSubscription` campaigns that it's not recommended there.
- **Stats:** `GET /api/admin/partners/:id/stats` adds `started` per
  (messageKey, source) row = count of `SignupDraft` rows. Funnel per row becomes
  **Visits → Started → Signups**.
- New `GET /api/admin/partners/:id/drafts/summary`: drop-off by `lastStep`, plus
  distributions of `childBirthYear`, `concerns` and `wacbScore` (or behavior
  category via the same cut-offs as `getBehaviorCategory`), for converted vs.
  unconverted drafts.
- `admin/src/components/partners/CampaignLinksModal.tsx` + `admin/src/api/adminApi.ts`:
  show the Started column and a small drop-off table.

---

## Mobile app

No code change and no app release.

- **Endpoints the app uses are unchanged** (`/api/auth/signup`,
  `/api/auth/complete-onboarding`, `/api/wacb-survey`, login). The app never reads
  `SignupDraft`.
- **Web users who finish, then log into the app:** account has `name`, `childName`,
  `childBirthday` and `issue` set, so `nora-mobile/src/utils/onboardingCheck.ts`
  skips the app's onboarding — same as today.
- **Web visitors who leave early, then sign up in the app:** they have no web
  account, and app signup can't carry a partner/campaign link, so they lose the
  attribution and — for `skipSubscription` campaigns only — the signup-time trial.
  (Partner Stripe discounts never applied to in-app purchases, so nothing changes
  there.) This is a business trade-off, not an app change; see "Trade-offs".

---

## Docs to update

- `doc/partners.md` — end-to-end diagram, "Campaign links" (the `accountLast`
  setting; `CreateAccountScreen` is no longer always screen 2), "Web SPA changes".
- `doc/web-signup.md` — flow order for account-last links.
- `doc/partner-onboarding-manual.md` / runbook — the switch, and existing-user
  login behaviour.
- `doc/web-signup-analytics.md` — `accountStep` property.

---

## Testing

Server (extend route tests if present):

- Draft create rejects invalid/expired/capped links and links with `accountLast`
  off; PATCH validates fields, drops unknown concerns, no-ops after conversion;
  convert requires auth and is idempotent.
- Validate endpoint returns `accountLast`; admin create/update accept and persist it.

Manual, local web + API:

1. Link with switch **off** — today's account-first flow, no draft created.
2. Partner link with checkout, switch on — account screen after intro3/play5,
   Stripe shows the partner trial + coupon, user row has profile + concerns,
   survey row exists, draft converted.
3. `skipSubscription` campaign, switch on — consent checkbox on the account screen,
   lands on `/success`, direct trial granted.
4. "Locked" path (skip survey) — signup works, no survey row, draft `wacbScore` null.
5. Existing email → log in → answers synced, draft converted, continues to checkout.
6. Refresh mid-flow — answers and draft id survive.
7. Direct visit to `/subscribe` / `/success` without account → redirected.
8. Abandon at `wacb/6` — draft has birth year, concerns, `lastStep`, no score.
9. `/join/:code` and plain `/` — account-first flow, no draft created.
10. Browser with a stale token from an earlier signup, open a campaign link — token
    cleared, nothing written to the old account.
11. **Mobile regression:** log into the app with the account from (2) — goes
    straight to the main tabs; the app's own signup and survey work as before.

---

## Rollout

1. **Clear the prod migration backlog** (prod DB is ~24 migrations behind; see
   `doc/schema-drift.md`).
2. **Ship the API + `SignupDraft` migration.** Purely additive; nothing uses the
   new endpoints yet.
3. **Ship the web SPA and admin** (Vercel auto-deploys from `main`) with
   `accountLast` **off on every link** — behavior is unchanged for everyone.
4. **Pilot:** turn the switch on for one campaign that has checkout, for ~2 weeks.
   Compare Visits → Started → Signups → checkout against an account-first link of
   similar traffic, using the admin stats and Amplitude `accountStep`.
5. **Decide:** expand to more links, turn it off, or consider the
   "save my progress by email" option (see "Trade-offs").

## Rollback

1. **Turn the switch off** in the admin portal for the affected links — no deploy.
   New visitors get the account-first flow immediately. Visitors who opened the link
   earlier keep the old config in their browser until they open a link again; the
   `/subscribe` and `/success` guards still route them through `/create-account`,
   so they can finish.
2. If the code itself is at fault, roll back in **any order** — signup is
   unchanged, so there's no web/API ordering trap:

| Layer | How | Time | Data impact |
|---|---|---|---|
| Web SPA | Vercel → promote the previous deployment | seconds | None; in-flight answers in `sessionStorage` are ignored by the old code |
| API | App Runner → redeploy the previous image | minutes | None; old web never calls the draft endpoints, and an old API's 404s on them are ignored by the new web |
| Migration | Leave it — additive table, old code ignores it | — | Dropping `SignupDraft` loses only drafts |
| Admin | Vercel rollback, or leave it | seconds | None |

Bad data written before rollback (e.g. a wrong profile-field mapping) is limited
to new users and can be found via `SignupDraft.convertedUserId`, Amplitude
`'User Signed Up'` with `accountStep: 'last'`, or partner users created in the
window; fix with a one-off script. Nothing existing is overwritten.

---

## Trade-offs

- People who abandon before the account screen leave no account and can't be
  contacted (no email/phone in drafts). Drafts are for funnel/audience analysis only.
- If they later sign up in the mobile app instead, they lose the link's attribution
  and, for `skipSubscription` campaigns, the signup-time trial — hence the
  recommendation to keep the switch off for those campaigns.
- Profile + survey are saved by separate calls after signup, not in one
  transaction. Same as today's flow; the mobile app's onboarding check covers gaps.
- Partner/campaign signup counts and `redemptions` only reflect people who finished
  the whole onboarding, so conversion per visit will look different from
  account-first links; compare using `accountStep`.

### Future option: "save my progress by email" (not in this plan)

An optional, skippable email box mid-flow; the server stores its `emailHash` on the
draft and, when someone later signs up **in the app** with that email, attaches the
draft's partner/campaign. Recovers early leavers who switch to the app, but it
changes behavior of the signup endpoint the app uses and makes drafts personal data
(consent/retention). Only worth building if the pilot shows a meaningful number of
such users.

---

## Verification (2026-10-04, local API + web against the dev DB)

Headless browser runs of the real SPA, test links/users deleted afterwards:

- Link with the switch off → `/intro` → `/create-account` (unchanged).
- Account-last campaign: `/intro` → `/onboarding/name` … `intro3` "Skip for Now" →
  `/create-account` → `/subscribe`. User row has name, child name, relationship,
  gender, birthday, concerns (with the parent's "Other" text), partner + source;
  `ChildSnapshotSurvey` saved (total 40, matching the client score); draft converted with
  birth year, concern keys only, score, `lastStep`.
- Refresh mid-flow keeps answers and the draft id; answers cleared after signup.
- Direct `/subscribe` without an account → `/create-account`.
- Existing email → "already registered" → Log in → answers saved to the existing
  account (partner unchanged), draft converted, → `/subscribe`.
- Visitor closing the tab at `wacb/6` → unconverted draft with `lastStep
  /onboarding/wacb/6`, birth year, concern keys, no score; the "Other" free text never
  reached the server.
- Admin: `accountLast` toggle persists across other edits; stats show Started per cell
  and the drop-off / birth year / concerns / behavior-band tables.

Not covered: Stripe checkout itself (unchanged code path), the mobile app (no change).
