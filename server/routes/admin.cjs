const express = require('express');
const crypto = require('crypto');
const prisma = require('../services/db.cjs');
const { generateAccessToken } = require('../utils/jwt.cjs');
const { requireAdminAuth } = require('../middleware/adminAuth.cjs');
const { sendPushNotificationToUser } = require('../services/pushNotifications.cjs');

const { generateWeeklyReport, resolveReportAudioUrls } = require('../services/weeklyReportService.cjs');
const { generateCdiCoaching } = require('../services/pcitAnalysisService.cjs');
const { getUtterances } = require('../utils/utteranceUtils.cjs');
const { decryptSensitiveData, decryptUserData } = require('../utils/encryption.cjs');
const { runTrialExpiryJob } = require('../jobs/trialExpiryJob.cjs');


const router = express.Router();

// ============================================================================
// QUIZ ANSWER NORMALIZATION HELPERS
// ============================================================================

/**
 * Convert a correctAnswer from the admin editor (letter 'A'/'B'/'C'/'D')
 * to the canonical full option ID stored in the DB (e.g. 'FOUNDATION-1-quiz-opt-B').
 * If it's already a full option ID, returns it unchanged.
 */
function quizAnswerLetterToId(lessonId, answer) {
  if (answer && /^[A-D]$/.test(answer)) {
    return `${lessonId}-quiz-opt-${answer}`;
  }
  return answer;
}

/**
 * Convert a correctAnswer from the DB (full option ID like 'FOUNDATION-1-quiz-opt-B')
 * back to the letter label ('B') for the admin editor UI.
 * If it's already a bare letter, returns it unchanged.
 */
function quizAnswerIdToLabel(answer) {
  if (!answer) return answer;
  const match = answer.match(/-quiz-opt-([A-D])$/);
  return match ? match[1] : answer;
}

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
          correctAnswer: quizAnswerIdToLabel(lesson.Quiz.correctAnswer),
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
 * Create lesson with segments and quiz in a transaction.
 * If the requested dayNumber is already occupied, existing lessons at that
 * position and above are shifted up by 1 to make room.
 */
router.post('/lessons', requireAdminAuth, async (req, res) => {
  try {
    const { lesson: lessonData, segments, quiz } = req.body;

    if (!lessonData || !lessonData.module || !lessonData.dayNumber || !lessonData.title) {
      return res.status(400).json({ error: 'Missing required lesson fields (module, dayNumber, title)' });
    }

    const moduleKey = lessonData.module;
    const requestedDayNumber = parseInt(lessonData.dayNumber);

    const result = await prisma.$transaction(async (tx) => {
      // Check if a lesson already occupies the requested dayNumber
      const occupant = await tx.lesson.findFirst({
        where: { module: moduleKey, dayNumber: requestedDayNumber }
      });

      if (occupant) {
        // Shift all lessons at dayNumber >= requestedDayNumber up by 1
        const lessonsToShift = await tx.lesson.findMany({
          where: { module: moduleKey, dayNumber: { gte: requestedDayNumber } },
          orderBy: { dayNumber: 'asc' }
        });
        const now = new Date();
        // Phase 1: temp values to avoid unique constraint conflicts
        for (const l of lessonsToShift) {
          await tx.lesson.update({
            where: { id: l.id },
            data: { dayNumber: 100000 + l.dayNumber, updatedAt: now }
          });
        }
        // Phase 2: final values (each +1)
        for (const l of lessonsToShift) {
          await tx.lesson.update({
            where: { id: l.id },
            data: { dayNumber: l.dayNumber + 1, updatedAt: now }
          });
        }
      }

      // Generate a unique lesson ID using the standard format; if already taken
      // (by an existing lesson whose dayNumber changed but ID didn't), fall back
      // to max numeric suffix + 1 across the module.
      let lessonId = `${moduleKey}-${requestedDayNumber}`;
      const idConflict = await tx.lesson.findUnique({ where: { id: lessonId } });
      if (idConflict) {
        const allIds = await tx.lesson.findMany({ where: { module: moduleKey }, select: { id: true } });
        const maxNum = allIds.reduce((max, l) => {
          const match = l.id.match(/-(\d+)$/);
          return match ? Math.max(max, parseInt(match[1])) : max;
        }, 0);
        lessonId = `${moduleKey}-${maxNum + 1}`;
      }

      // Create lesson
      const lesson = await tx.lesson.create({
        data: {
          id: lessonId,
          module: moduleKey,
          dayNumber: requestedDayNumber,
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
            correctAnswer: quizAnswerLetterToId(lessonId, quiz.correctAnswer || 'A'),
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
              correctAnswer: quizAnswerLetterToId(lessonId, quiz.correctAnswer || 'A'),
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
 * Delete lesson (cascades to segments, quiz, progress) and reorders remaining day numbers
 */
router.delete('/lessons/:id', requireAdminAuth, async (req, res) => {
  try {
    const lessonId = req.params.id;

    const existing = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!existing) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const moduleKey = existing.module;

    await prisma.$transaction(async (tx) => {
      // Delete the lesson (cascades to segments, quiz, progress)
      await tx.lesson.delete({ where: { id: lessonId } });

      // Get remaining lessons in module sorted by dayNumber
      const remainingLessons = await tx.lesson.findMany({
        where: { module: moduleKey },
        orderBy: { dayNumber: 'asc' }
      });

      if (remainingLessons.length > 0) {
        const now = new Date();
        // Phase 1: Set temp dayNumbers (offset by 100000) to avoid unique constraint conflicts
        for (let i = 0; i < remainingLessons.length; i++) {
          await tx.lesson.update({
            where: { id: remainingLessons[i].id },
            data: { dayNumber: 100000 + i + 1, updatedAt: now }
          });
        }
        // Phase 2: Set final sequential dayNumbers starting from 1
        for (let i = 0; i < remainingLessons.length; i++) {
          await tx.lesson.update({
            where: { id: remainingLessons[i].id },
            data: { dayNumber: i + 1, updatedAt: now }
          });
        }
      }
    });

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
        name: true,
        email: true,
        tag: true,
        pushToken: true,
        pushTokenUpdatedAt: true,
        createdAt: true,
        lastSessionDate: true,
        developmentalVisible: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
        trialStartDate: true,
        trialEndDate: true,
        _count: { select: { Session: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = users.map(u => {
      const decrypted = decryptUserData(u);
      return {
        id: u.id,
        name: decrypted.name,
        email: decrypted.email,
        tag: u.tag,
        hasPushToken: !!u.pushToken,
        pushTokenUpdatedAt: u.pushTokenUpdatedAt,
        createdAt: u.createdAt,
        lastActiveAt: u.lastSessionDate,
        sessionCount: u._count.Session,
        developmentalVisible: u.developmentalVisible,
        subscriptionStatus: u.subscriptionStatus,
        subscriptionPlan: u.subscriptionPlan,
        subscriptionStartDate: u.subscriptionStartDate,
        subscriptionEndDate: u.subscriptionEndDate,
        trialStartDate: u.trialStartDate,
        trialEndDate: u.trialEndDate,
      };
    });

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

/**
 * PUT /api/admin/users/:id/tag
 * Update a user's tag (user or tester)
 */
router.put('/users/:id/tag', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { tag } = req.body;
  if (!['user', 'tester'].includes(tag)) {
    return res.status(400).json({ error: 'tag must be "user" or "tester"' });
  }
  try {
    await prisma.user.update({ where: { id }, data: { tag } });
    res.json({ userId: id, tag });
  } catch (error) {
    console.error('Admin update user tag error:', error);
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

// ============================================================================
// USER PROFILE ENDPOINT
// ============================================================================

/**
 * GET /api/admin/users/:id/profile
 * Returns lesson completions and sessions for a specific user
 */
router.get('/users/:id/profile', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const [lessonProgress, sessions] = await Promise.all([
      prisma.userLessonProgress.findMany({
        where: { userId: id, status: 'COMPLETED' },
        select: {
          lessonId: true,
          completedAt: true,
          Lesson: { select: { title: true, module: true } },
        },
        orderBy: { completedAt: 'desc' },
      }),
      prisma.session.findMany({
        where: { userId: id },
        select: {
          id: true,
          mode: true,
          analysisStatus: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      lessons: lessonProgress.map(p => ({
        lessonId: p.lessonId,
        title: p.Lesson?.title ?? p.lessonId,
        module: p.Lesson?.module ?? null,
        completedAt: p.completedAt,
      })),
      sessions: sessions.map(s => ({
        id: s.id,
        mode: s.mode,
        status: s.analysisStatus,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error('Admin get user profile error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
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

// ============================================================================
// KEYWORDS
// ============================================================================

/**
 * GET /api/admin/keywords
 * List all keywords, optionally filtered by search term
 */
router.get('/keywords', requireAdminAuth, async (req, res) => {
  try {
    const { search } = req.query;
    const where = search
      ? { OR: [{ term: { contains: search, mode: 'insensitive' } }, { definition: { contains: search, mode: 'insensitive' } }] }
      : {};

    const keywords = await prisma.keyword.findMany({
      where,
      orderBy: { term: 'asc' },
    });

    res.json({ keywords });
  } catch (error) {
    console.error('Admin list keywords error:', error);
    res.status(500).json({ error: 'Failed to list keywords' });
  }
});

/**
 * POST /api/admin/keywords
 * Create a new keyword
 */
router.post('/keywords', requireAdminAuth, async (req, res) => {
  try {
    const { term, definition } = req.body;
    if (!term || !term.trim()) return res.status(400).json({ error: 'term is required' });
    if (!definition || !definition.trim()) return res.status(400).json({ error: 'definition is required' });

    const keyword = await prisma.keyword.create({
      data: {
        id: crypto.randomUUID(),
        term: term.trim(),
        definition: definition.trim(),
        updatedAt: new Date(),
      },
    });

    res.status(201).json({ keyword });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: `Keyword "${req.body.term}" already exists` });
    }
    console.error('Admin create keyword error:', error);
    res.status(500).json({ error: 'Failed to create keyword' });
  }
});

/**
 * PUT /api/admin/keywords/:id
 * Update an existing keyword
 */
router.put('/keywords/:id', requireAdminAuth, async (req, res) => {
  try {
    const { term, definition } = req.body;
    if (!term || !term.trim()) return res.status(400).json({ error: 'term is required' });
    if (!definition || !definition.trim()) return res.status(400).json({ error: 'definition is required' });

    const existing = await prisma.keyword.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Keyword not found' });

    const keyword = await prisma.keyword.update({
      where: { id: req.params.id },
      data: { term: term.trim(), definition: definition.trim(), updatedAt: new Date() },
    });

    res.json({ keyword });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: `Keyword "${req.body.term}" already exists` });
    }
    console.error('Admin update keyword error:', error);
    res.status(500).json({ error: 'Failed to update keyword' });
  }
});

/**
 * DELETE /api/admin/keywords/:id
 */
router.delete('/keywords/:id', requireAdminAuth, async (req, res) => {
  try {
    const existing = await prisma.keyword.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Keyword not found' });

    await prisma.keyword.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete keyword error:', error);
    res.status(500).json({ error: 'Failed to delete keyword' });
  }
});

// ============================================================================
// SYNC TO PROD
// ============================================================================

/**
 * POST /api/admin/sync-to-prod
 * Reads all Modules, Lessons (with segments + quizzes), and Keywords from
 * the dev DB, then forwards them to the prod API's /receive-sync endpoint.
 *
 * Requires env vars on the dev App Runner:
 *   PROD_API_URL   — e.g. https://wpwpawhz29.ap-southeast-1.awsapprunner.com
 *   SYNC_SECRET    — shared secret, must match SYNC_SECRET on prod App Runner
 */
router.post('/sync-to-prod', requireAdminAuth, async (req, res) => {
  const prodApiUrl = process.env.PROD_API_URL;
  const syncSecret = process.env.SYNC_SECRET;

  if (!prodApiUrl || !syncSecret) {
    return res.status(503).json({ error: 'PROD_API_URL or SYNC_SECRET is not configured on this server' });
  }

  try {
    // Read all content from dev DB
    const [modules, lessons, keywords] = await Promise.all([
      prisma.module.findMany({ orderBy: { displayOrder: 'asc' } }),
      prisma.lesson.findMany({
        include: {
          LessonSegment: { orderBy: { order: 'asc' } },
          Quiz: { include: { QuizOption: { orderBy: { order: 'asc' } } } },
        },
        orderBy: [{ module: 'asc' }, { dayNumber: 'asc' }],
      }),
      prisma.keyword.findMany({ orderBy: { term: 'asc' } }),
    ]);

    // Forward to prod API (server-to-server; prod App Runner is publicly accessible)
    const fetch = require('node-fetch');
    const response = await fetch(`${prodApiUrl}/api/admin/receive-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${syncSecret}`,
      },
      body: JSON.stringify({ modules, lessons, keywords }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Prod API responded with ${response.status}`);
    }

    const result = await response.json();
    res.json(result);
  } catch (error) {
    console.error('Sync to prod error:', error);
    res.status(500).json({ error: 'Sync failed: ' + error.message });
  }
});

/**
 * POST /api/admin/receive-sync
 * Receives module/lesson/keyword data from the dev API and upserts it into
 * whichever DB this server is connected to (intended for prod App Runner).
 *
 * Protected by SYNC_SECRET header — NOT by admin JWT — so the dev App Runner
 * can call this without needing a prod JWT token.
 *
 * Lessons and segments are upserted by ID so existing user data
 * (TextInputResponse) is never deleted. Quiz options are delete-and-recreated
 * because QuizResponse stores answers as plain strings, not FK references.
 */
router.post('/receive-sync', async (req, res) => {
  const syncSecret = process.env.SYNC_SECRET;
  if (!syncSecret) {
    return res.status(503).json({ error: 'SYNC_SECRET is not configured on this server' });
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token || token !== syncSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { modules = [], lessons = [], keywords = [] } = req.body;

  try {
    // ── Sync Modules ─────────────────────────────────────────────────────────
    for (const mod of modules) {
      await prisma.module.upsert({
        where: { key: mod.key },
        create: mod,
        update: {
          title: mod.title,
          shortName: mod.shortName,
          description: mod.description,
          displayOrder: mod.displayOrder,
          backgroundColor: mod.backgroundColor,
          updatedAt: mod.updatedAt,
        },
      });
    }

    // ── Sync Lessons + Segments + Quizzes ────────────────────────────────────
    let totalSegments = 0;
    let totalQuizzes = 0;

    for (const lesson of lessons) {
      const { LessonSegment: segments = [], Quiz: quiz = null, ...lessonData } = lesson;

      await prisma.lesson.upsert({
        where: { id: lessonData.id },
        create: lessonData,
        update: {
          module: lessonData.module,
          dayNumber: lessonData.dayNumber,
          title: lessonData.title,
          subtitle: lessonData.subtitle,
          shortDescription: lessonData.shortDescription,
          objectives: lessonData.objectives,
          estimatedMinutes: lessonData.estimatedMinutes,
          teachesCategories: lessonData.teachesCategories,
          dragonImageUrl: lessonData.dragonImageUrl,
          backgroundColor: lessonData.backgroundColor,
          ellipse77Color: lessonData.ellipse77Color,
          ellipse78Color: lessonData.ellipse78Color,
          updatedAt: lessonData.updatedAt,
        },
      });

      // Upsert segments by ID — preserves any linked TextInputResponse rows
      for (const seg of segments) {
        await prisma.lessonSegment.upsert({
          where: { id: seg.id },
          create: seg,
          update: {
            order: seg.order,
            sectionTitle: seg.sectionTitle,
            contentType: seg.contentType,
            bodyText: seg.bodyText,
            imageUrl: seg.imageUrl,
            iconType: seg.iconType,
            aiCheckMode: seg.aiCheckMode,
            idealAnswer: seg.idealAnswer,
            updatedAt: seg.updatedAt,
          },
        });
      }
      totalSegments += segments.length;

      // Sync quiz + options
      if (quiz) {
        const { QuizOption: options = [], ...quizData } = quiz;
        await prisma.quiz.upsert({
          where: { id: quizData.id },
          create: quizData,
          update: {
            question: quizData.question,
            correctAnswer: quizData.correctAnswer,
            explanation: quizData.explanation,
            updatedAt: quizData.updatedAt,
          },
        });
        await prisma.quizOption.deleteMany({ where: { quizId: quizData.id } });
        if (options.length > 0) {
          await prisma.quizOption.createMany({ data: options });
        }
        totalQuizzes++;
      }
    }

    // ── Sync Keywords ────────────────────────────────────────────────────────
    for (const kw of keywords) {
      await prisma.keyword.upsert({
        where: { id: kw.id },
        create: kw,
        update: {
          term: kw.term,
          definition: kw.definition,
          updatedAt: kw.updatedAt,
        },
      });
    }

    res.json({
      success: true,
      synced: {
        modules: modules.length,
        lessons: lessons.length,
        segments: totalSegments,
        quizzes: totalQuizzes,
        keywords: keywords.length,
      },
    });
  } catch (error) {
    console.error('Receive sync error:', error);
    res.status(500).json({ error: 'Sync failed: ' + error.message });
  }
});

// ============================================================================
// SESSION ENDPOINTS
// ============================================================================

function calculateChildAgeInMonths(birthday, birthYear) {
  const today = new Date();
  if (birthday) {
    const birthDate = new Date(birthday);
    return (today.getFullYear() - birthDate.getFullYear()) * 12 + (today.getMonth() - birthDate.getMonth());
  }
  return birthYear ? (today.getFullYear() - birthYear) * 12 : null;
}

function formatGender(genderEnum) {
  return { BOY: 'boy', GIRL: 'girl', OTHER: 'child' }[genderEnum] || 'child';
}

function getChildSpeaker(roleIdentificationJson) {
  const speakerIdentification = roleIdentificationJson?.speaker_identification || {};
  for (const [speakerId, info] of Object.entries(speakerIdentification)) {
    if (info.role === 'CHILD') return speakerId;
  }
  return null;
}

/**
 * GET /api/admin/sessions
 * Search CDI sessions by sessionId, userId, date range
 */
router.get('/sessions', requireAdminAuth, async (req, res) => {
  try {
    const { sessionId, userId, from, to, limit = '20', noCards } = req.query;

    const where = { mode: 'CDI' };
    if (sessionId) where.id = sessionId;
    if (userId) where.userId = userId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    if (noCards === 'true') where.coachingCards = null;

    const sessions = await prisma.session.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit), 100),
      select: {
        id: true,
        userId: true,
        mode: true,
        analysisStatus: true,
        analysisError: true,
        enrichmentStatus: true,
        enrichmentError: true,
        createdAt: true,
        coachingCards: true,
      },
    });

    res.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        mode: s.mode,
        analysisStatus: s.analysisStatus,
        analysisError: s.analysisError || null,
        enrichmentStatus: s.enrichmentStatus,
        enrichmentError: s.enrichmentError || null,
        createdAt: s.createdAt,
        hasCoachingCards: !!s.coachingCards,
      })),
    });
  } catch (error) {
    console.error('GET /admin/sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/**
 * POST /api/admin/sessions/:id/rerun-cdi-coaching
 * Re-run CDI coaching for a session and write results back to DB
 */
router.post('/sessions/:id/rerun-cdi-coaching', requireAdminAuth, async (req, res) => {
  const sessionId = req.params.id;
  try {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.mode !== 'CDI') return res.status(400).json({ error: `Session mode is ${session.mode}, expected CDI` });

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    const childName = user?.childName ? decryptSensitiveData(user.childName) : 'the child';
    const childAgeMonths = calculateChildAgeInMonths(user?.childBirthday, user?.childBirthYear);
    const childGender = user?.childGender ? formatGender(user.childGender) : 'child';

    const child = await prisma.child.findFirst({ where: { userId: session.userId } });
    let clinicalPriority = {};
    if (child) {
      const latestComputedAt = await prisma.childIssuePriority.findFirst({
        where: { childId: child.id },
        orderBy: { computedAt: 'desc' },
        select: { computedAt: true },
      });
      const issuePriorities = latestComputedAt
        ? await prisma.childIssuePriority.findMany({
            where: { childId: child.id, computedAt: latestComputedAt.computedAt },
            orderBy: { priorityRank: 'asc' },
          })
        : [];
      clinicalPriority = {
        primaryIssue: child.primaryIssue,
        primaryStrategy: child.primaryStrategy,
        secondaryIssue: child.secondaryIssue,
        secondaryStrategy: child.secondaryStrategy,
        issuePriorities,
      };
    }

    const priorCompletedCount = await prisma.session.count({
      where: { userId: session.userId, analysisStatus: 'COMPLETED' },
    });

    const childSpeaker = getChildSpeaker(session.roleIdentificationJson || {});
    const utterances = await getUtterances(sessionId);
    const tagCounts = session.tagCounts || {};

    const childInfo = {
      name: childName,
      ageMonths: childAgeMonths,
      gender: childGender,
      clinicalPriority,
      isFirstSession: priorCompletedCount === 0,
      durationSeconds: session.durationSeconds || null,
    };

    const result = await generateCdiCoaching(utterances, childInfo, tagCounts, childSpeaker);
    if (!result) return res.status(500).json({ error: 'generateCdiCoaching returned null' });

    const coachingCards = result.coachingCards
      ? { sections: result.coachingCards, tomorrowGoal: result.tomorrowGoal || null }
      : null;

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        coachingSummary: result.coachingSummary || null,
        coachingCards,
      },
    });

    res.json({
      ok: true,
      coachingSummary: result.coachingSummary,
      coachingCards: result.coachingCards,
      tomorrowGoal: result.tomorrowGoal,
    });
  } catch (error) {
    console.error(`POST /admin/sessions/${sessionId}/rerun-cdi-coaching error:`, error);
    res.status(500).json({ error: error.message || 'Rerun failed' });
  }
});

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

/**
 * GET /api/admin/subscriptions
 * List all users with their subscription status and trial info.
 * Supports ?status= filter (TRIAL, ACTIVE, EXPIRED, CANCELLED, NONE, INACTIVE).
 */
router.get('/subscriptions', requireAdminAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? { subscriptionStatus: status } : {};

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        tag: true,
        createdAt: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
        trialStartDate: true,
        trialEndDate: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = users.map(u => {
      const decrypted = decryptUserData(u);
      return {
        id: u.id,
        name: decrypted.name,
        email: decrypted.email,
        tag: u.tag,
        createdAt: u.createdAt,
        subscriptionStatus: u.subscriptionStatus,
        subscriptionPlan: u.subscriptionPlan,
        subscriptionStartDate: u.subscriptionStartDate,
        subscriptionEndDate: u.subscriptionEndDate,
        trialStartDate: u.trialStartDate,
        trialEndDate: u.trialEndDate,
      };
    });

    res.json({ users: formatted });
  } catch (error) {
    console.error('Admin get subscriptions error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription data' });
  }
});

/**
 * POST /api/admin/subscriptions/send-trial-expiry-emails
 * Manually trigger trial expiry reminder emails for users whose trial ends in N days.
 * Body: { daysBeforeExpiry?: number }  (default: 3)
 */
router.post('/subscriptions/send-trial-expiry-emails', requireAdminAuth, async (req, res) => {
  try {
    const daysBeforeExpiry = parseInt(req.body.daysBeforeExpiry ?? '3', 10);
    if (isNaN(daysBeforeExpiry) || daysBeforeExpiry < 1 || daysBeforeExpiry > 30) {
      return res.status(400).json({ error: 'daysBeforeExpiry must be between 1 and 30' });
    }

    const result = await runTrialExpiryJob(daysBeforeExpiry);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('Admin send trial expiry emails error:', error);
    res.status(500).json({ error: 'Failed to send trial expiry emails' });
  }
});

// ─── Coach Chat ───────────────────────────────────────────────────────────────

/**
 * GET /api/admin/coach/users?q=<search>
 * Search all users by name, email, or userId for the chat panel.
 * Returns up to 50 results with a flag indicating existing chat history.
 */
router.get('/coach/users', requireAdminAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();

    const where = q ? {
      OR: [
        { id: { contains: q } },
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    } : {};

    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 10;
    const skip  = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          _count: { select: { CoachChatMessage: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const { decryptUserData } = require('../utils/encryption.cjs');

    res.json({
      users: users.map(u => {
        const dec = decryptUserData(u);
        return {
          userId: u.id,
          name: dec.name || u.name,
          email: dec.email || u.email,
          hasChat: u._count.CoachChatMessage > 0,
          messageCount: u._count.CoachChatMessage,
        };
      }),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Admin coach users search error:', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

/**
 * GET /api/admin/coach/chats
 * List all users who have coach chat messages, with message count and last message time.
 */
router.get('/coach/chats', requireAdminAuth, async (req, res) => {
  try {
    const rows = await prisma.coachChatMessage.groupBy({
      by: ['userId'],
      _count: { id: true },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
    });

    const userIds = rows.map(r => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const result = rows.map(r => ({
      userId: r.userId,
      name: userMap[r.userId]?.name ?? 'Unknown',
      email: userMap[r.userId]?.email ?? '',
      messageCount: r._count.id,
      lastMessageAt: r._max.createdAt,
    }));

    res.json({ chats: result });
  } catch (err) {
    console.error('Admin coach chats error:', err);
    res.status(500).json({ error: 'Failed to fetch chat list' });
  }
});

/**
 * GET /api/admin/coach/chats/:userId
 * Get all chat messages for a specific user, oldest first.
 */
router.get('/coach/chats/:userId', requireAdminAuth, async (req, res) => {
  try {
    const messages = await prisma.coachChatMessage.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, text: true, createdAt: true },
    });
    res.json({ messages });
  } catch (err) {
    console.error('Admin coach chat detail error:', err);
    res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
});

/**
 * POST /api/admin/coach/chats/:userId/reply
 * Admin sends a message into a user's coach chat as AI (role: model) or psychologist.
 * Body: { message: string, mode: 'ai' | 'psychologist' }
 */
router.post('/coach/chats/:userId/reply', requireAdminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { message, mode } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    if (mode !== 'ai' && mode !== 'psychologist') {
      return res.status(400).json({ error: 'mode must be ai or psychologist' });
    }

    const role = mode === 'ai' ? 'model' : 'psychologist';

    const created = await prisma.coachChatMessage.create({
      data: { userId, role, text: message.trim() },
      select: { id: true, role: true, text: true, createdAt: true },
    });

    res.json({ message: created });
  } catch (err) {
    console.error('Admin coach reply error:', err);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

/**
 * GET /api/admin/coach/psychologist-requests
 * Returns open "Talk to a Psychologist" support requests, newest first.
 */
router.get('/coach/psychologist-requests', requireAdminAuth, async (req, res) => {
  try {
    const requests = await prisma.supportRequest.findMany({
      where: {
        status: 'OPEN',
        description: { contains: 'psychologist' },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        email: true,
        createdAt: true,
        User: { select: { name: true } },
      },
    });

    res.json({
      requests: requests.map(r => ({
        id: r.id,
        userId: r.userId,
        name: r.User?.name ?? 'Unknown',
        email: r.email,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error('Admin psychologist requests error:', err);
    res.status(500).json({ error: 'Failed to fetch psychologist requests' });
  }
});

/**
 * POST /api/admin/coach/psychologist-requests/:id/dismiss
 * Marks a psychologist support request as resolved.
 */
router.post('/coach/psychologist-requests/:id/dismiss', requireAdminAuth, async (req, res) => {
  try {
    await prisma.supportRequest.update({
      where: { id: req.params.id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Admin dismiss psychologist request error:', err);
    res.status(500).json({ error: 'Failed to dismiss request' });
  }
});

module.exports = router;
