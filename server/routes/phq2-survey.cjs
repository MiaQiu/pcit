// PHQ-2 Survey routes
const express = require('express');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth.cjs');
const prisma = require('../services/db.cjs');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/phq2-survey
 * Submit a new PHQ-2 survey response
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.userId;
    const { q1Interest, q2Depressed, totalScore } = req.body;

    // Validate all required fields
    if (q1Interest === undefined || q1Interest === null) {
      return res.status(400).json({ error: 'Missing required field: q1Interest' });
    }
    if (q2Depressed === undefined || q2Depressed === null) {
      return res.status(400).json({ error: 'Missing required field: q2Depressed' });
    }

    // Validate values (0-3)
    if (typeof q1Interest !== 'number' || q1Interest < 0 || q1Interest > 3) {
      return res.status(400).json({ error: 'q1Interest must be between 0 and 3' });
    }
    if (typeof q2Depressed !== 'number' || q2Depressed < 0 || q2Depressed > 3) {
      return res.status(400).json({ error: 'q2Depressed must be between 0 and 3' });
    }

    // Calculate total if not provided
    const calculatedTotal = q1Interest + q2Depressed;
    const finalTotal = totalScore !== undefined ? totalScore : calculatedTotal;

    // Validate total score
    if (finalTotal !== calculatedTotal) {
      return res.status(400).json({ error: 'Total score does not match sum of answers' });
    }

    // Create survey record
    const survey = await prisma.phq2Survey.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        q1Interest,
        q2Depressed,
        totalScore: finalTotal
      }
    });

    res.status(201).json({
      message: 'Survey submitted successfully',
      surveyId: survey.id,
      totalScore: finalTotal,
      screenResult: finalTotal >= 3 ? 'positive' : 'negative',
      submittedAt: survey.submittedAt
    });

  } catch (error) {
    console.error('Submit PHQ-2 survey error:', error);
    res.status(500).json({ error: 'Failed to submit survey' });
  }
});

/**
 * GET /api/phq2-survey
 * Get user's survey history
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 10, offset = 0 } = req.query;

    const surveys = await prisma.phq2Survey.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const total = await prisma.phq2Survey.count({ where: { userId } });

    res.json({ surveys, total });

  } catch (error) {
    console.error('Get PHQ-2 surveys error:', error);
    res.status(500).json({ error: 'Failed to fetch surveys' });
  }
});

/**
 * GET /api/phq2-survey/latest
 * Get user's most recent survey
 */
router.get('/latest', async (req, res) => {
  try {
    const userId = req.userId;

    const survey = await prisma.phq2Survey.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' }
    });

    if (!survey) {
      return res.status(404).json({ error: 'No surveys found' });
    }

    res.json({ survey });

  } catch (error) {
    console.error('Get latest PHQ-2 survey error:', error);
    res.status(500).json({ error: 'Failed to fetch latest survey' });
  }
});

module.exports = router;
