const express = require('express');
const prisma = require('../services/db.cjs');
const { requireAuth } = require('../middleware/auth.cjs');
const { resolveReportAudioUrls } = require('../services/weeklyReportService.cjs');
const { resolveDragonImageUrl } = require('../services/storage-s3.cjs');
const { buildShareCardImage, lightenHexColor } = require('../services/shareImage.cjs');
const { getUserMatchContext } = require('../services/priorityEngine.cjs');
const { localeMiddleware } = require('../middleware/locale.cjs');

const router = express.Router();
router.use(localeMiddleware);

const DEFAULT_REPORT_VISIBILITY = { daily: false, weekly: false, monthly: false };

/**
 * Merges a HomeCardTranslation row onto its base (English) HomeCard —
 * per-field fallback, same convention as applyLessonTx in lessons.cjs. `tx`
 * is null for locale 'en' or when no translation row exists yet.
 */
function applyHomeCardTx(card, tx) {
  if (!tx) return card;
  return {
    ...card,
    message: tx.message ?? card.message,
    attribution: tx.attribution ?? card.attribution,
    detailTitle: tx.detailTitle ?? card.detailTitle,
  };
}

/**
 * Merges a HomeCardComponentTranslation row onto its base component.
 */
function applyHomeCardComponentTx(component, tx) {
  if (!tx) return component;
  return {
    ...component,
    text: tx.text ?? component.text,
    ctaLabel: tx.ctaLabel ?? component.ctaLabel,
    inputLabel: tx.inputLabel ?? component.inputLabel,
    inputPlaceholder: tx.inputPlaceholder ?? component.inputPlaceholder,
  };
}

// Home Card ranking weights (see getUserMatchContext in priorityEngine.cjs
// for how a user's tagWeights/childAges/childGenders are resolved).
const HOME_CARD_NEUTRAL_SCORE = 1;
const HOME_CARD_AGE_MATCH_WEIGHT = 2;
const HOME_CARD_GENDER_MATCH_WEIGHT = 1;

/**
 * A card is a match only if every targeting dimension it sets is satisfied
 * (AND across dimension-types — a "boys, age 2-4" card shouldn't rank as a
 * match for a girl just because her age fits). Multiple values within
 * targetTags itself still OR together (alternative relevant concerns).
 */
function homeCardIsMatch(card, ctx) {
  if (card.targetTags.length > 0 && !card.targetTags.some((t) => ctx.tagWeights.has(t))) return false;
  if ((card.minAgeMonths != null || card.maxAgeMonths != null) &&
      !ctx.childAges.some((age) => age >= (card.minAgeMonths ?? 0) && age <= (card.maxAgeMonths ?? Infinity))) {
    return false;
  }
  if (card.targetGender != null && !ctx.childGenders.includes(card.targetGender)) return false;
  return true;
}

/**
 * Scores a card for ranking: NEUTRAL for a general (untargeted) card, 0 for
 * a targeted card that fails ≥1 of its dimensions, or NEUTRAL + weight for a
 * genuine match — weight grades how much/how strongly it matched, so
 * multi-dimension or higher-weight matches rank above a single weak one.
 */
function homeCardScore(card, ctx) {
  const tagsSet = card.targetTags.length > 0;
  const ageSet = card.minAgeMonths != null || card.maxAgeMonths != null;
  const genderSet = card.targetGender != null;
  if (!tagsSet && !ageSet && !genderSet) return HOME_CARD_NEUTRAL_SCORE;
  if (!homeCardIsMatch(card, ctx)) return 0;

  let weight = 0;
  for (const tag of card.targetTags) weight += ctx.tagWeights.get(tag) || 0;
  if (ageSet) weight += HOME_CARD_AGE_MATCH_WEIGHT;
  if (genderSet) weight += HOME_CARD_GENDER_MATCH_WEIGHT;
  return HOME_CARD_NEUTRAL_SCORE + weight;
}

// 'YYYY-MM-DD' in Singapore time — same SGT_OFFSET_MS convention already
// used for day-boundary math in recordings.cjs/the daily jobs, just wrapped
// as a calendar-label string here instead of a Date.
function getSingaporeDateString(date = new Date()) {
  const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;
  return new Date(date.getTime() + SGT_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Picks (and durably records) this user's single "Nora Daily" card for
 * today — mobile only ever renders the top of the ranked list
 * (HomeScreen_v2.tsx shows homeCards[0]), so without this the same
 * highest-scoring card would freeze in that slot forever once ranking
 * inputs (issue/parentGoal/child age etc.) stop changing.
 *
 * The returned HomeCardImpression row IS the "this was displayed" record —
 * created the first time this runs on a given Singapore-calendar day,
 * regardless of whether the user goes on to tap/like/share the card, then
 * reused for the rest of that day (a pull-to-refresh mid-day shouldn't
 * change the pick out from under them).
 *
 * Rotation: prefers the least-recently-shown ELIGIBLE card (score > 0 —
 * general or a genuine match; never one explicitly targeted at someone
 * else) — never-shown cards first, then whichever eligible card has gone
 * longest without being shown, so the pick keeps moving through the whole
 * catalog indefinitely instead of freezing once ranking inputs stop
 * changing, or (an earlier version of this function's bug) degenerating
 * into long same-card/same-badge streaks once every card had been shown at
 * least once — a plain "already seen?" boolean can't tell a card shown
 * yesterday from one shown two months ago, so once every card had a mark
 * against it, ties broke back onto displayOrder and a badge that happens to
 * sort first (e.g. "Today's Thought", 30+ consecutive cards) would win
 * night after night.
 *
 * Badge-type diversity: cards are heavily clustered by badge in
 * displayOrder (e.g. that same 30+ card run), so even LRU-by-card alone
 * could still hand back the same badge on consecutive days. Among the
 * LRU-ordered candidates, prefer one whose badge differs from the last few
 * days actually shown; only fall back to ignoring badge if that empties
 * the set (e.g. only one badge type remains eligible at all).
 */
const HOME_CARD_RECENT_TYPE_LOOKBACK = 3;
// Generous window over this user's impression history — enough to cover a
// last-shown-date lookup for every card in a ~50-card catalog with room to
// spare, while keeping the query bounded for long-tenured users. A card
// whose last showing falls outside this window is treated as "never shown"
// (ranks first), which is the desired behavior anyway — that long ago is
// effectively as fresh as never.
const HOME_CARD_HISTORY_WINDOW = 90;

async function pickTodaysCard(userId, sortedHomeCards, matchContext) {
  const today = getSingaporeDateString();

  const existing = await prisma.homeCardImpression.findUnique({
    where: { userId_shownDate: { userId, shownDate: today } },
  });
  // Honor an already-decided pick for today, unless that card has since
  // gone inactive/been deleted (fall through and pick a fresh one).
  if (existing && sortedHomeCards.some((c) => c.id === existing.homeCardId)) {
    return existing.homeCardId;
  }

  const eligible = sortedHomeCards.filter((c) => homeCardScore(c, matchContext) > 0);
  const pool = eligible.length > 0 ? eligible : sortedHomeCards;

  const history = await prisma.homeCardImpression.findMany({
    where: { userId },
    orderBy: { shownDate: 'desc' },
    take: HOME_CARD_HISTORY_WINDOW,
    select: { homeCardId: true, shownDate: true, HomeCard: { select: { badge: { select: { name: true } } } } },
  });
  // Most-recent-first, so the first entry per homeCardId is that card's
  // last-shown date.
  const lastShownDate = new Map();
  for (const h of history) {
    if (!lastShownDate.has(h.homeCardId)) lastShownDate.set(h.homeCardId, h.shownDate);
  }
  const recentBadgeNames = new Set(history.slice(0, HOME_CARD_RECENT_TYPE_LOOKBACK).map((h) => h.HomeCard.badge.name));

  // Never-shown first, then oldest-shown-first; ties (both never shown)
  // preserve pool's existing score/displayOrder order via a stable sort.
  const byRecency = [...pool].sort((a, b) => {
    const aShown = lastShownDate.get(a.id);
    const bShown = lastShownDate.get(b.id);
    if (!aShown && !bShown) return 0;
    if (!aShown) return -1;
    if (!bShown) return 1;
    return aShown < bShown ? -1 : aShown > bShown ? 1 : 0;
  });
  const diversified = byRecency.filter((c) => !recentBadgeNames.has(c.badge.name));
  const chosen = (diversified.length > 0 ? diversified : byRecency)[0];

  await prisma.homeCardImpression.upsert({
    where: { userId_shownDate: { userId, shownDate: today } },
    create: { userId, shownDate: today, homeCardId: chosen.id },
    update: {}, // first writer wins for the day — race-safe against a double fetch
  });
  return chosen.id;
}

/**
 * GET /api/config/app-version
 * Returns the minimum required app version. No auth required.
 * Bump minRequiredVersion to force users on older versions to update.
 */
router.get('/app-version', (req, res) => {
  res.json({
    minRequiredVersion: '1.0.5',
    latestVersion: '1.0.5',
    whatsNew: [
      'Exciting new user experience',
      'Fresh learning modules to dive into',
    ],
  });
});

/**
 * GET /api/config/report-visibility
 * Returns report visibility settings for mobile app
 */
router.get('/report-visibility', requireAuth, async (req, res) => {
  try {
    const config = await prisma.appConfig.findUnique({
      where: { key: 'report-visibility' }
    });

    res.json(config ? config.value : DEFAULT_REPORT_VISIBILITY);
  } catch (error) {
    console.error('Get report visibility error:', error);
    res.status(500).json({ error: 'Failed to fetch report visibility settings' });
  }
});

/**
 * GET /api/config/home-cards
 * Returns admin-configured sub-action cards for the mobile Home screen,
 * active only, ranked for the requesting user then broken by display order.
 * CONTENT cards link to a detail page (fetch the full body via GET
 * /api/config/home-cards/:id); QUOTE cards don't. isLiked reflects the
 * requesting user's own heart-button state. likeCount is likeCountBase (a
 * random per-card offset rolled once at creation — see schema.prisma) plus
 * the real HomeCardLike row count, so the number shown never starts at zero
 * but still goes up 1-for-1 with real likes.
 *
 * Ranking: cards may optionally target topic tags / an age range / a gender
 * (see homeCardScore above and getUserMatchContext in priorityEngine.cjs).
 * Untargeted cards are "general" and always rank above a card targeted at
 * someone else, but below a real match. Array.prototype.sort is stable, so
 * displayOrder still breaks ties within each score tier.
 *
 * Localized via ?lang= / Accept-Language (localeMiddleware sets req.locale,
 * same as GET /api/lessons). message/attribution fall back to the English
 * base row per-field when a HomeCardTranslation exists but is incomplete —
 * see applyHomeCardTx.
 *
 * "Nora Daily" rotation: mobile only renders homeCards[0] (see
 * HomeScreen_v2.tsx), so pickTodaysCard forces that slot to a durably-
 * recorded, per-user-per-day pick — the top-scoring card the user hasn't
 * already been shown — instead of always freezing on the single highest
 * scorer. See pickTodaysCard above for the rotation/reset rules.
 */
router.get('/home-cards', requireAuth, async (req, res) => {
  try {
    const locale = req.locale;
    const [homeCards, likes, matchContext] = await Promise.all([
      prisma.homeCard.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
        select: { id: true, cardType: true, message: true, messageFontSize: true, messageBold: true, messageItalic: true, attribution: true, image: true, likeCountBase: true, targetTags: true, minAgeMonths: true, maxAgeMonths: true, targetGender: true, badge: { select: { name: true, color: true } }, _count: { select: { likes: true } } },
      }),
      prisma.homeCardLike.findMany({
        where: { userId: req.userId },
        select: { homeCardId: true },
      }),
      getUserMatchContext(req.userId),
    ]);

    // Fetch this locale's translations for the fetched cards (English never
    // needs a lookup — the base row already is English).
    const translationsById = new Map();
    if (locale !== 'en' && homeCards.length > 0) {
      const txs = await prisma.homeCardTranslation.findMany({
        where: { locale, homeCardId: { in: homeCards.map((c) => c.id) } },
      });
      for (const tx of txs) translationsById.set(tx.homeCardId, tx);
    }

    homeCards.sort((a, b) => homeCardScore(b, matchContext) - homeCardScore(a, matchContext));

    // Force today's rotated pick to the front — mobile only renders
    // homeCards[0], so this is what actually determines "today's card"
    // (everything else stays in its existing score/displayOrder position).
    const todaysCardId = await pickTodaysCard(req.userId, homeCards, matchContext);
    const todaysIdx = homeCards.findIndex((c) => c.id === todaysCardId);
    if (todaysIdx > 0) {
      const [todaysCard] = homeCards.splice(todaysIdx, 1);
      homeCards.unshift(todaysCard);
    }

    const likedIds = new Set(likes.map((l) => l.homeCardId));
    const resolved = await Promise.all(homeCards.map(async ({ image, badge, likeCountBase, _count, targetTags, minAgeMonths, maxAgeMonths, targetGender, ...card }) => ({
      ...applyHomeCardTx(card, translationsById.get(card.id)),
      badgeText: badge.name,
      badgeColor: badge.color,
      imageUrl: await resolveDragonImageUrl(image),
      isLiked: likedIds.has(card.id),
      likeCount: likeCountBase + _count.likes,
    })));
    res.json({ homeCards: resolved });
  } catch (error) {
    console.error('Get home cards error:', error);
    res.status(500).json({ error: 'Failed to fetch home cards' });
  }
});

/**
 * POST /api/config/home-cards/:id/like
 * Toggles the requesting user's like on a home card. Body: { liked: boolean }
 * — the desired end state, so retries/double-taps are idempotent rather than
 * flipping back and forth.
 */
router.post('/home-cards/:id/like', requireAuth, async (req, res) => {
  try {
    const homeCard = await prisma.homeCard.findUnique({ where: { id: req.params.id } });
    if (!homeCard || !homeCard.isActive) {
      return res.status(404).json({ error: 'Home card not found' });
    }

    const liked = !!req.body.liked;
    if (liked) {
      await prisma.homeCardLike.upsert({
        where: { homeCardId_userId: { homeCardId: req.params.id, userId: req.userId } },
        update: {},
        create: { homeCardId: req.params.id, userId: req.userId },
      });
    } else {
      await prisma.homeCardLike.deleteMany({
        where: { homeCardId: req.params.id, userId: req.userId },
      });
    }

    res.json({ liked });
  } catch (error) {
    console.error('Toggle home card like error:', error);
    res.status(500).json({ error: 'Failed to update like' });
  }
});

/**
 * POST /api/config/home-cards/:id/view
 * Upserts a HomeCardView row for the requesting user — "displayed" is
 * defined as opening a CONTENT card's detail page (fired from
 * HomeCardDetailScreen's load effect). QUOTE cards have no detail page and
 * are never "opened" in the current UI (no tap target at all) — this
 * returns 400 rather than silently no-op-ing, so a client bug calling this
 * for a QUOTE card stays visible.
 */
router.post('/home-cards/:id/view', requireAuth, async (req, res) => {
  try {
    const homeCard = await prisma.homeCard.findUnique({ where: { id: req.params.id } });
    if (!homeCard || !homeCard.isActive) return res.status(404).json({ error: 'Home card not found' });
    if (homeCard.cardType !== 'CONTENT') return res.status(400).json({ error: 'Only CONTENT cards support view tracking' });

    const existing = await prisma.homeCardView.findUnique({
      where: { homeCardId_userId: { homeCardId: req.params.id, userId: req.userId } },
    });
    if (existing) {
      await prisma.homeCardView.update({
        where: { id: existing.id },
        data: { lastViewedAt: new Date(), viewCount: { increment: 1 } },
      });
    } else {
      await prisma.homeCardView.create({ data: { homeCardId: req.params.id, userId: req.userId } });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Record home card view error:', error);
    res.status(500).json({ error: 'Failed to record view' });
  }
});

/**
 * POST /api/config/home-cards/:id/share
 * Appends a HomeCardShare row — any card type, one row per share action (not
 * deduped), fired alongside the existing 'Home Card Shared' Amplitude event
 * from both the feed card and the detail page's share button.
 */
router.post('/home-cards/:id/share', requireAuth, async (req, res) => {
  try {
    const homeCard = await prisma.homeCard.findUnique({ where: { id: req.params.id } });
    if (!homeCard || !homeCard.isActive) return res.status(404).json({ error: 'Home card not found' });

    await prisma.homeCardShare.create({ data: { homeCardId: req.params.id, userId: req.userId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Record home card share error:', error);
    res.status(500).json({ error: 'Failed to record share' });
  }
});

/**
 * GET /api/config/home-cards/:id
 * Returns the full detail (title + ordered components) for one CONTENT home
 * card, for the screen opened by tapping its arrow. 404s for QUOTE cards,
 * inactive cards, or unknown ids — there's nothing to view in any of those
 * cases. USER_INPUT components include the requesting user's own saved
 * answer, if any. Localized via ?lang= / Accept-Language, same as GET
 * /api/config/home-cards.
 */
router.get('/home-cards/:id', requireAuth, async (req, res) => {
  try {
    const locale = req.locale;
    const homeCard = await prisma.homeCard.findUnique({
      where: { id: req.params.id },
      include: { badge: true, components: { orderBy: { order: 'asc' } } },
    });
    if (!homeCard || !homeCard.isActive || homeCard.cardType !== 'CONTENT') {
      return res.status(404).json({ error: 'Home card not found' });
    }

    const inputComponentIds = homeCard.components.filter((c) => c.type === 'USER_INPUT').map((c) => c.id);
    const [responses, cardTx, componentTxs] = await Promise.all([
      inputComponentIds.length > 0
        ? prisma.homeCardUserInputResponse.findMany({
            where: { componentId: { in: inputComponentIds }, userId: req.userId },
            select: { componentId: true, answer: true },
          })
        : [],
      locale !== 'en'
        ? prisma.homeCardTranslation.findUnique({ where: { homeCardId_locale: { homeCardId: homeCard.id, locale } } })
        : null,
      locale !== 'en' && homeCard.components.length > 0
        ? prisma.homeCardComponentTranslation.findMany({
            where: { locale, componentId: { in: homeCard.components.map((c) => c.id) } },
          })
        : [],
    ]);
    const answersByComponentId = new Map(responses.map((r) => [r.componentId, r.answer]));
    const componentTxById = new Map(componentTxs.map((tx) => [tx.componentId, tx]));
    const card = applyHomeCardTx(homeCard, cardTx);

    const components = await Promise.all(homeCard.components.map(async (rawComponent) => {
      const { image, ...c } = applyHomeCardComponentTx(rawComponent, componentTxById.get(rawComponent.id));
      return {
        id: c.id,
        type: c.type,
        text: c.text,
        imageUrl: await resolveDragonImageUrl(image),
        linkedCardId: c.linkedCardId,
        ctaLabel: c.ctaLabel,
        inputLabel: c.inputLabel,
        inputPlaceholder: c.inputPlaceholder,
        userAnswer: c.type === 'USER_INPUT' ? (answersByComponentId.get(c.id) ?? null) : undefined,
      };
    }));

    res.json({
      id: card.id,
      badgeText: card.badge.name,
      badgeColor: card.badge.color,
      detailTitle: card.detailTitle,
      // Included so the share sheet can derive the same title/subtitle split
      // used everywhere else this card is shared from (see
      // getHomeCardShareText in nora-mobile) — detailTitle itself is never
      // shown on the card, only as this page's own heading.
      message: card.message,
      imageUrl: await resolveDragonImageUrl(card.image),
      components,
    });
  } catch (error) {
    console.error('Get home card detail error:', error);
    res.status(500).json({ error: 'Failed to fetch home card' });
  }
});

/**
 * POST /api/config/home-cards/:cardId/components/:componentId/input
 * Saves (upserts) the requesting user's free-text answer to a USER_INPUT
 * component. Body: { answer: string }. Same idempotent upsert shape as the
 * like endpoint above — one row per user per component.
 */
router.post('/home-cards/:cardId/components/:componentId/input', requireAuth, async (req, res) => {
  try {
    const { cardId, componentId } = req.params;
    const answer = typeof req.body.answer === 'string' ? req.body.answer.trim() : '';
    if (!answer) return res.status(400).json({ error: 'answer is required' });

    const component = await prisma.homeCardComponent.findUnique({
      where: { id: componentId },
      include: { homeCard: true },
    });
    if (
      !component ||
      component.homeCardId !== cardId ||
      component.type !== 'USER_INPUT' ||
      !component.homeCard.isActive
    ) {
      return res.status(404).json({ error: 'Component not found' });
    }

    const response = await prisma.homeCardUserInputResponse.upsert({
      where: { componentId_userId: { componentId, userId: req.userId } },
      update: { answer },
      create: { componentId, userId: req.userId, answer },
    });

    res.json({ answer: response.answer });
  } catch (error) {
    console.error('Save home card input error:', error);
    res.status(500).json({ error: 'Failed to save answer' });
  }
});

/**
 * GET /api/config/home-cards/share/:id
 * Public (no auth) — powers /share-home-card.html, the web landing page a
 * non-user opens from a shared link. Returns everything either card layout
 * (QUOTE or CONTENT) needs to render, so the page never has to guess.
 */
router.get('/home-cards/share/:id', async (req, res) => {
  try {
    const homeCard = await prisma.homeCard.findUnique({
      where: { id: req.params.id },
      include: { badge: true, components: { orderBy: { order: 'asc' } } },
    });
    if (!homeCard || !homeCard.isActive) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // USER_INPUT is skipped — there's no user session on this public page.
    const components = await Promise.all(
      homeCard.components
        .filter((c) => c.type !== 'USER_INPUT')
        .map(async ({ image, ...c }) => ({
          type: c.type,
          text: c.text,
          imageUrl: await resolveDragonImageUrl(image),
          linkedCardId: c.linkedCardId,
          ctaLabel: c.ctaLabel,
        }))
    );

    res.json({
      id: homeCard.id,
      cardType: homeCard.cardType,
      badgeText: homeCard.badge.name,
      badgeColor: homeCard.badge.color,
      message: homeCard.message,
      messageFontSize: homeCard.messageFontSize,
      messageBold: homeCard.messageBold,
      messageItalic: homeCard.messageItalic,
      attribution: homeCard.attribution,
      detailTitle: homeCard.detailTitle,
      imageUrl: await resolveDragonImageUrl(homeCard.image),
      components,
    });
  } catch (error) {
    console.error('Get shared home card error:', error);
    res.status(500).json({ error: 'Failed to fetch card' });
  }
});

/**
 * GET /api/config/home-cards/:id/share-image.png
 * Public (no auth) — the shared title/subtitle/thumbnail card (see
 * server/services/shareImage.cjs) built from the card's own fields, no new
 * admin-authored copy needed. Used BOTH as the mobile ShareSheet's in-app
 * preview AND as the og:image injected into share-home-card.html (see
 * server.cjs).
 *
 * Title/subtitle mapping mirrors what's actually visible on the card in the
 * app, not just any field that happens to be named "title":
 *   QUOTE   — title = message (the quote itself), subtitle = attribution
 *   CONTENT — title/subtitle = message split on its first newline (the same
 *             headline/description split SubActionCard renders on the card
 *             itself — see splitMessageBlocks in HomeScreen_v2.tsx).
 *             detailTitle is deliberately NOT used here: it's never shown on
 *             the card, only as the detail page's own heading.
 *
 * Localized via ?lang= (the mobile ShareSheet's in-app preview passes the
 * viewer's i18n.language; the public og:image URL injected by server.cjs
 * omits it and stays English, since that page has no per-user locale to go
 * on). badgeText is intentionally not translated — same scope as elsewhere.
 */
router.get('/home-cards/:id/share-image.png', async (req, res) => {
  try {
    const locale = req.locale;
    const rawCard = await prisma.homeCard.findUnique({
      where: { id: req.params.id },
      include: { badge: true },
    });
    if (!rawCard || !rawCard.isActive) return res.status(404).end();

    const cardTx = locale !== 'en'
      ? await prisma.homeCardTranslation.findUnique({ where: { homeCardId_locale: { homeCardId: rawCard.id, locale } } })
      : null;
    const homeCard = applyHomeCardTx(rawCard, cardTx);

    let title = homeCard.message;
    let subtitle = homeCard.cardType === 'QUOTE' ? homeCard.attribution : null;
    let badgeText = null;
    let cardBackgroundColor = null;
    if (homeCard.cardType === 'CONTENT') {
      const newlineIndex = homeCard.message.indexOf('\n');
      title = newlineIndex === -1 ? homeCard.message : homeCard.message.slice(0, newlineIndex);
      subtitle = newlineIndex === -1 ? null : homeCard.message.slice(newlineIndex + 1);
      // Same tint SubActionCard uses for the card background — see cardBg
      // in HomeScreen_v2.tsx.
      badgeText = homeCard.badge.name;
      cardBackgroundColor = lightenHexColor(homeCard.badge.color, 0.92);
    }
    const thumbnailUrl = await resolveDragonImageUrl(homeCard.image);

    const png = await buildShareCardImage({
      title,
      subtitle,
      thumbnailUrl,
      badgeText,
      badgeColor: homeCard.cardType === 'CONTENT' ? homeCard.badge.color : null,
      backgroundColor: cardBackgroundColor,
    });
    res.set('Content-Type', 'image/png');
    // TODO: restore to a real max-age (e.g. 3600) once the share-card visual
    // design has settled — no-cache while we're actively tuning it so RN's
    // Image cache doesn't keep serving a stale render from before an edit.
    res.set('Cache-Control', 'no-cache');
    res.send(png);
  } catch (error) {
    console.error('Generate share image error:', error);
    res.status(500).end();
  }
});

/**
 * GET /api/config/weekly-reports
 * Returns weekly reports that are visible to the authenticated user
 */
router.get('/weekly-reports', requireAuth, async (req, res) => {
  try {
    const reports = await prisma.weeklyReport.findMany({
      where: {
        userId: req.userId,
        visibility: true,
      },
      orderBy: { weekStartDate: 'desc' },
      select: {
        id: true,
        weekStartDate: true,
        weekEndDate: true,
        headline: true,
        totalDeposits: true,
        sessionIds: true,
        markedReadAt: true,
      },
    });

    res.json({ reports });
  } catch (error) {
    console.error('Get visible weekly reports error:', error);
    res.status(500).json({ error: 'Failed to fetch weekly reports' });
  }
});

/**
 * GET /api/config/weekly-reports/:id
 * Returns a single full weekly report by ID
 */
router.get('/weekly-reports/:id', requireAuth, async (req, res) => {
  try {
    const report = await prisma.weeklyReport.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
        visibility: true,
      },
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Generate fresh presigned audio URLs for top moments
    const resolved = await resolveReportAudioUrls(report);
    res.json(resolved);
  } catch (error) {
    console.error('Get weekly report error:', error);
    res.status(500).json({ error: 'Failed to fetch weekly report' });
  }
});

/**
 * PATCH /api/config/weekly-reports/:id/mark-read
 * Sets markedReadAt on the report so dismissed state survives local storage clears
 */
router.patch('/weekly-reports/:id/mark-read', requireAuth, async (req, res) => {
  try {
    const report = await prisma.weeklyReport.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (!report.markedReadAt) {
      await prisma.weeklyReport.update({
        where: { id: req.params.id },
        data: { markedReadAt: new Date() },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Mark weekly report read error:', error);
    res.status(500).json({ error: 'Failed to mark report as read' });
  }
});

/**
 * PATCH /api/config/weekly-reports/:id/checkin
 * Saves the user's check-in responses (mood + issue ratings) from page 7
 */
router.patch('/weekly-reports/:id/checkin', requireAuth, async (req, res) => {
  try {
    const { moodSelection, issueRatings } = req.body;

    const report = await prisma.weeklyReport.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const updated = await prisma.weeklyReport.update({
      where: { id: req.params.id },
      data: {
        ...(moodSelection !== undefined && { moodSelection }),
        ...(issueRatings !== undefined && { issueRatings }),
      },
    });

    res.json({ success: true, moodSelection: updated.moodSelection, issueRatings: updated.issueRatings });
  } catch (error) {
    console.error('Save weekly checkin error:', error);
    res.status(500).json({ error: 'Failed to save check-in' });
  }
});

/**
 * GET /api/config/developmental-visibility
 * Returns whether developmental milestones are visible for the authenticated user
 */
router.get('/developmental-visibility', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { developmentalVisible: true },
    });

    res.json({ visible: user ? user.developmentalVisible : false });
  } catch (error) {
    console.error('Get developmental visibility error:', error);
    res.status(500).json({ error: 'Failed to fetch developmental visibility' });
  }
});

module.exports = router;
