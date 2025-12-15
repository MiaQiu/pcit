// WACB-N Survey routes
const express = require('express');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth.cjs');
const prisma = require('../services/db.cjs');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/wacb-survey
 * Submit a new WACB-N survey response
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.userId;
    const {
      parentingStressLevel,
      q1Dawdle,
      q2MealBehavior,
      q3Disobey,
      q4Angry,
      q5Scream,
      q6Destroy,
      q7ProvokeFights,
      q8Interrupt,
      q9Attention
    } = req.body;

    // Validate all required fields
    const requiredFields = [
      'parentingStressLevel',
      'q1Dawdle', 'q2MealBehavior', 'q3Disobey', 'q4Angry',
      'q5Scream', 'q6Destroy', 'q7ProvokeFights', 'q8Interrupt', 'q9Attention'
    ];

    for (const field of requiredFields) {
      if (req.body[field] === undefined || req.body[field] === null) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    // Validate scale values (1-7)
    const scaleFields = [
      parentingStressLevel, q1Dawdle, q2MealBehavior, q3Disobey,
      q4Angry, q5Scream, q6Destroy, q7ProvokeFights, q8Interrupt, q9Attention
    ];

    for (const value of scaleFields) {
      if (typeof value !== 'number' || value < 1 || value > 7) {
        return res.status(400).json({ error: 'Scale values must be between 1 and 7' });
      }
    }

    // Calculate total score
    const totalScore = q1Dawdle + q2MealBehavior + q3Disobey + q4Angry +
                      q5Scream + q6Destroy + q7ProvokeFights + q8Interrupt + q9Attention;

    // Create survey record
    const survey = await prisma.wacbSurvey.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        parentingStressLevel,
        q1Dawdle,
        q2MealBehavior,
        q3Disobey,
        q4Angry,
        q5Scream,
        q6Destroy,
        q7ProvokeFights,
        q8Interrupt,
        q9Attention,
        totalScore
      }
    });

    res.status(201).json({
      message: 'Survey submitted successfully',
      surveyId: survey.id,
      totalScore,
      submittedAt: survey.submittedAt
    });

  } catch (error) {
    console.error('Submit WACB survey error:', error);
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

    const surveys = await prisma.wacbSurvey.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const total = await prisma.wacbSurvey.count({ where: { userId } });

    res.json({ surveys, total });

  } catch (error) {
    console.error('Get WACB surveys error:', error);
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

    const survey = await prisma.wacbSurvey.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' }
    });

    if (!survey) {
      return res.status(404).json({ error: 'No surveys found' });
    }

    res.json({ survey });

  } catch (error) {
    console.error('Get latest WACB survey error:', error);
    res.status(500).json({ error: 'Failed to fetch latest survey' });
  }
});

module.exports = router;
