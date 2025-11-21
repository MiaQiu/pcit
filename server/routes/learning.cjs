// Learning Progress routes
const express = require('express');
const Joi = require('joi');
const prisma = require('../services/db.cjs');
const { requireAuth } = require('../middleware/auth.cjs');

const router = express.Router();

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
          userId,
          currentDeck: 1,
          unlockedDecks: 1
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
        unlockedDecks
      },
      create: {
        userId,
        currentDeck,
        unlockedDecks
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

module.exports = router;
