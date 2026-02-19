const express = require('express');
const crypto = require('crypto');
const prisma = require('../services/db.cjs');
const { generateAccessToken } = require('../utils/jwt.cjs');
const { requireAdminAuth } = require('../middleware/adminAuth.cjs');
const { sendPushNotificationToUser } = require('../services/pushNotifications.cjs');

const { generateWeeklyReport, resolveReportAudioUrls } = require('../services/weeklyReportService.cjs');

const router = express.Router();

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

/**
 * POST /api/admin/auth/login
 * Login with admin password → JWT
 */
router.post('/auth/login', (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error('ADMIN_PASSWORD not set in environment');
      return res.status(503).json({ error: 'Admin login not configured' });
    }

    // Constant-time comparison to prevent timing attacks
    const inputBuf = Buffer.from(password);
    const correctBuf = Buffer.from(adminPassword);

    let match = false;
    if (inputBuf.length === correctBuf.length) {
      match = crypto.timingSafeEqual(inputBuf, correctBuf);
    }

    if (!match) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate JWT with admin role
    const token = generateAccessToken({ role: 'admin' });

    res.json({ token });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/admin/auth/verify
 * Verify current admin token
 */
router.get('/auth/verify', requireAdminAuth, (req, res) => {
  res.json({ valid: true, role: 'admin' });
});

// ============================================================================
// LESSON ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/lessons
 * List all lessons with segment count
 */
router.get('/lessons', requireAdminAuth, async (req, res) => {
  try {
    const { module: moduleFilter } = req.query;

    const where = {};
    if (moduleFilter) {
      where.module = moduleFilter.toUpperCase();
    }

    const lessons = await prisma.lesson.findMany({
      where,
      include: {
        _count: { select: { LessonSegment: true } },
        Quiz: { select: { id: true } }
      },
      orderBy: [
        { module: 'asc' },
        { dayNumber: 'asc' }
      ]
    });

    const formatted = lessons.map(l => ({
      id: l.id,
      module: l.module,
      dayNumber: l.dayNumber,
      title: l.title,
      subtitle: l.subtitle,
      shortDescription: l.shortDescription,
      estimatedMinutes: l.estimatedMinutes,
      segmentCount: l._count.LessonSegment,
      hasQuiz: !!l.Quiz,
      backgroundColor: l.backgroundColor,
      updatedAt: l.updatedAt
    }));

    res.json({ lessons: formatted });
  } catch (error) {
    console.error('Admin get lessons error:', error);
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

/**
 * GET /api/admin/lessons/:id
 * Full lesson detail with segments and quiz
 */
router.get('/lessons/:id', requireAdminAuth, async (req, res) => {
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.id },
      include: {
        LessonSegment: { orderBy: { order: 'asc' } },
        Quiz: {
          include: {
            QuizOption: { orderBy: { order: 'asc' } }
          }
        }
      }
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    res.json({
      lesson: {
        ...lesson,
        segments: lesson.LessonSegment,
        quiz: lesson.Quiz ? {
          ...lesson.Quiz,
          options: lesson.Quiz.QuizOption
        } : null,
        LessonSegment: undefined,
        Quiz: undefined
      }
    });
  } catch (error) {
    console.error('Admin get lesson detail error:', error);
    res.status(500).json({ error: 'Failed to fetch lesson' });
  }
});

/**
 * POST /api/admin/lessons
 * Create lesson with segments and quiz in a transaction
 */
router.post('/lessons', requireAdminAuth, async (req, res) => {
  try {
    const { lesson: lessonData, segments, quiz } = req.body;

    if (!lessonData || !lessonData.module || !lessonData.dayNumber || !lessonData.title) {
      return res.status(400).json({ error: 'Missing required lesson fields (module, dayNumber, title)' });
    }

    const lessonId = `${lessonData.module}-${lessonData.dayNumber}`;

    // Check if lesson already exists
    const existing = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (existing) {
      return res.status(409).json({ error: `Lesson ${lessonId} already exists` });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create lesson
      const lesson = await tx.lesson.create({
        data: {
          id: lessonId,
          module: lessonData.module,
          dayNumber: parseInt(lessonData.dayNumber),
          title: lessonData.title,
          subtitle: lessonData.subtitle || null,
          shortDescription: lessonData.shortDescription || '',
          objectives: lessonData.objectives || [],
          estimatedMinutes: parseInt(lessonData.estimatedMinutes) || 2,
          teachesCategories: lessonData.teachesCategories || [],
          dragonImageUrl: lessonData.dragonImageUrl || null,
          backgroundColor: lessonData.backgroundColor || '#E4E4FF',
          ellipse77Color: lessonData.ellipse77Color || '#9BD4DF',
          ellipse78Color: lessonData.ellipse78Color || '#A6E0CB',
          updatedAt: new Date()
        }
      });

      // Create segments in batch
      if (segments && segments.length > 0) {
        const now = new Date();
        await tx.lessonSegment.createMany({
          data: segments.map((seg, i) => ({
            id: `${lessonId}-seg-${i + 1}`,
            lessonId,
            order: i + 1,
            sectionTitle: seg.sectionTitle || null,
            contentType: seg.contentType || 'TEXT',
            bodyText: seg.bodyText || '',
            imageUrl: seg.imageUrl || null,
            iconType: seg.iconType || null,
            aiCheckMode: seg.aiCheckMode || null,
            idealAnswer: seg.idealAnswer || null,
            updatedAt: now
          }))
        });
      }

      // Create quiz + options in batch
      if (quiz && quiz.question) {
        const quizId = `${lessonId}-quiz`;
        await tx.quiz.create({
          data: {
            id: quizId,
            lessonId,
            question: quiz.question,
            correctAnswer: quiz.correctAnswer || 'A',
            explanation: quiz.explanation || '',
            updatedAt: new Date()
          }
        });

        const labels = ['A', 'B', 'C', 'D'];
        if (quiz.options && quiz.options.length > 0) {
          await tx.quizOption.createMany({
            data: quiz.options.map((opt, i) => ({
              id: `${lessonId}-quiz-opt-${labels[i]}`,
              quizId,
              optionLabel: labels[i],
              optionText: opt.optionText || opt,
              order: i + 1
            }))
          });
        }
      }

      return lesson;
    }, { timeout: 15000 });

    // Fetch the full lesson back
    const fullLesson = await prisma.lesson.findUnique({
      where: { id: result.id },
      include: {
        LessonSegment: { orderBy: { order: 'asc' } },
        Quiz: { include: { QuizOption: { orderBy: { order: 'asc' } } } }
      }
    });

    res.status(201).json({
      lesson: {
        ...fullLesson,
        segments: fullLesson.LessonSegment,
        quiz: fullLesson.Quiz ? {
          ...fullLesson.Quiz,
          options: fullLesson.Quiz.QuizOption
        } : null,
        LessonSegment: undefined,
        Quiz: undefined
      }
    });
  } catch (error) {
    console.error('Admin create lesson error:', error);
    res.status(500).json({ error: 'Failed to create lesson', details: error.message });
  }
});

/**
 * PUT /api/admin/lessons/:id
 * Update lesson metadata, segments, and quiz in one call
 */
router.put('/lessons/:id', requireAdminAuth, async (req, res) => {
  try {
    const lessonId = req.params.id;
    const { lesson: lessonData, segments, quiz } = req.body;

    const existing = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!existing) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    await prisma.$transaction(async (tx) => {
      // Update lesson metadata
      if (lessonData) {
        const updateFields = {};
        if (lessonData.title !== undefined) updateFields.title = lessonData.title;
        if (lessonData.subtitle !== undefined) updateFields.subtitle = lessonData.subtitle;
        if (lessonData.shortDescription !== undefined) updateFields.shortDescription = lessonData.shortDescription;
        if (lessonData.objectives !== undefined) updateFields.objectives = lessonData.objectives;
        if (lessonData.estimatedMinutes !== undefined) updateFields.estimatedMinutes = parseInt(lessonData.estimatedMinutes);
        if (lessonData.teachesCategories !== undefined) updateFields.teachesCategories = lessonData.teachesCategories;
        if (lessonData.dragonImageUrl !== undefined) updateFields.dragonImageUrl = lessonData.dragonImageUrl;
        if (lessonData.backgroundColor !== undefined) updateFields.backgroundColor = lessonData.backgroundColor;
        if (lessonData.ellipse77Color !== undefined) updateFields.ellipse77Color = lessonData.ellipse77Color;
        if (lessonData.ellipse78Color !== undefined) updateFields.ellipse78Color = lessonData.ellipse78Color;
        updateFields.updatedAt = new Date();

        await tx.lesson.update({
          where: { id: lessonId },
          data: updateFields
        });
      }

      // Replace segments if provided
      if (segments !== undefined) {
        await tx.lessonSegment.deleteMany({ where: { lessonId } });

        if (segments.length > 0) {
          const now = new Date();
          await tx.lessonSegment.createMany({
            data: segments.map((seg, i) => ({
              id: `${lessonId}-seg-${i + 1}`,
              lessonId,
              order: i + 1,
              sectionTitle: seg.sectionTitle || null,
              contentType: seg.contentType || 'TEXT',
              bodyText: seg.bodyText || '',
              imageUrl: seg.imageUrl || null,
              iconType: seg.iconType || null,
              aiCheckMode: seg.aiCheckMode || null,
              idealAnswer: seg.idealAnswer || null,
              updatedAt: now
            }))
          });
        }
      }

      // Replace quiz if provided
      if (quiz !== undefined) {
        await tx.quiz.deleteMany({ where: { lessonId } });

        if (quiz && quiz.question) {
          const quizId = `${lessonId}-quiz`;
          await tx.quiz.create({
            data: {
              id: quizId,
              lessonId,
              question: quiz.question,
              correctAnswer: quiz.correctAnswer || 'A',
              explanation: quiz.explanation || '',
              updatedAt: new Date()
            }
          });

          const labels = ['A', 'B', 'C', 'D'];
          if (quiz.options && quiz.options.length > 0) {
            await tx.quizOption.createMany({
              data: quiz.options.map((opt, i) => ({
                id: `${lessonId}-quiz-opt-${labels[i]}`,
                quizId,
                optionLabel: labels[i],
                optionText: opt.optionText || opt,
                order: i + 1
              }))
            });
          }
        }
      }
    }, { timeout: 15000 });

    // Fetch updated lesson
    const fullLesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        LessonSegment: { orderBy: { order: 'asc' } },
        Quiz: { include: { QuizOption: { orderBy: { order: 'asc' } } } }
      }
    });

    res.json({
      lesson: {
        ...fullLesson,
        segments: fullLesson.LessonSegment,
        quiz: fullLesson.Quiz ? {
          ...fullLesson.Quiz,
          options: fullLesson.Quiz.QuizOption
        } : null,
        LessonSegment: undefined,
        Quiz: undefined
      }
    });
  } catch (error) {
    console.error('Admin update lesson error:', error);
    res.status(500).json({ error: 'Failed to update lesson', details: error.message });
  }
});

/**
 * DELETE /api/admin/lessons/:id
 * Delete lesson (cascades to segments, quiz, progress)
 */
router.delete('/lessons/:id', requireAdminAuth, async (req, res) => {
  try {
    const lessonId = req.params.id;

    const existing = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!existing) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    await prisma.lesson.delete({ where: { id: lessonId } });

    res.json({ success: true, deletedId: lessonId });
  } catch (error) {
    console.error('Admin delete lesson error:', error);
    res.status(500).json({ error: 'Failed to delete lesson' });
  }
});

/**
 * GET /api/admin/modules
 * List modules for filter dropdowns
 */
router.get('/modules', requireAdminAuth, async (req, res) => {
  try {
    const modules = await prisma.module.findMany({
      orderBy: { displayOrder: 'asc' }
    });

    // Also get lesson counts
    const lessonCounts = await prisma.lesson.groupBy({
      by: ['module'],
      _count: { id: true }
    });
    const countMap = {};
    lessonCounts.forEach(lc => {
      countMap[lc.module] = lc._count.id;
    });

    const formatted = modules.map(m => ({
      id: m.id,
      key: m.key,
      title: m.title,
      shortName: m.shortName,
      displayOrder: m.displayOrder,
      backgroundColor: m.backgroundColor,
      lessonCount: countMap[m.key] || 0
    }));

    res.json({ modules: formatted });
  } catch (error) {
    console.error('Admin get modules error:', error);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

/**
 * POST /api/admin/modules
 * Create a new module
 */
router.post('/modules', requireAdminAuth, async (req, res) => {
  try {
    const { key, title, shortName, description, displayOrder, backgroundColor } = req.body;

    if (!key || !title || !shortName) {
      return res.status(400).json({ error: 'Missing required fields (key, title, shortName)' });
    }

    // Check if module with this key already exists
    const existing = await prisma.module.findUnique({ where: { key } });
    if (existing) {
      return res.status(409).json({ error: `Module "${key}" already exists` });
    }

    // Auto-calculate displayOrder if not provided
    let order = displayOrder;
    if (order === undefined || order === null) {
      const last = await prisma.module.findFirst({ orderBy: { displayOrder: 'desc' } });
      order = last ? last.displayOrder + 1 : 1;
    }

    const mod = await prisma.module.create({
      data: {
        key,
        title,
        shortName,
        description: description || '',
        displayOrder: parseInt(order),
        backgroundColor: backgroundColor || '#E4E4FF',
      }
    });

    res.status(201).json({ module: mod });
  } catch (error) {
    console.error('Admin create module error:', error);
    res.status(500).json({ error: 'Failed to create module', details: error.message });
  }
});

/**
 * PUT /api/admin/modules/:key
 * Update module details
 */
router.put('/modules/:key', requireAdminAuth, async (req, res) => {
  try {
    const moduleKey = req.params.key;
    const { title, shortName, description, displayOrder, backgroundColor } = req.body;

    const existing = await prisma.module.findUnique({ where: { key: moduleKey } });
    if (!existing) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const updateFields = {};
    if (title !== undefined) updateFields.title = title;
    if (shortName !== undefined) updateFields.shortName = shortName;
    if (description !== undefined) updateFields.description = description;
    if (displayOrder !== undefined) updateFields.displayOrder = parseInt(displayOrder);
    if (backgroundColor !== undefined) updateFields.backgroundColor = backgroundColor;

    const mod = await prisma.module.update({
      where: { key: moduleKey },
      data: updateFields
    });

    res.json({ module: mod });
  } catch (error) {
    console.error('Admin update module error:', error);
    res.status(500).json({ error: 'Failed to update module', details: error.message });
  }
});

// ============================================================================
// NOTIFICATION ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/users
 * List users with push token status
 */
router.get('/users', requireAdminAuth, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        pushToken: true,
        pushTokenUpdatedAt: true,
        createdAt: true,
        developmentalVisible: true,
        _count: { select: { Session: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = users.map(u => ({
      id: u.id,
      hasPushToken: !!u.pushToken,
      pushTokenUpdatedAt: u.pushTokenUpdatedAt,
      createdAt: u.createdAt,
      sessionCount: u._count.Session,
      developmentalVisible: u.developmentalVisible
    }));

    res.json({ users: formatted });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * POST /api/admin/notifications/send
 * Send push notification to selected users
 */
router.post('/notifications/send', requireAdminAuth, async (req, res) => {
  try {
    const { userIds, title, body } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'At least one user must be selected' });
    }

    const notificationTitle = title || 'Your Weekly Report is Ready!';
    const notificationBody = body || 'Check out your progress this week';

    const results = [];
    for (const userId of userIds) {
      const result = await sendPushNotificationToUser(userId, {
        title: notificationTitle,
        body: notificationBody,
        sound: 'default',
        data: {
          type: 'weekly_report',
          timestamp: Date.now()
        }
      });
      results.push({ userId, ...result });
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.json({
      sent: successCount,
      failed: failCount,
      total: userIds.length,
      results
    });
  } catch (error) {
    console.error('Admin send notifications error:', error);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

// ============================================================================
// WEEKLY REPORT ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/users/:id/weekly-reports
 * List weekly reports for a specific user
 */
router.get('/users/:id/weekly-reports', requireAdminAuth, async (req, res) => {
  try {
    const userId = req.params.id;

    const reports = await prisma.weeklyReport.findMany({
      where: { userId },
      orderBy: { weekStartDate: 'desc' },
      select: {
        id: true,
        weekStartDate: true,
        weekEndDate: true,
        visibility: true,
        headline: true,
        totalDeposits: true,
        sessionIds: true,
        sessionCount: true,
        avgNoraScore: true,
        generatedAt: true,
        createdAt: true,
      }
    });

    res.json({ reports });
  } catch (error) {
    console.error('Admin get user weekly reports error:', error);
    res.status(500).json({ error: 'Failed to fetch weekly reports' });
  }
});

/**
 * GET /api/admin/weekly-reports/:id
 * Get full detail for a single weekly report
 */
router.get('/weekly-reports/:id', requireAdminAuth, async (req, res) => {
  try {
    const report = await prisma.weeklyReport.findUnique({
      where: { id: req.params.id },
    });

    if (!report) {
      return res.status(404).json({ error: 'Weekly report not found' });
    }

    // Generate fresh presigned audio URLs for top moments
    const resolved = await resolveReportAudioUrls(report);
    res.json({ report: resolved });
  } catch (error) {
    console.error('Admin get weekly report detail error:', error);
    res.status(500).json({ error: 'Failed to fetch weekly report' });
  }
});

/**
 * PUT /api/admin/weekly-reports/:id/visibility
 * Toggle visibility of a weekly report. Sends push notification when enabling.
 */
router.put('/weekly-reports/:id/visibility', requireAdminAuth, async (req, res) => {
  try {
    const reportId = req.params.id;
    const { visibility } = req.body;

    const report = await prisma.weeklyReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return res.status(404).json({ error: 'Weekly report not found' });
    }

    const updated = await prisma.weeklyReport.update({
      where: { id: reportId },
      data: { visibility: !!visibility },
    });

    // Send push notification when making visible
    let notificationResult = null;
    if (visibility && !report.visibility) {
      const weekLabel = new Date(report.weekStartDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      notificationResult = await sendPushNotificationToUser(report.userId, {
        title: 'Your Weekly Report is Ready!',
        body: `Check out your progress for the week of ${weekLabel}`,
        sound: 'default',
        data: {
          type: 'weekly_report',
          reportId: report.id,
          timestamp: Date.now(),
        },
      });
    }

    res.json({
      report: {
        id: updated.id,
        visibility: updated.visibility,
      },
      notificationSent: notificationResult ? notificationResult.success : false,
    });
  } catch (error) {
    console.error('Admin toggle weekly report visibility error:', error);
    res.status(500).json({ error: 'Failed to update report visibility' });
  }
});

// ============================================================================
// WEEKLY REPORT GENERATION ENDPOINTS
// ============================================================================

/**
 * POST /api/admin/weekly-reports/generate
 * Generate a weekly report for a single user
 * Body: { userId, weekStartDate? }
 */
router.post('/weekly-reports/generate', requireAdminAuth, async (req, res) => {
  try {
    const { userId, weekStartDate } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await generateWeeklyReport(userId, weekStartDate);
    res.json({ report: result });
  } catch (error) {
    console.error('Admin generate weekly report error:', error);
    res.status(500).json({ error: 'Failed to generate weekly report', details: error.message });
  }
});

/**
 * POST /api/admin/weekly-reports/generate-all
 * Generate weekly reports for all users with completed sessions in the week
 * Body: { weekStartDate? }
 */
router.post('/weekly-reports/generate-all', requireAdminAuth, async (req, res) => {
  try {
    const { weekStartDate } = req.body;

    // Compute week boundaries
    let weekStart;
    if (weekStartDate) {
      weekStart = new Date(weekStartDate);
      weekStart.setUTCHours(0, 0, 0, 0);
    } else {
      weekStart = new Date();
      const day = weekStart.getUTCDay();
      const diff = day === 0 ? 6 : day - 1;
      weekStart.setUTCDate(weekStart.getUTCDate() - diff);
      weekStart.setUTCHours(0, 0, 0, 0);
    }
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999);

    // Find all users with completed sessions in this week
    const sessionsInWeek = await prisma.session.findMany({
      where: {
        analysisStatus: 'COMPLETED',
        overallScore: { not: null },
        createdAt: { gte: weekStart, lte: weekEnd },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    const userIds = sessionsInWeek.map(s => s.userId);
    console.log(`📊 [WEEKLY-REPORT-ALL] Found ${userIds.length} users with sessions in week of ${weekStart.toISOString()}`);

    const results = [];
    let generated = 0, failed = 0, skipped = 0;

    for (const userId of userIds) {
      try {
        const result = await generateWeeklyReport(userId, weekStart.toISOString());
        if (result.skipped) {
          skipped++;
          results.push({ userId, status: 'skipped', reason: result.reason });
        } else {
          generated++;
          results.push({ userId, status: 'generated', reportId: result.id });
        }
      } catch (err) {
        failed++;
        console.error(`📊 [WEEKLY-REPORT-ALL] Failed for user ${userId}:`, err.message);
        results.push({ userId, status: 'failed', error: err.message });
      }
    }

    res.json({ generated, failed, skipped, total: userIds.length, results });
  } catch (error) {
    console.error('Admin generate all weekly reports error:', error);
    res.status(500).json({ error: 'Failed to generate weekly reports', details: error.message });
  }
});

// ============================================================================
// DEVELOPMENTAL VISIBILITY ENDPOINTS
// ============================================================================

/**
 * PUT /api/admin/users/:id/developmental-visibility
 * Toggle developmental milestones visibility for a user
 */
router.put('/users/:id/developmental-visibility', requireAdminAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const { visibility } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { developmentalVisible: !!visibility },
      select: { id: true, developmentalVisible: true },
    });

    res.json({ userId: updated.id, developmentalVisible: updated.developmentalVisible });
  } catch (error) {
    console.error('Admin toggle developmental visibility error:', error);
    res.status(500).json({ error: 'Failed to update developmental visibility' });
  }
});

// ============================================================================
// SETTINGS ENDPOINTS
// ============================================================================

const REPORT_VISIBILITY_KEY = 'report-visibility';
const DEFAULT_REPORT_VISIBILITY = { daily: false, weekly: false, monthly: false };

/**
 * GET /api/admin/settings/report-visibility
 * Get report visibility settings
 */
router.get('/settings/report-visibility', requireAdminAuth, async (req, res) => {
  try {
    const config = await prisma.appConfig.findUnique({
      where: { key: REPORT_VISIBILITY_KEY }
    });

    res.json(config ? config.value : DEFAULT_REPORT_VISIBILITY);
  } catch (error) {
    console.error('Admin get report visibility error:', error);
    res.status(500).json({ error: 'Failed to fetch report visibility settings' });
  }
});

/**
 * PUT /api/admin/settings/report-visibility
 * Update report visibility settings
 */
router.put('/settings/report-visibility', requireAdminAuth, async (req, res) => {
  try {
    const { daily, weekly, monthly } = req.body;

    const value = {
      daily: !!daily,
      weekly: !!weekly,
      monthly: !!monthly,
    };

    await prisma.appConfig.upsert({
      where: { key: REPORT_VISIBILITY_KEY },
      update: { value },
      create: { key: REPORT_VISIBILITY_KEY, value },
    });

    res.json(value);
  } catch (error) {
    console.error('Admin update report visibility error:', error);
    res.status(500).json({ error: 'Failed to update report visibility settings' });
  }
});

module.exports = router;
