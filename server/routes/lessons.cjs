/**
 * Bite-Size Learning Curriculum Routes
 * Handles lessons, segments, quizzes, and progress tracking
 */
const express = require('express');
const crypto = require('crypto');
const Joi = require('joi');
const prisma = require('../services/db.cjs');
const { requireAuth } = require('../middleware/auth.cjs');

const router = express.Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const updateProgressSchema = Joi.object({
  currentSegment: Joi.number().integer().min(1).max(10).required(),
  timeSpentSeconds: Joi.number().integer().min(0).optional(),
  status: Joi.string().valid('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED').optional()
});

const submitQuizSchema = Joi.object({
  selectedAnswer: Joi.string().required()
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a lesson's prerequisites are met
 */
async function checkPrerequisites(userId, lesson) {
  if (!lesson.prerequisites || lesson.prerequisites.length === 0) {
    return true;
  }

  // Get progress for all prerequisite lessons
  const prerequisiteProgress = await prisma.userLessonProgress.findMany({
    where: {
      userId,
      lessonId: { in: lesson.prerequisites }
    }
  });

  // All prerequisites must be COMPLETED
  return prerequisiteProgress.every(p => p.status === 'COMPLETED') &&
         prerequisiteProgress.length === lesson.prerequisites.length;
}

/**
 * Format lesson for lesson card (list view)
 */
function formatLessonCard(lesson, userProgress) {
  return {
    id: lesson.id,
    phase: lesson.phase,
    phaseName: lesson.phase === 'CONNECT' ? 'Connect' : 'Discipline',
    title: lesson.title,
    subtitle: lesson.subtitle,
    description: lesson.shortDescription,
    dragonImageUrl: lesson.dragonImageUrl,
    backgroundColor: lesson.backgroundColor,
    ellipse77Color: lesson.ellipse77Color,
    ellipse78Color: lesson.ellipse78Color,
    isLocked: userProgress?.status === 'LOCKED',
    progress: userProgress
  };
}

// ============================================================================
// LESSON ENDPOINTS
// ============================================================================

/**
 * GET /api/lessons
 * Get all lessons with user progress
 * Query params: ?phase=CONNECT or ?phase=DISCIPLINE
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { phase } = req.query;

    // Build where clause
    const where = {};
    if (phase && ['CONNECT', 'DISCIPLINE'].includes(phase.toUpperCase())) {
      where.phase = phase.toUpperCase();
    }

    // Get all lessons
    const lessons = await prisma.lesson.findMany({
      where,
      orderBy: [
        { phaseNumber: 'asc' },
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

    // Get all prerequisite lesson IDs
    const allPrerequisiteIds = new Set();
    lessons.forEach(lesson => {
      if (lesson.prerequisites && lesson.prerequisites.length > 0) {
        lesson.prerequisites.forEach(prereqId => allPrerequisiteIds.add(prereqId));
      }
    });

    // Fetch all prerequisite progress in ONE query (instead of N queries)
    const prerequisiteProgress = await prisma.userLessonProgress.findMany({
      where: {
        userId,
        lessonId: { in: Array.from(allPrerequisiteIds) }
      }
    });

    // Create prerequisite progress map
    const prereqProgressMap = {};
    prerequisiteProgress.forEach(p => {
      prereqProgressMap[p.lessonId] = p;
    });

    // Check prerequisites and determine lock status for each lesson
    // IMPORTANT: One lesson per day rule - a lesson unlocks the day after the previous lesson was completed
    const lessonCards = lessons.map((lesson, index) => {
      let progress = progressMap[lesson.id];

      // If no progress exists, create initial state
      if (!progress) {
        // First, check if this is the very first lesson (no prerequisites)
        const isFirstLesson = !lesson.prerequisites || lesson.prerequisites.length === 0;

        // Check prerequisites using the pre-fetched data
        let prerequisitesMet = true;
        if (lesson.prerequisites && lesson.prerequisites.length > 0) {
          prerequisitesMet = lesson.prerequisites.every(prereqId => {
            const prereqProgress = prereqProgressMap[prereqId];
            return prereqProgress && prereqProgress.status === 'COMPLETED';
          });
        }

        // ONE LESSON PER DAY RULE: Check if previous lesson was completed today
        let isLockedByDailyLimit = false;
        if (prerequisitesMet && !isFirstLesson && lesson.prerequisites && lesson.prerequisites.length > 0) {
          // Get the most recent prerequisite completion date
          const prereqCompletionDates = lesson.prerequisites
            .map(prereqId => prereqProgressMap[prereqId]?.completedAt)
            .filter(date => date != null)
            .map(date => new Date(date));

          if (prereqCompletionDates.length > 0) {
            // Get the latest completion date
            const latestCompletion = new Date(Math.max(...prereqCompletionDates.map(d => d.getTime())));

            // Check if latest completion was today
            const today = new Date();
            const isCompletedToday =
              latestCompletion.getDate() === today.getDate() &&
              latestCompletion.getMonth() === today.getMonth() &&
              latestCompletion.getFullYear() === today.getFullYear();

            if (isCompletedToday) {
              isLockedByDailyLimit = true;
            }
          }
        }

        const status = (prerequisitesMet && !isLockedByDailyLimit) ? 'NOT_STARTED' : 'LOCKED';

        progress = {
          lessonId: lesson.id,
          userId,
          status,
          currentSegment: 1,
          totalSegments: 4, // Default, will be updated when lesson is opened
          startedAt: new Date(),
          lastViewedAt: new Date(),
          timeSpentSeconds: 0
        };
      }

      return formatLessonCard(lesson, progress);
    });

    // Generate content version hash based on lesson IDs and update times
    // This changes whenever lessons are added, removed, or modified
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

    // Get current lesson
    const currentProgress = userProgress
      .filter(p => p.status === 'IN_PROGRESS')
      .sort((a, b) => new Date(b.lastViewedAt) - new Date(a.lastViewedAt))[0];

    let currentLesson = null;
    if (currentProgress) {
      currentLesson = await prisma.lesson.findUnique({
        where: { id: currentProgress.lessonId }
      });
    }

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
      currentPhase: currentLesson?.phase || 'CONNECT',
      currentDayNumber: currentLesson?.dayNumber || 1,
      totalTimeSpentMinutes,
      averageQuizScore: Math.round(averageQuizScore),
      streak: 0 // TODO: Calculate streak based on daily completion
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
 * Only returns lesson content, not user progress
 */
router.get('/share/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get lesson with segments (no quiz for shared view)
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

    // Return only lesson data (no user progress or quiz)
    res.json({
      lesson: {
        id: lesson.id,
        title: lesson.title,
        subtitle: lesson.subtitle,
        shortDescription: lesson.shortDescription,
        phase: lesson.phase,
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

    // Check prerequisites
    const prerequisitesMet = await checkPrerequisites(userId, lesson);
    if (!prerequisitesMet) {
      return res.status(403).json({
        error: 'Prerequisites not met',
        message: 'You must complete previous lessons first'
      });
    }

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
      // Remove Prisma field names
      LessonSegment: undefined,
      Quiz: undefined
    };

    res.json({
      lesson: lessonResponse,
      userProgress
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
 * GET /api/lessons/next
 * Get the next lesson user should complete
 */
router.get('/next', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    // Get all lessons ordered by phase and day
    const lessons = await prisma.lesson.findMany({
      orderBy: [
        { phaseNumber: 'asc' },
        { dayNumber: 'asc' }
      ]
    });

    // Get user progress
    const userProgress = await prisma.userLessonProgress.findMany({
      where: { userId }
    });

    const completedLessonIds = userProgress
      .filter(p => p.status === 'COMPLETED')
      .map(p => p.lessonId);

    // Find first lesson that is not completed and has met prerequisites
    for (const lesson of lessons) {
      if (!completedLessonIds.includes(lesson.id)) {
        const prerequisitesMet = await checkPrerequisites(userId, lesson);
        if (prerequisitesMet) {
          return res.json({ lesson });
        }
      }
    }

    // All lessons completed
    res.json({ lesson: null });

  } catch (error) {
    console.error('Get next lesson error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to get next lesson',
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
        { phaseNumber: 'asc' },
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
      include: { LessonSegment: true }
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

    // Fetch quiz and previous attempts in parallel for better performance
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

module.exports = router;
