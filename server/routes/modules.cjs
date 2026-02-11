/**
 * Module Routes
 * Handles module listing and detail with per-user progress
 */
const express = require('express');
const crypto = require('crypto');
const prisma = require('../services/db.cjs');
const { requireAuth } = require('../middleware/auth.cjs');

const router = express.Router();

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
      lastActivityAt: lastActivityMap[mod.key] || null
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
      contentVersion: contentHash
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
