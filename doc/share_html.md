# Home Card Public Share Page

A static, unauthenticated web page that lets someone without the Nora app —
or without an account — open a Home Card link from a text message, social
post, or the OS share sheet, see the content rendered in Nora's own visual
style, and get funneled into downloading the app. Mirrors the existing
referral share flow (`public/join.html`) but for content instead of an
invite code.

## Why a Static HTML Page, Not a Web App Route

`web/` (the Vite SPA at `hinora.co/signup`) would need a full client
bundle rebuild/redeploy to add one route. A hand-written static file in
`public/` — served automatically by Express's existing
`express.static(public/)` — needs no build step and no bundler. This is
the same reasoning behind the pre-existing `public/join.html` (referral
signup) and `public/share-lesson.html` (lesson sharing); `share-home-card.html`
follows the identical pattern.

---

## Architecture

```
Mobile app (SubActionCard.handleShare / HomeCardDetailScreen.handleShare)
  │
  │  opens <ShareSheet targetUrl="{EXPO_PUBLIC_WEB_URL}/share-home-card.html?card_id=<id>">
  ▼
ShareSheet (nora-mobile/src/components/ShareSheet.tsx)
  │  POST /api/share-links { targetUrl }  →  creates/reuses a short /s/:code
  │  "Share to": WhatsApp / LinkedIn / Facebook (Linking.openURL)
  │  "Share link": short URL + Copy button
  ▼
Recipient taps the short link
  │
  ▼
GET /s/:code  (server.cjs)  →  302 redirect to the long share-home-card.html?card_id=... URL
  │
  ▼
Recipient's phone browser
  │
  ▼
public/share-home-card.html            (static, served by express.static)
  │
  │  fetch('/api/config/home-cards/share/:id')   ← relative path, same-origin
  ▼
server/routes/config.cjs                (no auth)
  │
  ▼
Prisma → PostgreSQL (HomeCard, HomeCardBadge, HomeCardComponent)
```

`ShareSheet` is **not** Home-Card-specific — it's shared UI also used by every
lesson share button (see [Also Used By Lessons](#also-used-by-lessons-sharesheet--short-links)
below). RN's native `Share.share()` (the OS share sheet) is no longer used for
either flow; `ReferralScreen.tsx`'s invite-code share is the one remaining
caller of native `Share.share()`, and it points at `public/join.html`, an
unrelated page not covered by this doc.

The page fetches via a **relative** path (`/api/config/...`), not an
absolute URL. `public/`, the API, and (in production) the built `web/`
signup app are all served by the same Express process — a relative fetch
resolves correctly whether the page is opened via `hinora.co` or
`localhost:3001`, with no environment branching needed in the page's JS.

---

## Building the Share Link (Mobile)

Every caller builds a `targetUrl` + `message` (and, for Home Cards, a
`previewImageUrl`) and hands them to `<ShareSheet>` — none of them call
`Share.share()` directly anymore:

| Caller | File | `targetUrl` | `previewImageUrl` |
|---|---|---|---|
| QUOTE card share button | `HomeScreen_v2.tsx` (`SubActionCard`) | `share-home-card.html?card_id=<id>&shared_by=<first name>` | `share-image.png` |
| CONTENT card detail screen | `HomeCardDetailScreen.tsx` | `share-home-card.html?card_id=<id>` | `share-image.png` |
| Lesson Read screen | `LessonReadScreen.tsx` | `share-lesson.html?lesson_id=<id>` | *(omitted)* |
| Learn tab's Read modal | `LearnScreen_v3.tsx` | `share-lesson.html?lesson_id=<id>` | *(omitted)* |
| Audio-first lesson player | `LessonViewerScreen_v2.tsx` | `share-lesson.html?lesson_id=<id>` | *(omitted)* |

```js
const webUrl = process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:3001';
const shareUrl = `${webUrl}/share-home-card.html?card_id=${cardId}`;

<ShareSheet
  visible={shareSheetVisible}
  onClose={() => setShareSheetVisible(false)}
  targetUrl={shareUrl}
  message={card.message}
  previewImageUrl={`${webUrl}/api/config/home-cards/${cardId}/share-image.png`}
/>
```

**Why lessons never pass `previewImageUrl`:** there's no share-image
generator for lessons — only Home Cards have
`GET /api/config/home-cards/:id/share-image.png` (see below). `ShareSheet`
simply skips rendering the preview box when the prop is omitted.

`HomeScreen_v2.tsx`'s version also appends `&shared_by=<first name>` (the
sharer's first name, from the logged-in user's profile). The page itself no
longer reads this param — an earlier version rendered a "X shared this with
you" banner that was later removed — so it's currently inert. Harmless to
leave (unknown query params are ignored), worth stripping if the mobile
code gets touched again for another reason.

---

## Also Used By Lessons: ShareSheet + Short Links

`nora-mobile/src/components/ShareSheet.tsx` is a custom in-app bottom sheet
that replaced RN's native `Share.share()` for both Home Card and Lesson
shares. It renders:

- An optional preview image (`previewImageUrl` — Home Cards only, see table
  above).
- A **"Share to"** row: WhatsApp / LinkedIn / Facebook, each via
  `Linking.openURL` with a platform share-intent URL. No Instagram/WeChat —
  both require native SDKs, out of scope.
- A **"Share link"** row: a short `{webUrl}/s/:code` URL with a Copy button
  (`expo-clipboard`).

The short link itself comes from `recordingService.createShareLink(targetUrl)`
→ `POST /api/share-links` (`server/routes/shortlinks.cjs`, `requireAuth`):

```js
// Upsert by targetUrl — repeat shares of the same card/lesson reuse the
// same code instead of accumulating duplicate ShortLink rows.
const existing = await prisma.shortLink.findUnique({ where: { targetUrl } });
// ...else generate an 8-char nanoid, retrying on a rare code collision
// (nanoid is ESM-only, hence the dynamic `await import('nanoid')` inside
// this .cjs file).
```

`GET /s/:code` (registered directly in `server.cjs`, no auth) 404s on an
unknown code, otherwise issues a `302` redirect to the stored `targetUrl`.

`ShareSheet` also keeps an in-memory `shortUrlCache` (module-level `Map`,
keyed by `targetUrl`) so reopening the sheet for the same card/lesson later
in the same app session skips the network round-trip. If `createShareLink`
fails for any reason, `ShareSheet` silently falls back to the long
`targetUrl` — a broken short-link service should never block sharing
entirely.

---

## The Public API

`GET /api/config/home-cards/share/:id` — **no `requireAuth`**, unlike every
other `/api/config/home-cards*` route. 404s if the card doesn't exist or
`isActive` is false (soft-deleted/hidden cards give the same "not found" as
missing ones, so there's no way to distinguish the two from outside).

```js
// server/routes/config.cjs
router.get('/home-cards/share/:id', async (req, res) => {
  const homeCard = await prisma.homeCard.findUnique({
    where: { id: req.params.id },
    include: { badge: true, components: { orderBy: { order: 'asc' } } },
  });
  if (!homeCard || !homeCard.isActive) {
    return res.status(404).json({ error: 'Card not found' });
  }

  // USER_INPUT components are skipped — there's no user session on this
  // public page, so there's nothing to save an answer against.
  const components = homeCard.components
    .filter((c) => c.type !== 'USER_INPUT')
    .map(/* → { type, text, imageUrl, linkedCardId, ctaLabel } */);

  res.json({
    id, cardType, badgeText, badgeColor, message,
    messageFontSize, messageBold, messageItalic, attribution,
    detailTitle, imageUrl, components,
  });
});
```

Image URLs (`imageUrl` on the card and on `IMAGE`-type components) are
resolved from S3 keys to presigned URLs via `resolveDragonImageUrl` before
the response goes out — the page never talks to S3 directly.

---

## Share Image + Rich Link Previews (Home Cards Only)

`GET /api/config/home-cards/:id/share-image.png` (no auth) renders a
1200×630 PNG reproducing the card's visual style — a hand-built SVG
(`buildShareImageSvg` in `server/routes/config.cjs`) piped through `sharp`.
It's the **single source of truth** for two different consumers:

1. `ShareSheet`'s in-app preview image (`previewImageUrl`, see above).
2. The `og:image` injected into `share-home-card.html` for link-preview
   crawlers (below) — avoiding a *third* hand-maintained visual template on
   top of the two `formatContent()`/`formatLessonContentV2.ts` copies this
   doc already flags as a sync risk.

`sharp` renders text via its bundled librsvg/pango, which resolves
`font-family` through the container's fontconfig. The deploy target likely
has no fonts installed, so the SVG deliberately uses a generic sans-serif
stack rather than `'Plus Jakarta Sans'` — fine for a thumbnail, not
pixel-perfect brand matching.

**Server-rendered OG meta tags** (`server.cjs`, registered *before*
`express.static` so it wins over the literal file on disk): a
`GET /share-home-card.html` request that includes `?card_id=` fetches the
card, then rewrites `og:title` / `og:description` / (newly inserted)
`og:image` directly into the raw HTML before sending it. This exists
because link-preview crawlers (WhatsApp, LinkedIn, Facebook, WeChat) don't
execute JS — they'd otherwise only ever see the page's generic static
fallback meta tags, even though the client-side script already updates
`document.title`/`og:title` correctly for real browser visits. Bare visits
(no `card_id`) and missing/inactive cards fall through to `res.sendFile`,
i.e. today's un-injected behavior, and any error mid-lookup does the same
(`sendFile` in the `catch` — a meta-tag failure must never hard-fail the
page load).

**Lessons have no equivalent of any of this.** `GET /share-lesson.html` is
served purely statically by `express.static`; its `og:title`/`og:description`
are the same generic strings for every lesson, and only the client-side
script (which crawlers don't run) sets the real per-lesson title. There is
no `share-image.png` route for lessons either, which is why every lesson
`ShareSheet` call omits `previewImageUrl` (see above). `Lesson.shareTitle` /
`Lesson.shareSubtitle` (added to `schema.prisma` alongside `shareCountBase`)
are admin-authored fields intended for a future lesson share-image
generator — as of writing, no route reads them yet.

---

## Rendering: QUOTE vs CONTENT

`share-home-card.html`'s JS renders one of two layouts based on
`cardType`, each hand-ported to match the mobile styling pixel-for-pixel:

| | QUOTE | CONTENT |
|---|---|---|
| Mobile source of truth | `SubActionCard`'s QUOTE branch, `HomeScreen_v2.tsx` | `HomeCardDetailScreen.tsx` |
| Page function | `renderQuoteCard()` | `renderContentCard()` + `renderComponent()` |
| Layout | Cream card (`#F7F3EC`), centered italic/bold quote text, divider + attribution | Badge pill, title, ordered list of typed components |
| Body content | `card.message` (single string) | `card.components[]` — `TEXT` / `IMAGE` / `OPEN_DETAILS` blocks |

`TEXT` components run through `formatContent()` / `formatInline()`, a
**hand-maintained JS port** of `formatLessonContentV2.ts`
(`**bold**`, `*italic*`, `* bullet` lines, `### heading` lines, `---`
dividers, `![]()`  image lines, blank-line paragraph breaks). This page has
no build step, so it can't `import` the TypeScript module — if the parsing
rules in `formatLessonContentV2.ts` change, `formatContent()` in
`share-home-card.html` needs the same edit made by hand. There is
currently no test or lint rule enforcing they stay in sync.

`OPEN_DETAILS` components render as a link to
`share-home-card.html?id=<linkedCardId>` — **note the param name mismatch**:
every other reference on this page uses `card_id`, but this one link uses
`id`. Untested; likely a bug (`loadCard` reads `card_id`, not `id`, so this
link probably 404s the way it's currently written).

---

## Font Size / Bold / Italic

`messageFontSize` (`SMALL` / `MEDIUM` / `LARGE`) maps to `13 / 15 / 18`px
via `FONT_SIZE_MAP` in the page's script — this constant must stay in sync
with `HOME_CARD_FONT_SIZE_MAP` in `HomeScreen_v2.tsx` and
`FONT_SIZE_OPTIONS` in `admin/src/pages/HomeCardsPage.tsx`. Three separate
hand-maintained copies of the same lookup table, one per surface
(mobile, admin preview, share page) — no shared constant, since each lives
in a different build target (RN, admin SPA, static HTML).

---

## Open App / Download Button

Both the top-nav "Open App" button and the bottom CTA's "Download Nora"
button call the same `openApp()`:

```js
const APP_STORE_URL  = 'https://apps.apple.com/sg/app/nora-parenting-coach/id6756343006';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.chromamind.nora&hl=en';
const STORE_URL = /android/i.test(navigator.userAgent) ? PLAY_STORE_URL : APP_STORE_URL;

function openApp() {
  const openedAt = Date.now();
  window.location.href = 'nora://card/' + cardId;   // attempt deep link
  setTimeout(function () {
    if (Date.now() - openedAt < 2200 && !document.hidden) {
      window.location.href = STORE_URL;              // app wasn't installed
    }
  }, 1500);
}
```

**Store detection** is plain `navigator.userAgent` sniffing — correct for
the overwhelming majority of real visitors, but not hardened (spoofed or
unusual UAs, some in-app browsers, will misfire). `public/join.html`'s
post-signup download button uses the identical detection logic and store
URLs; if the Android package ID or App Store listing ID ever changes,
update both files.

**Deep link resolution**: `nora://card/:cardId` is registered in the RN
`linking` config (`nora-mobile/App.tsx`):

```js
HomeCardDetail: { path: 'card/:cardId', parse: { cardId: String } },
```

This only resolves if the user is **already logged in** — `HomeCardDetail`
exists only inside the authenticated stack in `RootNavigator`, not the
Onboarding stack. A logged-out user tapping the link just opens the app
normally (to login), no error, no crash — the deep link is silently
dropped by React Navigation since the target screen isn't in the
currently-mounted tree.

**The 1500ms/2200ms timeout+fallback pattern** is the standard technique
for "soft" custom-scheme deep linking without real iOS/Android Universal
Links: attempt the custom scheme navigation, and if the tab is still
visible after a short delay (meaning the OS didn't hand off to an
installed app), assume the app isn't installed and redirect to the store.
`document.hidden` guards against firing the store redirect if the app
*did* open and backgrounded the browser tab.

**True Universal Links are not set up.** `public/.well-known/apple-app-site-association`
exists and declares `/join/*` and `/reset-password*` as associated paths,
but `nora-mobile/app.json` has no `associatedDomains` (iOS) or
`intentFilters` (Android) — so `https://hinora.co/...` links never
auto-open the app on tap, only the `nora://` custom scheme does, and only
after the fallback-timer trick above. Adding real Universal Links would
remove the "Cannot Open Page" flash some users briefly see before Safari/
Chrome falls through to the store redirect.

---

## Content Security Policy Gotchas

Two CSP-related bugs were hit and fixed while building this page — both
worth knowing before touching it again, since neither fails loudly in a
way that's obvious from the server side.

**1. `script-src-attr 'none'` blocks inline `onclick="..."`.**
`server.cjs`'s Helmet config sets `script-src: ["'self'", "'unsafe-inline'"]`,
which allows inline `<script>` blocks — but `script-src-attr` is a
*separate* CSP directive covering inline event-handler attributes
(`onclick`, `onchange`, etc.), and it isn't overridden, so it falls back to
Helmet's default of `'none'`. An `onclick="openApp()"` attribute throws
`Executing inline event handler violates... script-src-attr 'none'` in the
browser console and is silently blocked — no server-side symptom at all.
**All click handlers on this page must be wired via `addEventListener`,
never inline `onclick`.**

**2. `img-src` didn't allow the S3 bucket.**
Helmet's default `img-src` is `'self' data:`. Card banner images are
presigned S3 URLs — a different origin — so they'd silently fail to load
under the default policy (no card image ever rendering, no console error
obvious unless you check the Network tab). Fixed by adding the bucket's
origin, built from existing env vars:

```js
// server.cjs
const s3ImageOrigin = process.env.AWS_S3_BUCKET
  ? `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`
  : null;
// ...
"img-src": ["'self'", "data:", ...(s3ImageOrigin ? [s3ImageOrigin] : [])]
```

If the S3 bucket is ever migrated or a CDN/CloudFront domain is put in
front of it, this directive needs the new origin added or card images on
this page (and nowhere else — this CSP is server-wide) go dark again.

---

## Like Count Display

The like count shown next to the heart button (`displayLikeCount` in
`SubActionCard`) is **not** the raw count of `HomeCardLike` rows. Every
`HomeCard` has a `likeCountBase` — a random integer in `[100, 500]`,
rolled once at creation (`POST /api/admin/home-cards`) and backfilled for
pre-existing cards via the `add_home_card_like_count_base` migration — so
a brand-new card never visibly displays "0 likes". The number rendered on
mobile is always `likeCountBase + <real likes>`, returned as `likeCount`
by the *authenticated* `GET /api/config/home-cards` list route. The public
`/share/:id` route this page calls does **not** include `likeCount` in its
response at all, and the share page has no like-count UI — this field only
exists on the in-app card, not the shared web page.

**Lessons have an analogous `shareCountBase`**, added to `schema.prisma`'s
`Lesson` model — a random integer in `[100, 500]` rolled once in
`POST /api/admin/lessons` (not regenerated on edit). Unlike the Home Card
number, this isn't `base + <real count>`: there's no real "share" event
tracking for lessons (sharing isn't a toggle like a like), so the
authenticated `GET /api/lessons/:id` route just returns the base directly as
`shareCount`. It's shown next to the share icon whenever it's `> 0` on
`LessonReadScreen.tsx`, `LearnScreen_v3.tsx`'s Read modal, and
`LessonViewerScreen_v2.tsx` (the audio-first player). Same asymmetry as
`likeCount` above: the public `/api/lessons/share/:id` route (what
`share-lesson.html` calls) does not include `shareCount`, and the share page
itself has no share-count UI.

---

## Assets

| File | Purpose | Source |
|---|---|---|
| `public/images/nora-icon.png` | 28×28 app icon next to the "Nora" wordmark in the top nav | Resized from `nora-mobile/assets/icon.png` (512×512) via `sips` |
| `public/images/share-cta.jpg` | Bottom CTA hero image ("Want help putting this into practice?") | Copied from `nora-mobile/assets/images/Share_CTA.jpg` |
| `public/images/nora-dragon.png` | Unused leftover from an earlier CTA layout (hand-coded badge/headline/mascot before it was replaced by `share-cta.jpg`) | Resized from `nora-mobile/assets/images/dragon_waving.png` |

None of these are processed by a build step — if the source design files
change, the `public/images/*` copies must be regenerated and re-committed
by hand (`sips -Z <size> <src> --out <dest>` or a straight `cp`).

---

## Local Development

```bash
npm run server        # or: node server.cjs — serves both the API and public/
```

Then open, with a real Home Card's id:

```
http://localhost:3001/share-home-card.html?card_id=<cardId>
```

Get a card id from the dev DB:

```bash
node -e "
const prisma = require('./server/services/db.cjs');
prisma.homeCard.findMany({ select: { id: true, cardType: true, isActive: true } })
  .then(r => console.log(r))
  .finally(() => prisma.\$disconnect());
"
```

No mobile app or Expo build is needed to test the page itself — only the
"tap share in the app" *entry point* requires a running mobile build.
