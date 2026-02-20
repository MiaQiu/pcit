/**
 * Module Routes
 * Handles module listing and detail with per-user progress
 */
const express = require('express');
const crypto = require('crypto');
const prisma = require('../services/db.cjs');
const { requireAuth } = require('../middleware/auth.cjs');

const router = express.Router();

// Maps user-selected issues to module keys
const ISSUE_TO_MODULE = {
  tantrums: 'EMOTIONS',
  arguing: 'COOPERATION',
  'not-listening': 'COOPERATION',
  new_baby_in_the_house: 'SIBLINGS',
  moving_house: 'RELOCATION',
  parental_divorce: 'DIVORCE',
  social: 'DEVELOPMENT',
  frustration_tolerance: 'EMOTIONS',
};

// Maps WACB survey questions to module keys
const WACB_TO_MODULE = {
  q4Angry: 'AGGRESSION',
  q6Destroy: 'RESPONSIBILITY',
  q5Scream: 'EMOTIONS',
  q7ProvokeFights: 'CONFLICT',
  q1Dawdle: 'PROCRASTINATION',
  q2MealBehavior: 'MEALS',
  q3Disobey: 'DEFIANCE',
  q8Interrupt: 'PATIENCE',
  q9Attention: 'FOCUS',
};

/**
 * GET /api/modules
 * Get all modules with per-user progress (lesson count, completed count)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    // Get all modules ordered by displayOrder
    const modules = await prisma.module.findMany({
      orderBy: { displayOrder: 'asc' }
    });

    // Get lesson counts per module
    const lessonCounts = await prisma.lesson.groupBy({
      by: ['module'],
      _count: { id: true }
    });

    const lessonCountMap = {};
    lessonCounts.forEach(lc => {
      lessonCountMap[lc.module] = lc._count.id;
    });

    // Get completed lesson counts per module for this user
    const completedCounts = await prisma.$queryRaw`
      SELECT l."module", COUNT(*)::int as completed
      FROM "UserLessonProgress" ulp
      JOIN "Lesson" l ON l.id = ulp."lessonId"
      WHERE ulp."userId" = ${userId} AND ulp."status" = 'COMPLETED'
      GROUP BY l."module"
    `;

    const completedMap = {};
    completedCounts.forEach(cc => {
      completedMap[cc.module] = cc.completed;
    });

    // Get most recent activity per module for this user
    const lastActivity = await prisma.$queryRaw`
      SELECT l."module", MAX(ulp."lastViewedAt") as "lastActivityAt"
      FROM "UserLessonProgress" ulp
      JOIN "Lesson" l ON l.id = ulp."lessonId"
      WHERE ulp."userId" = ${userId}
      GROUP BY l."module"
    `;

    const lastActivityMap = {};
    lastActivity.forEach(la => {
      lastActivityMap[la.module] = la.lastActivityAt;
    });

    // Check if Foundation module is completed
    const foundationLessonCount = lessonCountMap['FOUNDATION'] || 0;
    const foundationCompleted = completedMap['FOUNDATION'] || 0;
    const isFoundationCompleted = foundationLessonCount > 0 && foundationCompleted >= foundationLessonCount;

    // Get recommended modules based on child issue priorities
    let recommendedModules = [];
    try {
      const child = await prisma.child.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      if (child) {
        // Get latest child issue priorities ordered by rank
        const priorities = await prisma.childIssuePriority.findMany({
          where: { childId: child.id },
          orderBy: [{ computedAt: 'desc' }, { priorityRank: 'asc' }],
        });

        // Get the latest computation batch (all share the same computedAt)
        const latestComputedAt = priorities.length > 0 ? priorities[0].computedAt : null;
        const latestPriorities = latestComputedAt
          ? priorities.filter(p => p.computedAt.getTime() === latestComputedAt.getTime())
          : [];

        // Map priorities to module keys
        const seenModules = new Set();
        for (const priority of latestPriorities) {
          // Check userIssues mapping
          if (priority.userIssues) {
            const issues = priority.userIssues.split(',').map(s => s.trim());
            for (const issue of issues) {
              const moduleKey = ISSUE_TO_MODULE[issue];
              if (moduleKey && !seenModules.has(moduleKey)) {
                seenModules.add(moduleKey);
                recommendedModules.push(moduleKey);
              }
            }
          }
          // Check wacbQuestions mapping
          if (priority.wacbQuestions) {
            const questions = priority.wacbQuestions.split(',').map(s => s.trim());
            for (const q of questions) {
              const moduleKey = WACB_TO_MODULE[q];
              if (moduleKey && !seenModules.has(moduleKey)) {
                seenModules.add(moduleKey);
                recommendedModules.push(moduleKey);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch child issue priorities:', err.message);
      // Non-fatal: continue without recommendations
    }

    // Build response
    const modulesWithProgress = modules.map(mod => ({
      id: mod.id,
      key: mod.key,
      title: mod.title,
      shortName: mod.shortName,
      description: mod.description,
      displayOrder: mod.displayOrder,
      backgroundColor: mod.backgroundColor,
      lessonCount: lessonCountMap[mod.key] || 0,
      completedLessons: completedMap[mod.key] || 0,
      lastActivityAt: lastActivityMap[mod.key] || null,
      isLocked: !isFoundationCompleted && mod.key !== 'FOUNDATION'
    }));

    // Generate content version hash
    const contentHash = crypto
      .createHash('md5')
      .update(modules.map(m => `${m.id}-${m.updatedAt}`).join('|'))
      .digest('hex')
      .substring(0, 8);

    res.json({
      modules: modulesWithProgress,
      totalModules: modules.length,
      contentVersion: contentHash,
      isFoundationCompleted,
      recommendedModules
    });
  } catch (error) {
    console.error('Get modules error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to fetch modules',
      details: error.message
    });
  }
});

/**
 * GET /api/modules/:key
 * Get module detail with its lessons and user progress
 */
router.get('/:key', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { key } = req.params;
    const moduleKey = key.toUpperCase();

    // Get module
    const mod = await prisma.module.findUnique({
      where: { key: moduleKey }
    });

    if (!mod) {
      return res.status(404).json({ error: 'Module not found' });
    }

    // Check if Foundation is completed (for locking non-Foundation modules)
    if (moduleKey !== 'FOUNDATION') {
      const foundationLessonCount = await prisma.lesson.count({ where: { module: 'FOUNDATION' } });
      const foundationCompleted = await prisma.userLessonProgress.count({
        where: {
          userId,
          status: 'COMPLETED',
          Lesson: { module: 'FOUNDATION' }
        }
      });
      if (foundationLessonCount > 0 && foundationCompleted < foundationLessonCount) {
        return res.status(403).json({ error: 'Complete the Foundation module first', isLocked: true });
      }
    }

    // Get lessons for this module
    const lessons = await prisma.lesson.findMany({
      where: { module: moduleKey },
      orderBy: { dayNumber: 'asc' }
    });

    // Get user progress for these lessons
    const lessonIds = lessons.map(l => l.id);
    const userProgress = await prisma.userLessonProgress.findMany({
      where: {
        userId,
        lessonId: { in: lessonIds }
      }
    });

    const progressMap = {};
    userProgress.forEach(p => {
      progressMap[p.lessonId] = p;
    });

    // Format lesson cards
    const lessonCards = lessons.map(lesson => ({
      id: lesson.id,
      module: lesson.module,
      title: lesson.title,
      subtitle: lesson.subtitle,
      description: lesson.shortDescription,
      dayNumber: lesson.dayNumber,
      dragonImageUrl: lesson.dragonImageUrl,
      backgroundColor: lesson.backgroundColor,
      ellipse77Color: lesson.ellipse77Color,
      ellipse78Color: lesson.ellipse78Color,
      isLocked: false,
      progress: progressMap[lesson.id] || null
    }));

    res.json({
      module: {
        id: mod.id,
        key: mod.key,
        title: mod.title,
        shortName: mod.shortName,
        description: mod.description,
        displayOrder: mod.displayOrder,
        backgroundColor: mod.backgroundColor
      },
      lessons: lessonCards
    });
  } catch (error) {
    console.error('Get module detail error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to fetch module detail',
      details: error.message
    });
  }
});

module.exports = router;
