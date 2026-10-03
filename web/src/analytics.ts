import type { PartnerInfo } from './contexts/OnboardingContext';

// Same Amplitude project as the mobile app (nora-mobile/src/services/amplitudeService.ts),
// so a user's web signup funnel and in-app activity join up on their user id. Events
// follow the mobile naming ('Screen Viewed', 'User Signed Up', …) and carry the same
// `environment` tag; `platform: 'web-signup'` separates them from app events.
const AMPLITUDE_API_KEY = '6afe0ca3eac4c17cfad1a6cff1ce7d28';

// Only the live signup site counts as production — local dev and preview deploys don't.
const ENVIRONMENT = window.location.hostname === 'signup.hinora.co' ? 'production' : 'development';

// The SDK (~70 kB gzipped) is loaded lazily so it never delays the landing page; calls
// made before it arrives are queued and replayed in order.
type Amplitude = typeof import('@amplitude/analytics-browser');
let sdk: Amplitude | null = null;
let disabled = false;
const queue: ((a: Amplitude) => void)[] = [];

function withSdk(fn: (a: Amplitude) => void) {
  if (disabled) return;
  if (!sdk) {
    queue.push(fn);
    return;
  }
  try {
    fn(sdk);
  } catch (err) {
    console.error('[Amplitude] call failed:', err);
  }
}

// Where the visitor came from, captured when the app first loads — before a /p/ or /join/
// redirect rewrites the URL, which can happen before the lazy SDK's own attribution runs.
const ENTRY_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ttclid'];
const entry: Record<string, string> = (() => {
  const params = new URLSearchParams(window.location.search);
  const out: Record<string, string> = { entryPath: window.location.pathname };
  for (const key of ENTRY_PARAMS) {
    const value = params.get(key);
    if (value) out[key] = value.slice(0, 200);
  }
  if (document.referrer && !document.referrer.startsWith(window.location.origin)) {
    out.entryReferrer = document.referrer.slice(0, 300);
  }
  return out;
})();

/** Entry URL params + referrer, for the 'Signup Link Opened' event (also set as initial_* user properties). */
export function entryAttribution() {
  return entry;
}

// Campaign attribution added to every event (set from OnboardingContext by AnalyticsTracker).
let campaignProps: Record<string, string | null> = {};

let initStarted = false;

export function initAnalytics() {
  if (initStarted) return;
  initStarted = true;
  import('@amplitude/analytics-browser').then(amplitude => {
    amplitude.init(AMPLITUDE_API_KEY, undefined, {
      // Screen views are tracked explicitly per route (trackScreenView) so they get
      // readable names. The SDK's attribution is off: it reads the URL when the lazy SDK
      // loads, which is often after a /p/ redirect to '/', and would then record every
      // initial_utm_* as EMPTY. The `entry` capture below replaces it.
      autocapture: {
        attribution: false,
        pageViews: false,
        sessions: true,
        formInteractions: false,
        fileDownloads: false,
        elementInteractions: false,
      },
      trackingOptions: { ipAddress: false }, // matches the mobile app
      logLevel: amplitude.Types.LogLevel.Warn,
    });
    sdk = amplitude;
    // Acquisition for every visitor (signed up or not); set-once so a later visit
    // through another link doesn't overwrite how they first arrived.
    const identify = new amplitude.Identify();
    for (const [key, value] of Object.entries(entry)) identify.setOnce(`initial_${key}`, value);
    amplitude.identify(identify);
    queue.splice(0).forEach(withSdk);
  }).catch(err => {
    // Blocked by an ad blocker or offline — analytics just stays off.
    disabled = true;
    queue.length = 0;
    console.warn('[Amplitude] unavailable:', err);
  });
}

export function setCampaignContext(partnerInfo: PartnerInfo | null, referralCode: string | null) {
  campaignProps = referralCode
    ? { linkType: 'referral', partnerSlug: null, partnerKind: null, messageKey: null, source: null }
    : partnerInfo
      ? {
          linkType: partnerInfo.kind === 'CAMPAIGN' ? 'campaign' : 'partner',
          partnerSlug: partnerInfo.slug,
          partnerKind: partnerInfo.kind ?? null,
          messageKey: partnerInfo.messageKey ?? null,
          source: partnerInfo.source ?? null,
        }
      : { linkType: 'direct', partnerSlug: null, partnerKind: null, messageKey: null, source: null };
}

export function trackEvent(name: string, props: Record<string, unknown> = {}) {
  // Snapshot the campaign context now, not when a queued call replays.
  const eventProps = { ...campaignProps, ...props, platform: 'web-signup', environment: ENVIRONMENT };
  withSdk(a => a.track(name, eventProps));
}

// Readable names for the signup routes, in flow order. `step` lets a funnel or chart
// sort screens without listing every name.
const SCREENS: [RegExp, string][] = [
  [/^\/$/, 'Landing'],
  [/^\/intro$/, 'Advisor Intro'],
  [/^\/create-account$/, 'Create Account'],
  [/^\/login$/, 'Login'],
  [/^\/forgot-password$/, 'Forgot Password'],
  [/^\/demo\/(\w+)$/, 'Demo'],
  [/^\/onboarding\/parenting-intro$/, 'Parenting Intro'],
  [/^\/onboarding\/name$/, 'Name'],
  [/^\/onboarding\/relationship$/, 'Relationship'],
  [/^\/onboarding\/child-name$/, 'Child Name'],
  [/^\/onboarding\/child-gender$/, 'Child Gender'],
  [/^\/onboarding\/child-birthday$/, 'Child Birthday'],
  [/^\/onboarding\/child-issue$/, 'Child Issue'],
  [/^\/onboarding\/snapshot-intro$/, 'Snapshot Intro'],
  [/^\/onboarding\/wacb\/(\d+)$/, 'WACB Question'],
  [/^\/onboarding\/behavior-profile$/, 'Behavior Profile'],
  [/^\/onboarding\/intro3$/, 'Intro 3'],
  [/^\/play\/(\d+)$/, 'Play Session'],
  [/^\/subscribe$/, 'Subscribe'],
  [/^\/success$/, 'Success'],
];

/** Screen name + detail (WACB question / play session / demo number) for a path, or null for redirect-only routes. */
export function screenForPath(pathname: string): { screen: string; step: number; detail: string | null } | null {
  if (pathname.startsWith('/p/') || pathname.startsWith('/join/')) return null; // invisible redirect screens
  for (let i = 0; i < SCREENS.length; i++) {
    const match = SCREENS[i][0].exec(pathname);
    if (match) return { screen: SCREENS[i][1], step: i, detail: match[1] ?? null };
  }
  return { screen: pathname, step: -1, detail: null };
}

export function trackScreenView(pathname: string) {
  const s = screenForPath(pathname);
  if (!s) return;
  trackEvent('Screen Viewed', { screen: s.screen, step: s.step, detail: s.detail, path: pathname });
}

/**
 * Attach the Amplitude user id after signup/login, so web events join the same user's
 * mobile app events. No email/phone is sent. The signup link is stored as set-once
 * user properties for cohorting app behaviour by acquisition campaign.
 */
export function identifyUser(userId: string) {
  const ctx = { ...campaignProps };
  withSdk(a => {
    a.setUserId(userId);
    const identify = new a.Identify();
    identify.setOnce('signupPlatform', 'web');
    identify.setOnce('signupLinkType', ctx.linkType ?? 'direct');
    if (ctx.partnerSlug) identify.setOnce('signupPartnerSlug', ctx.partnerSlug);
    if (ctx.messageKey) identify.setOnce('signupMessageKey', ctx.messageKey);
    if (ctx.source) identify.setOnce('signupSource', ctx.source);
    identify.set('environment', ENVIRONMENT);
    a.identify(identify);
  });
}
