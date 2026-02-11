/**
 * Bite-Size Learning Curriculum Routes
 * Handles lessons, segments, quizzes, and progress tracking
 */
const express = require('express');
const crypto = require('crypto');
const Joi = require('joi');
const prisma = require('../services/db.cjs');
const { requireAuth } = require('../middleware/auth.cjs');

const { evaluateTextInput } = require('../services/textInputEvaluationService.cjs');

const router = express.Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const updateProgressSchema = Joi.object({
  currentSegment: Joi.number().integer().min(1).max(100).required(),
  timeSpentSeconds: Joi.number().integer().min(0).optional(),
  status: Joi.string().valid('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED').optional()
});

const submitQuizSchema = Joi.object({
  selectedAnswer: Joi.string().required()
});

const submitTextInputSchema = Joi.object({
  userAnswer: Joi.string().required().min(1).max(2000)
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format lesson for lesson card (list view)
 */
function formatLessonCard(lesson, userProgress) {
  return {
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
    progress: userProgress
  };
}

// ============================================================================
// LESSON ENDPOINTS
// ============================================================================

/**
 * GET /api/lessons
 * Get all lessons with user progress
 * Query params: ?module=FOUNDATION (filter by module)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { module: moduleFilter } = req.query;

    // Build where clause
    const where = {};
    if (moduleFilter) {
      where.module = moduleFilter.toUpperCase();
    }

    // Get all lessons
    const lessons = await prisma.lesson.findMany({
      where,
      orderBy: [
        { module: 'asc' },
        { dayNumber: 'asc' }
      ]
    });

    // Get user progress for all lessons
    const userProgress = await prisma.userLessonProgress.findMany({
      where: { userId }
    });

    // Create progress map
    const progressMap = {};
    userProgress.forEach(p => {
      progressMap[p.lessonId] = p;
    });

    // Format lesson cards — all unlocked
    const lessonCards = lessons.map(lesson => {
      const progress = progressMap[lesson.id] || null;
      return formatLessonCard(lesson, progress);
    });

    // Generate content version hash
    const contentHash = crypto
      .createHash('md5')
      .update(lessons.map(l => `${l.id}-${l.updatedAt}`).join('|'))
      .digest('hex')
      .substring(0, 8);

    res.json({
      lessons: lessonCards,
      userProgress: progressMap,
      contentVersion: contentHash
    });

  } catch (error) {
    console.error('Get lessons error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to fetch lessons',
      details: error.message
    });
  }
});

// ============================================================================
// USER STATS ENDPOINT
// Note: This must come BEFORE the /:id route to avoid matching "learning-stats" as an id
// ============================================================================

/**
 * GET /api/user/learning-stats
 * Get user's learning statistics
 */
router.get('/learning-stats', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    // Get all lessons count
    const totalLessons = await prisma.lesson.count();

    // Get user progress
    const userProgress = await prisma.userLessonProgress.findMany({
      where: { userId }
    });

    const completedLessons = userProgress.filter(p => p.status === 'COMPLETED').length;
    const inProgressLessons = userProgress.filter(p => p.status === 'IN_PROGRESS').length;

    // Calculate total time spent (in minutes)
    const totalTimeSpentSeconds = userProgress.reduce((sum, p) => sum + p.timeSpentSeconds, 0);
    const totalTimeSpentMinutes = Math.round(totalTimeSpentSeconds / 60);

    // Get quiz responses
    const quizResponses = await prisma.quizResponse.findMany({
      where: { userId }
    });

    // Calculate average quiz score (correct / total)
    const averageQuizScore = quizResponses.length > 0
      ? (quizResponses.filter(r => r.isCorrect).length / quizResponses.length) * 100
      : 0;

    res.json({
      totalLessons,
      completedLessons,
      inProgressLessons,
      totalTimeSpentMinutes,
      averageQuizScore: Math.round(averageQuizScore),
      streak: 0
    });

  } catch (error) {
    console.error('Get learning stats error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to get learning stats',
      details: error.message
    });
  }
});

/**
 * GET /api/lessons/share/:id
 * Public endpoint to get lesson detail for sharing (no auth required)
 */
router.get('/share/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        LessonSegment: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    res.json({
      lesson: {
        id: lesson.id,
        title: lesson.title,
        subtitle: lesson.subtitle,
        shortDescription: lesson.shortDescription,
        module: lesson.module,
        backgroundColor: lesson.backgroundColor,
        ellipse77Color: lesson.ellipse77Color,
        ellipse78Color: lesson.ellipse78Color,
        segments: lesson.LessonSegment.map(s => ({
          sectionTitle: s.sectionTitle,
          bodyText: s.bodyText,
          order: s.order
        }))
      }
    });

  } catch (error) {
    console.error('Get shared lesson error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to fetch lesson',
      details: error.message
    });
  }
});

/**
 * GET /api/lessons/by-category/:category
 * Get lessons that teach a specific category
 */
router.get('/by-category/:category', requireAuth, async (req, res) => {
  try {
    const { category } = req.params;

    const lessons = await prisma.lesson.findMany({
      where: {
        teachesCategories: {
          has: category.toUpperCase()
        }
      },
      orderBy: [
        { module: 'asc' },
        { dayNumber: 'asc' }
      ]
    });

    res.json({ lessons });

  } catch (error) {
    console.error('Get lessons by category error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to get lessons by category',
      details: error.message
    });
  }
});

/**
 * GET /api/lessons/:id
 * Get lesson detail with segments and quiz
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Get lesson with segments and quiz
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        LessonSegment: {
          orderBy: { order: 'asc' }
        },
        Quiz: {
          include: {
            QuizOption: {
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Fetch all keywords for glossary feature
    const keywords = await prisma.keyword.findMany({
      select: {
        id: true,
        term: true,
        definition: true
      }
    });

    // Get or create user progress
    let userProgress = await prisma.userLessonProgress.findUnique({
      where: {
        userId_lessonId: { userId, lessonId: id }
      }
    });

    if (!userProgress) {
      userProgress = await prisma.userLessonProgress.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          lessonId: id,
          status: 'IN_PROGRESS',
          currentSegment: 1,
          totalSegments: lesson.LessonSegment.length,
          startedAt: new Date(),
          lastViewedAt: new Date(),
          timeSpentSeconds: 0
        }
      });
    } else {
      // Update last viewed time
      userProgress = await prisma.userLessonProgress.update({
        where: { id: userProgress.id },
        data: { lastViewedAt: new Date() }
      });
    }

    // Map Prisma field names to frontend expected names
    const lessonResponse = {
      ...lesson,
      segments: lesson.LessonSegment,
      quiz: lesson.Quiz ? {
        ...lesson.Quiz,
        options: lesson.Quiz.QuizOption
      } : null,
      LessonSegment: undefined,
      Quiz: undefined
    };

    res.json({
      lesson: lessonResponse,
      userProgress,
      keywords
    });

  } catch (error) {
    console.error('Get lesson detail error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to fetch lesson detail',
      details: error.message
    });
  }
});

/**
 * PUT /api/lessons/:id/progress
 * Update lesson progress
 */
router.put('/:id/progress', requireAuth, async (req, res) => {
  try {
    // Validate input
    const { error, value } = updateProgressSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.userId;
    const { id } = req.params;
    const { currentSegment, timeSpentSeconds, status } = value;

    // Get the lesson to retrieve segment count
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        LessonSegment: true,
        Quiz: true
      }
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Get existing progress
    let progress = await prisma.userLessonProgress.findUnique({
      where: {
        userId_lessonId: { userId, lessonId: id }
      }
    });

    // Create progress record if it doesn't exist
    if (!progress) {
      progress = await prisma.userLessonProgress.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          lessonId: id,
          status: status || 'IN_PROGRESS',
          currentSegment: currentSegment || 1,
          totalSegments: lesson.LessonSegment.length,
          startedAt: new Date(),
          lastViewedAt: new Date(),
          timeSpentSeconds: timeSpentSeconds || 0,
          completedAt: status === 'COMPLETED' ? new Date() : null
        }
      });
    } else {
      // Build update data
      const updateData = {
        currentSegment,
        lastViewedAt: new Date()
      };

      if (timeSpentSeconds !== undefined) {
        updateData.timeSpentSeconds = progress.timeSpentSeconds + timeSpentSeconds;
      }

      if (status) {
        updateData.status = status;
        if (status === 'COMPLETED') {
          updateData.completedAt = new Date();
        }
      }

      // Update progress
      progress = await prisma.userLessonProgress.update({
        where: { id: progress.id },
        data: updateData
      });
    }

    res.json(progress);

  } catch (error) {
    console.error('Update progress error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to update progress',
      details: error.message
    });
  }
});

// ============================================================================
// QUIZ ENDPOINTS
// ============================================================================

/**
 * POST /api/quizzes/:id/submit
 * Submit quiz answer
 */
router.post('/:quizId/submit', requireAuth, async (req, res) => {
  try {
    // Validate input
    const { error, value } = submitQuizSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.userId;
    const { quizId } = req.params;
    const { selectedAnswer } = value;

    // Fetch quiz and previous attempts in parallel
    const [quiz, previousAttempts] = await Promise.all([
      prisma.quiz.findUnique({
        where: { id: quizId },
        select: {
          id: true,
          correctAnswer: true,
          explanation: true
        }
      }),
      prisma.quizResponse.findMany({
        where: { userId, quizId },
        orderBy: { attemptNumber: 'desc' },
        take: 1,
        select: { attemptNumber: true }
      })
    ]);

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Check if answer is correct
    const isCorrect = selectedAnswer === quiz.correctAnswer;

    const attemptNumber = previousAttempts.length > 0
      ? previousAttempts[0].attemptNumber + 1
      : 1;

    // Create quiz response
    const quizResponse = await prisma.quizResponse.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        quizId,
        selectedAnswer,
        isCorrect,
        attemptNumber,
        respondedAt: new Date()
      }
    });

    // Mark lesson as completed after quiz submission
    const quizWithLesson = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { lessonId: true }
    });

    if (quizWithLesson) {
      const lesson = await prisma.lesson.findUnique({
        where: { id: quizWithLesson.lessonId },
        include: {
          LessonSegment: true,
          Quiz: true
        }
      });

      if (lesson) {
        const totalSegments = lesson.LessonSegment.length + (lesson.Quiz ? 1 : 0);

        await prisma.userLessonProgress.upsert({
          where: {
            userId_lessonId: {
              userId,
              lessonId: quizWithLesson.lessonId
            }
          },
          update: {
            status: 'COMPLETED',
            currentSegment: totalSegments,
            completedAt: new Date(),
            lastViewedAt: new Date()
          },
          create: {
            id: crypto.randomUUID(),
            userId,
            lessonId: quizWithLesson.lessonId,
            status: 'COMPLETED',
            currentSegment: totalSegments,
            totalSegments: lesson.LessonSegment.length,
            startedAt: new Date(),
            lastViewedAt: new Date(),
            completedAt: new Date(),
            timeSpentSeconds: 0
          }
        });
      }
    }

    res.json({
      isCorrect,
      correctAnswer: quiz.correctAnswer,
      explanation: quiz.explanation,
      attemptNumber,
      quizResponse
    });

  } catch (error) {
    console.error('Submit quiz error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to submit quiz',
      details: error.message
    });
  }
});

// ============================================================================
// TEXT INPUT ENDPOINTS
// ============================================================================

/**
 * POST /api/lessons/segments/:segmentId/text-response
 * Submit a text input response for AI evaluation
 */
router.post('/segments/:segmentId/text-response', requireAuth, async (req, res) => {
  try {
    // Validate input
    const { error, value } = submitTextInputSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.userId;
    const { segmentId } = req.params;
    const { userAnswer } = value;

    // Get the segment to retrieve prompt and ideal answer
    const segment = await prisma.lessonSegment.findUnique({
      where: { id: segmentId }
    });

    if (!segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    if (segment.contentType !== 'TEXT_INPUT') {
      return res.status(400).json({ error: 'This segment does not accept text input' });
    }

    if (!segment.idealAnswer) {
      return res.status(400).json({ error: 'This segment is not configured for evaluation' });
    }

    // Get previous attempts count
    const previousAttempts = await prisma.textInputResponse.findMany({
      where: { userId, segmentId },
      orderBy: { attemptNumber: 'desc' },
      take: 1,
      select: { attemptNumber: true }
    });

    const attemptNumber = previousAttempts.length > 0
      ? previousAttempts[0].attemptNumber + 1
      : 1;

    // Evaluate the response using Claude
    const evaluation = await evaluateTextInput({
      prompt: segment.bodyText,
      idealAnswer: segment.idealAnswer,
      userAnswer,
      aiCheckMode: segment.aiCheckMode || 'AI-Check'
    });

    // Save the response
    const textInputResponse = await prisma.textInputResponse.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        segmentId,
        userAnswer,
        aiEvaluation: evaluation,
        isCorrect: evaluation.isCorrect,
        score: evaluation.score,
        attemptNumber,
        respondedAt: new Date()
      }
    });

    res.json({
      isCorrect: evaluation.isCorrect,
      score: evaluation.score,
      feedback: evaluation.feedback,
      suggestions: evaluation.suggestions,
      idealAnswer: segment.idealAnswer,
      attemptNumber,
      textInputResponse
    });

  } catch (error) {
    console.error('Submit text input error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to submit text input',
      details: error.message
    });
  }
});

/**
 * GET /api/lessons/segments/:segmentId/text-responses
 * Get user's previous text input responses for a segment
 */
router.get('/segments/:segmentId/text-responses', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { segmentId } = req.params;

    const responses = await prisma.textInputResponse.findMany({
      where: { userId, segmentId },
      orderBy: { attemptNumber: 'desc' }
    });

    res.json({ responses });

  } catch (error) {
    console.error('Get text input responses error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to get text input responses',
      details: error.message
    });
  }
});

module.exports = router;
