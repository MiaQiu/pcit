const express = require('express');
const prisma = require('../services/db.cjs');
const { requireAuth } = require('../middleware/auth.cjs');
const { resolveReportAudioUrls } = require('../services/weeklyReportService.cjs');
const { resolveDragonImageUrl } = require('../services/storage-s3.cjs');

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
 * isLiked reflects the requesting user's own heart-button state.
 */
router.get('/home-cards', requireAuth, async (req, res) => {
  try {
    const [homeCards, likes] = await Promise.all([
      prisma.homeCard.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
        select: { id: true, cardType: true, badgeText: true, badgeColor: true, message: true, messageFontSize: true, messageBold: true, messageItalic: true, attribution: true, image: true },
      }),
      prisma.homeCardLike.findMany({
        where: { userId: req.userId },
        select: { homeCardId: true },
      }),
    ]);

    const likedIds = new Set(likes.map((l) => l.homeCardId));
    const resolved = await Promise.all(homeCards.map(async ({ image, ...card }) => ({
      ...card,
      imageUrl: await resolveDragonImageUrl(image),
      isLiked: likedIds.has(card.id),
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
 * Returns the full detail (title + body) for one CONTENT home card, for the
 * screen opened by tapping its arrow. 404s for QUOTE cards, inactive cards,
 * or unknown ids — there's nothing to view in any of those cases.
 */
router.get('/home-cards/:id', requireAuth, async (req, res) => {
  try {
    const homeCard = await prisma.homeCard.findUnique({ where: { id: req.params.id } });
    if (!homeCard || !homeCard.isActive || homeCard.cardType !== 'CONTENT') {
      return res.status(404).json({ error: 'Home card not found' });
    }

    res.json({
      id: homeCard.id,
      badgeText: homeCard.badgeText,
      badgeColor: homeCard.badgeColor,
      detailTitle: homeCard.detailTitle,
      detailContent: homeCard.detailContent,
      imageUrl: await resolveDragonImageUrl(homeCard.image),
    });
  } catch (error) {
    console.error('Get home card detail error:', error);
    res.status(500).json({ error: 'Failed to fetch home card' });
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
    const homeCard = await prisma.homeCard.findUnique({ where: { id: req.params.id } });
    if (!homeCard || !homeCard.isActive) {
      return res.status(404).json({ error: 'Card not found' });
    }

    res.json({
      id: homeCard.id,
      cardType: homeCard.cardType,
      badgeText: homeCard.badgeText,
      badgeColor: homeCard.badgeColor,
      message: homeCard.message,
      messageFontSize: homeCard.messageFontSize,
      messageBold: homeCard.messageBold,
      messageItalic: homeCard.messageItalic,
      attribution: homeCard.attribution,
      detailTitle: homeCard.detailTitle,
      detailContent: homeCard.detailContent,
      imageUrl: await resolveDragonImageUrl(homeCard.image),
    });
  } catch (error) {
    console.error('Get shared home card error:', error);
    res.status(500).json({ error: 'Failed to fetch card' });
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
