// Child Snapshot survey routes (formerly "WACB-N"). Persists to the
// ChildSnapshotSurvey table; the legacy WacbSurvey table is kept for historical
// rows only and is no longer written here. Route path stays /api/wacb-survey so
// existing clients don't 404.
const express = require('express');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth.cjs');
const prisma = require('../services/db.cjs');
const { runPriorityEngine } = require('../services/priorityEngine.cjs');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// The 10 Child Snapshot behavior items, in order.
const SNAPSHOT_ITEMS = [
  'q1Dawdle',
  'q2Disobey',
  'q3Tantrum',
  'q4Defiance',
  'q5FocusDemand',
  'q6Restless',
  'q7TaskCompletion',
  'q8Destroy',
  'q9Aggression',
  'q10LieSteal',
];

/**
 * POST /api/wacb-survey
 * Submit a new Child Snapshot survey response
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.userId;
    const { parentingStressLevel } = req.body;

    // Validate all required fields
    const requiredFields = ['parentingStressLevel', ...SNAPSHOT_ITEMS];

    for (const field of requiredFields) {
      if (req.body[field] === undefined || req.body[field] === null) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    // Validate scale values (1-7)
    const scaleFields = [parentingStressLevel, ...SNAPSHOT_ITEMS.map((f) => req.body[f])];

    for (const value of scaleFields) {
      if (typeof value !== 'number' || value < 1 || value > 7) {
        return res.status(400).json({ error: 'Scale values must be between 1 and 7' });
      }
    }

    // Map raw values (1-5) to points: 1->1, 2->2, 3->4, 4->6, 5->7
    const VALUE_TO_POINTS = { 1: 1, 2: 2, 3: 4, 4: 6, 5: 7 };
    const toPoints = (v) => VALUE_TO_POINTS[v] ?? v;

    // Calculate total score across the 10 items
    const totalScore = SNAPSHOT_ITEMS.reduce((sum, f) => sum + toPoints(req.body[f]), 0);

    // Create survey record
    const survey = await prisma.childSnapshotSurvey.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        parentingStressLevel,
        ...Object.fromEntries(SNAPSHOT_ITEMS.map((f) => [f, req.body[f]])),
        totalScore,
      },
    });

    // Run priority engine after submission (fire-and-forget)
    runPriorityEngine(userId, { snapshotSurveyId: survey.id }).catch((err) => {
      console.error('[PRIORITY-ENGINE] Error after Child Snapshot survey:', err.message);
    });

    res.status(201).json({
      message: 'Survey submitted successfully',
      surveyId: survey.id,
      totalScore,
      submittedAt: survey.submittedAt,
    });
  } catch (error) {
    console.error('Submit Child Snapshot survey error:', error);
    res.status(500).json({ error: 'Failed to submit survey' });
  }
});

/**
 * GET /api/wacb-survey
 * Get user's survey history
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 10, offset = 0 } = req.query;

    const surveys = await prisma.childSnapshotSurvey.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    const total = await prisma.childSnapshotSurvey.count({ where: { userId } });

    res.json({ surveys, total });
  } catch (error) {
    console.error('Get Child Snapshot surveys error:', error);
    res.status(500).json({ error: 'Failed to fetch surveys' });
  }
});

/**
 * GET /api/wacb-survey/latest
 * Get user's most recent survey
 */
router.get('/latest', async (req, res) => {
  try {
    const userId = req.userId;

    const survey = await prisma.childSnapshotSurvey.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
    });

    if (!survey) {
      return res.status(404).json({ error: 'No surveys found' });
    }

    res.json({ survey });
  } catch (error) {
    console.error('Get latest Child Snapshot survey error:', error);
    res.status(500).json({ error: 'Failed to fetch latest survey' });
  }
});

module.exports = router;
