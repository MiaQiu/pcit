const express = require('express');
const prisma = require('../services/db.cjs');
const { requireAuth } = require('../middleware/auth.cjs');

const router = express.Router();

const DEFAULT_REPORT_VISIBILITY = { daily: false, weekly: false, monthly: false };

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

    res.json(report);
  } catch (error) {
    console.error('Get weekly report error:', error);
    res.status(500).json({ error: 'Failed to fetch weekly report' });
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
