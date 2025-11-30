// Learning Progress routes
const express = require('express');
const crypto = require('crypto');
const Joi = require('joi');
const prisma = require('../services/db.cjs');
const { requireAuth } = require('../middleware/auth.cjs');

const router = express.Router();

// Import recommendation logic (we'll need to convert this to CommonJS)
const recommendationService = require('../services/recommendationService.cjs');

// Validation schema
const progressSchema = Joi.object({
  currentDeck: Joi.number().integer().min(1).max(15).required(),
  unlockedDecks: Joi.number().integer().min(1).max(15).required()
});

// GET /api/learning/progress - Get user's learning progress
router.get('/progress', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    // Try to get existing progress
    let progress = await prisma.learningProgress.findUnique({
      where: { userId }
    });

    // If no progress exists, create default progress
    if (!progress) {
      progress = await prisma.learningProgress.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          currentDeck: 1,
          unlockedDecks: 1,
          updatedAt: new Date()
        }
      });
    }

    res.json({
      currentDeck: progress.currentDeck,
      unlockedDecks: progress.unlockedDecks,
      updatedAt: progress.updatedAt
    });

  } catch (error) {
    console.error('Get learning progress error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to fetch learning progress',
      details: error.message
    });
  }
});

// PUT /api/learning/progress - Update user's learning progress
router.put('/progress', requireAuth, async (req, res) => {
  try {
    // Validate input
    const { error, value } = progressSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.userId;
    const { currentDeck, unlockedDecks } = value;

    // Validate that unlockedDecks is >= currentDeck
    if (unlockedDecks < currentDeck) {
      return res.status(400).json({
        error: 'unlockedDecks must be greater than or equal to currentDeck'
      });
    }

    // Upsert progress (update if exists, create if doesn't)
    const progress = await prisma.learningProgress.upsert({
      where: { userId },
      update: {
        currentDeck,
        unlockedDecks,
        updatedAt: new Date()
      },
      create: {
        id: crypto.randomUUID(),
        userId,
        currentDeck,
        unlockedDecks,
        updatedAt: new Date()
      }
    });

    res.json({
      currentDeck: progress.currentDeck,
      unlockedDecks: progress.unlockedDecks,
      updatedAt: progress.updatedAt
    });

  } catch (error) {
    console.error('Update learning progress error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to update learning progress',
      details: error.message
    });
  }
});

// GET /api/learning/recommendation - Get personalized module recommendation
router.get('/recommendation', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    // Get user's CDI sessions (last 10 for 3-day moving average)
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        mode: 'CDI'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10,
      select: {
        id: true,
        tagCounts: true,
        createdAt: true
      }
    });

    // Get user's module viewing history
    const moduleHistory = await prisma.moduleHistory.findMany({
      where: { userId },
      orderBy: {
        viewedAt: 'desc'
      }
    });

    // Get recommendation
    const recommendation = recommendationService.getRecommendation(sessions, moduleHistory);

    res.json(recommendation);

  } catch (error) {
    console.error('Get recommendation error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to get recommendation',
      details: error.message
    });
  }
});

// Validation schema for module view tracking
const moduleViewSchema = Joi.object({
  category: Joi.string().valid('PRAISE', 'ECHO', 'NARRATION', 'CRITICISM', 'QUESTIONS', 'COMMANDS', 'MAINTENANCE').required(),
  level: Joi.number().integer().min(1).max(4).required()
});

// POST /api/learning/module-view - Track when user views a module
router.post('/module-view', requireAuth, async (req, res) => {
  try {
    // Validate input
    const { error, value } = moduleViewSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.userId;
    const { category, level } = value;

    // Create module view record
    const moduleView = await prisma.moduleHistory.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        category,
        level,
        viewedAt: new Date()
      }
    });

    res.json({
      id: moduleView.id,
      category: moduleView.category,
      level: moduleView.level,
      viewedAt: moduleView.viewedAt
    });

  } catch (error) {
    console.error('Track module view error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to track module view',
      details: error.message
    });
  }
});

// GET /api/learning/history - Get user's module viewing history
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    const history = await prisma.moduleHistory.findMany({
      where: { userId },
      orderBy: {
        viewedAt: 'desc'
      },
      take: 50 // Limit to last 50 views
    });

    res.json(history);

  } catch (error) {
    console.error('Get module history error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to get module history',
      details: error.message
    });
  }
});

module.exports = router;
