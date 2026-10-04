# Web signup analytics (Amplitude)

The web signup app (`web/`, signup.hinora.co) sends events to the **same Amplitude project as the mobile app**, so a user's web funnel and their in-app activity join up on their user id (`setUserId` after signup/login — the mobile app identifies with the same id).

Code: `web/src/analytics.ts` (wrapper), `AnalyticsTracker` in `web/src/App.tsx` (screen views).

## Events

Every event carries `platform: 'web-signup'`, `environment` (`production` only on signup.hinora.co; localhost and preview deploys are `development`) and the visitor's signup link:

| Property | Values |
|---|---|
| `linkType` | `campaign`, `partner`, `referral`, `direct` (no link) |
| `partnerSlug`, `partnerKind` | the `/p/<slug>` link, if any |
| `messageKey` | campaign message variant (`/p/<slug>/<key>`), else null |
| `source` | channel from `?src=`, else null |

| Event | When | Extra properties |
|---|---|---|
| `Signup Link Opened` | `/p/…` or `/join/…` validated (or failed) | `valid`, `entryPath`, `utm_*`, `fbclid`, `gclid`, `ttclid`, `entryReferrer` |
| `Screen Viewed` | every route change (not the invisible `/p/`, `/join/` redirects) | `screen` (readable name), `step` (flow order), `detail` (WACB question / play session / demo number), `path` |
| `User Signed Up` | `/create-account` succeeded | `method: 'email'`, `accountStep: 'first' \| 'last'` (`last` = account-at-the-end link, `config.accountLast`) |
| `User Logged In` | `/login` succeeded | `method: 'email'` |
| `Checkout Started` / `Checkout Failed` | Subscribe button / Stripe session error | `plan`, `discounted` |

Screen names in flow order: Landing → Advisor Intro → Create Account → Parenting Intro, Name, Relationship, Child Name, Child Gender, Child Birthday, Child Issue, Snapshot Intro, WACB Question (`detail` = 1–10), Behavior Profile, Intro 3 → Play Session (`detail` = 1–5) → Subscribe → Success. Login, Forgot Password and Demo are tracked too.

## User properties

- **Every visitor, set once:** `initial_entryPath`, `initial_utm_*`, `initial_fbclid` / `gclid` / `ttclid`, `initial_entryReferrer`. Captured from the URL when the app first loads.
- **On signup, set once:** `signupPlatform: 'web'`, `signupLinkType`, `signupPartnerSlug`, `signupMessageKey`, `signupSource`. Use these to cohort in-app behaviour by acquisition campaign.
- No email, phone or name is sent from the web app, and IP tracking is off (same as mobile).

## Implementation notes

- **Lazy SDK:** `@amplitude/analytics-browser` (~70 kB gzipped) is loaded with a dynamic import so it never delays the landing page. Calls made before it loads are queued and replayed in order, each with the campaign context from when it was made. If an ad blocker blocks the SDK, analytics simply stays off.
- **SDK attribution is disabled:** the SDK reads the URL when it loads. By then a `/p/` link has often already redirected to `/`, so it would record every `initial_utm_*` as `EMPTY`. The app captures the entry URL at startup instead (see user properties above).
- **Dev double-counting:** React StrictMode runs effects twice in dev, so `Signup Link Opened` appears twice locally. Production fires it once.
- **Suggested funnel:** `Signup Link Opened` → `Screen Viewed` (screen = Create Account) → `User Signed Up` → `Screen Viewed` (screen = Play Session, detail = 5) → `Screen Viewed` (screen = Success). Filter on `environment = production` and group by `messageKey` / `source`. For links with the account at the end (`accountLast`), Create Account comes after Intro 3 / Play Session — split funnels by `accountStep`.
