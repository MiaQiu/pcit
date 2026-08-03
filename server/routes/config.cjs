const express = require('express');
const prisma = require('../services/db.cjs');
const { requireAuth } = require('../middleware/auth.cjs');
const { resolveReportAudioUrls } = require('../services/weeklyReportService.cjs');
const { resolveDragonImageUrl } = require('../services/storage-s3.cjs');
const { buildShareCardImage, lightenHexColor } = require('../services/shareImage.cjs');

const router = express.Router();

const DEFAULT_REPORT_VISIBILITY = { daily: false, weekly: false, monthly: false };

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
 * active only, in display order. CONTENT cards link to a detail page (fetch
 * the full body via GET /api/config/home-cards/:id); QUOTE cards don't.
 * isLiked reflects the requesting user's own heart-button state. likeCount
 * is likeCountBase (a random per-card offset rolled once at creation — see
 * schema.prisma) plus the real HomeCardLike row count, so the number shown
 * never starts at zero but still goes up 1-for-1 with real likes.
 */
router.get('/home-cards', requireAuth, async (req, res) => {
  try {
    const [homeCards, likes] = await Promise.all([
      prisma.homeCard.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
        select: { id: true, cardType: true, message: true, messageFontSize: true, messageBold: true, messageItalic: true, attribution: true, image: true, likeCountBase: true, badge: { select: { name: true, color: true } }, _count: { select: { likes: true } } },
      }),
      prisma.homeCardLike.findMany({
        where: { userId: req.userId },
        select: { homeCardId: true },
      }),
    ]);

    const likedIds = new Set(likes.map((l) => l.homeCardId));
    const resolved = await Promise.all(homeCards.map(async ({ image, badge, likeCountBase, _count, ...card }) => ({
      ...card,
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
 * GET /api/config/home-cards/:id
 * Returns the full detail (title + ordered components) for one CONTENT home
 * card, for the screen opened by tapping its arrow. 404s for QUOTE cards,
 * inactive cards, or unknown ids — there's nothing to view in any of those
 * cases. USER_INPUT components include the requesting user's own saved
 * answer, if any.
 */
router.get('/home-cards/:id', requireAuth, async (req, res) => {
  try {
    const homeCard = await prisma.homeCard.findUnique({
      where: { id: req.params.id },
      include: { badge: true, components: { orderBy: { order: 'asc' } } },
    });
    if (!homeCard || !homeCard.isActive || homeCard.cardType !== 'CONTENT') {
      return res.status(404).json({ error: 'Home card not found' });
    }

    const inputComponentIds = homeCard.components.filter((c) => c.type === 'USER_INPUT').map((c) => c.id);
    const responses = inputComponentIds.length > 0
      ? await prisma.homeCardUserInputResponse.findMany({
          where: { componentId: { in: inputComponentIds }, userId: req.userId },
          select: { componentId: true, answer: true },
        })
      : [];
    const answersByComponentId = new Map(responses.map((r) => [r.componentId, r.answer]));

    const components = await Promise.all(homeCard.components.map(async ({ image, ...c }) => ({
      id: c.id,
      type: c.type,
      text: c.text,
      imageUrl: await resolveDragonImageUrl(image),
      linkedCardId: c.linkedCardId,
      ctaLabel: c.ctaLabel,
      inputLabel: c.inputLabel,
      inputPlaceholder: c.inputPlaceholder,
      userAnswer: c.type === 'USER_INPUT' ? (answersByComponentId.get(c.id) ?? null) : undefined,
    })));

    res.json({
      id: homeCard.id,
      badgeText: homeCard.badge.name,
      badgeColor: homeCard.badge.color,
      detailTitle: homeCard.detailTitle,
      // Included so the share sheet can derive the same title/subtitle split
      // used everywhere else this card is shared from (see
      // getHomeCardShareText in nora-mobile) — detailTitle itself is never
      // shown on the card, only as this page's own heading.
      message: homeCard.message,
      imageUrl: await resolveDragonImageUrl(homeCard.image),
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
 */
router.get('/home-cards/:id/share-image.png', async (req, res) => {
  try {
    const homeCard = await prisma.homeCard.findUnique({
      where: { id: req.params.id },
      include: { badge: true },
    });
    if (!homeCard || !homeCard.isActive) return res.status(404).end();

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
