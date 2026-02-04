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

// GET /api/learning/developmental-progress - Get child's developmental progress by domain
router.get('/developmental-progress', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    // Get the user's child record
    const child = await prisma.child.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    if (!child) {
      return res.status(404).json({ error: 'No child record found' });
    }

    // Calculate child's age in months
    let childAgeMonths = 0;
    if (child.birthday) {
      const now = new Date();
      const birthday = new Date(child.birthday);
      childAgeMonths = (now.getFullYear() - birthday.getFullYear()) * 12 +
        (now.getMonth() - birthday.getMonth());
    } else {
      // Fallback: use childBirthYear from user if available
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { childBirthYear: true, childBirthday: true }
      });
      if (user?.childBirthday) {
        const now = new Date();
        const birthday = new Date(user.childBirthday);
        childAgeMonths = (now.getFullYear() - birthday.getFullYear()) * 12 +
          (now.getMonth() - birthday.getMonth());
      } else if (user?.childBirthYear) {
        const now = new Date();
        childAgeMonths = (now.getFullYear() - user.childBirthYear) * 12 + 6; // Approximate mid-year
      }
    }

    // Define the 5 domains
    const domainCategories = ['Language', 'Cognitive', 'Social', 'Emotional', 'Connection'];

    // Get all milestones from library grouped by category and stage
    const allMilestones = await prisma.milestoneLibrary.findMany({
      orderBy: [
        { category: 'asc' },
        { medianAgeMonths: 'asc' }
      ]
    });

    // Get all child milestones
    const childMilestones = await prisma.childMilestone.findMany({
      where: { childId: child.id },
      include: {
        MilestoneLibrary: true
      }
    });

    // Helper function to parse age range from grouping_stage
    // e.g., "Stage I (12-26m)" -> { start: 12, end: 26 }
    // e.g., "Post-Stage V (47m+)" -> { start: 47, end: 84 }
    const parseAgeRange = (groupingStage) => {
      const match = groupingStage.match(/\((\d+)-?(\d+)?m?\+?\)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : 84; // Default max age
        return { start, end };
      }
      return { start: 0, end: 84 };
    };

    // Group milestones by category and stage
    const milestonesByDomainAndStage = {};
    allMilestones.forEach(m => {
      if (!milestonesByDomainAndStage[m.category]) {
        milestonesByDomainAndStage[m.category] = {};
      }
      if (!milestonesByDomainAndStage[m.category][m.groupingStage]) {
        milestonesByDomainAndStage[m.category][m.groupingStage] = [];
      }
      milestonesByDomainAndStage[m.category][m.groupingStage].push(m);
    });

    // Calculate benchmark for each domain based on child's age
    // Benchmark = sum of (milestones from completed stages) + (proportional milestones from current stage)
    const calculateBenchmark = (category) => {
      const stages = milestonesByDomainAndStage[category];
      if (!stages) return 0;

      let benchmark = 0;
      const stageEntries = Object.entries(stages).map(([stage, milestones]) => ({
        stage,
        milestones,
        range: parseAgeRange(stage)
      })).sort((a, b) => a.range.start - b.range.start);

      for (const { milestones, range } of stageEntries) {
        const stageCount = milestones.length;

        if (childAgeMonths >= range.end) {
          // Child has completed this stage
          benchmark += stageCount;
        } else if (childAgeMonths >= range.start) {
          // Child is currently in this stage - calculate proportional progress
          const progress = (childAgeMonths - range.start) / (range.end - range.start);
          benchmark += stageCount * progress;
        }
        // If childAgeMonths < range.start, child hasn't reached this stage yet
      }

      return benchmark;
    };

    // Build domain progress data
    const domainProgress = {};
    domainCategories.forEach(domain => {
      const totalMilestones = allMilestones.filter(m => m.category === domain).length;
      const achievedMilestones = childMilestones.filter(
        cm => cm.MilestoneLibrary.category === domain && cm.status === 'ACHIEVED'
      ).length;
      const emergingMilestones = childMilestones.filter(
        cm => cm.MilestoneLibrary.category === domain && cm.status === 'EMERGING'
      ).length;

      domainProgress[domain] = {
        achieved: achievedMilestones,
        emerging: emergingMilestones,
        total: totalMilestones,
        benchmark: Math.round(calculateBenchmark(domain) * 100) / 100 // Round to 2 decimal places
      };
    });

    res.json({
      childAgeMonths,
      domains: domainProgress
    });

  } catch (error) {
    console.error('Get developmental progress error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to get developmental progress',
      details: error.message
    });
  }
});

// GET /api/learning/domain-milestones/:domain - Get detailed milestones for a specific domain
router.get('/domain-milestones/:domain', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { domain } = req.params;

    // Validate domain
    const validDomains = ['Language', 'Cognitive', 'Social', 'Emotional', 'Connection'];
    if (!validDomains.includes(domain)) {
      return res.status(400).json({ error: 'Invalid domain. Must be one of: ' + validDomains.join(', ') });
    }

    // Get the user's child record
    const child = await prisma.child.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    if (!child) {
      return res.status(404).json({ error: 'No child record found' });
    }

    // Get all milestones for this domain from library
    const domainMilestones = await prisma.milestoneLibrary.findMany({
      where: { category: domain },
      orderBy: [
        { medianAgeMonths: 'asc' },
        { displayTitle: 'asc' }
      ]
    });

    // Get child's milestones for this domain
    const childMilestones = await prisma.childMilestone.findMany({
      where: {
        childId: child.id,
        MilestoneLibrary: { category: domain }
      },
      include: {
        MilestoneLibrary: true
      }
    });

    // Create a map of milestone library id to child milestone status
    const childMilestoneMap = {};
    childMilestones.forEach(cm => {
      childMilestoneMap[cm.milestoneId] = cm;
    });

    // Build response with milestone details
    const milestones = domainMilestones.map(m => {
      const childMilestone = childMilestoneMap[m.id];
      const status = childMilestone?.status || 'NOT_YET';

      return {
        id: m.id,
        displayTitle: m.displayTitle,
        groupingStage: m.groupingStage,
        status: status,
        achievedAt: childMilestone?.achievedAt || null,
        firstObservedAt: childMilestone?.firstObservedAt || null,
        actionTip: m.actionTip
      };
    });

    // Get latest child profiling for domain-specific summary
    const latestProfiling = await prisma.childProfiling.findFirst({
      where: { childId: child.id },
      orderBy: { createdAt: 'desc' }
    });

    // Extract domain-specific profiling data
    let domainProfiling = null;
    if (latestProfiling?.domains && Array.isArray(latestProfiling.domains)) {
      domainProfiling = latestProfiling.domains.find(d => d.category === domain) || null;
    }

    res.json({
      domain,
      milestones,
      profiling: domainProfiling,
      childName: child.name
    });

  } catch (error) {
    console.error('Get domain milestones error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to get domain milestones',
      details: error.message
    });
  }
});

// GET /api/learning/milestone-history - Get historical milestone progress over time
router.get('/milestone-history', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const months = parseInt(req.query.months) || 6;

    // Get the user's child record
    const child = await prisma.child.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    if (!child) {
      return res.status(404).json({ error: 'No child record found' });
    }

    // Calculate child's age in months
    let childAgeMonths = 0;
    if (child.birthday) {
      const now = new Date();
      const birthday = new Date(child.birthday);
      childAgeMonths = (now.getFullYear() - birthday.getFullYear()) * 12 +
        (now.getMonth() - birthday.getMonth());
    }

    // Get all child milestones with timestamps
    const childMilestones = await prisma.childMilestone.findMany({
      where: { childId: child.id },
      orderBy: { updatedAt: 'asc' }
    });

    // Calculate start date (N months ago)
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    // Build monthly snapshots
    const history = [];
    for (let i = 0; i < months; i++) {
      const snapshotDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      const endOfMonth = new Date(snapshotDate.getFullYear(), snapshotDate.getMonth() + 1, 0, 23, 59, 59);

      // Count milestones achieved and emerging by end of this month
      let achievedCount = 0;
      let emergingCount = 0;

      childMilestones.forEach(cm => {
        const milestoneDate = new Date(cm.updatedAt);
        if (milestoneDate <= endOfMonth) {
          if (cm.status === 'ACHIEVED') {
            achievedCount++;
          } else if (cm.status === 'EMERGING') {
            emergingCount++;
          }
        }
      });

      history.push({
        date: snapshotDate.toISOString().split('T')[0],
        achievedCount,
        emergingCount
      });
    }

    // Calculate current totals
    const totalAchieved = childMilestones.filter(cm => cm.status === 'ACHIEVED').length;
    const totalEmerging = childMilestones.filter(cm => cm.status === 'EMERGING').length;

    res.json({
      childAgeMonths,
      history,
      summary: {
        totalAchieved,
        totalEmerging
      }
    });

  } catch (error) {
    console.error('Get milestone history error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to get milestone history',
      details: error.message
    });
  }
});

module.exports = router;
