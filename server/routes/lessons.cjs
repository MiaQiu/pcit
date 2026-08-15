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
const { resolveDragonImageUrl, resolveLessonAudioUrl, resolveContentMediaUrls } = require('../services/storage-s3.cjs');
const { buildShareCardImage } = require('../services/shareImage.cjs');
const { localeMiddleware } = require('../middleware/locale.cjs');

const router = express.Router();

router.use(localeMiddleware);

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
 * Returns a map of LessonModule key -> displayOrder from the Module table.
 * Used to sort lessons by the module's intended display order.
 */
async function getModuleDisplayOrderMap() {
  const modules = await prisma.module.findMany({ select: { key: true, displayOrder: true } });
  const map = {};
  modules.forEach(m => { map[m.key] = m.displayOrder; });
  return map;
}

// ============================================================================
// TRANSLATION MERGE HELPERS
// ============================================================================

function applyLessonTx(lesson, tx, locale) {
  if (!tx) return lesson;
  // Audio is a recorded asset, not translatable text — falling back to the
  // English narration for a non-English locale would play audio the user
  // can't understand, so audio-related fields only use the translation row
  // (defaulting to null/absent, never the English source) once locale !== 'en'.
  const allowAudioFallback = !locale || locale === 'en';
  return {
    ...lesson,
    title: tx.title ?? lesson.title,
    subtitle: tx.subtitle ?? lesson.subtitle,
    shortDescription: tx.shortDescription ?? lesson.shortDescription,
    objectives: tx.objectives ?? lesson.objectives,
    // Content V2 text still falls back to English independently — still
    // readable even if narration hasn't been recorded for this locale yet.
    contentV2: tx.contentV2 ?? lesson.contentV2,
    audioUrl: tx.audioUrl ?? (allowAudioFallback ? lesson.audioUrl : null),
    wordTimings: tx.wordTimings ?? (allowAudioFallback ? lesson.wordTimings : null),
    durationSeconds: tx.durationSeconds ?? (allowAudioFallback ? lesson.durationSeconds : null),
  };
}

function applySegmentTx(segment, tx) {
  if (!tx) return segment;
  return {
    ...segment,
    sectionTitle: tx.sectionTitle ?? segment.sectionTitle,
    bodyText: tx.bodyText ?? segment.bodyText,
    idealAnswer: tx.idealAnswer ?? segment.idealAnswer,
    customHtml: tx.customHtml ?? segment.customHtml,
  };
}

function applyQuizTx(quiz, tx) {
  if (!tx) return quiz;
  return {
    ...quiz,
    question: tx.question ?? quiz.question,
    explanation: tx.explanation ?? quiz.explanation,
    wrongExplanation: tx.wrongExplanation ?? quiz.wrongExplanation,
    options: quiz.options.map(opt => {
      const txOpt = Array.isArray(tx.options)
        ? tx.options.find(o => o.optionLabel === opt.optionLabel)
        : null;
      return txOpt ? { ...opt, optionText: txOpt.optionText } : opt;
    }),
  };
}

/**
 * Format lesson for lesson card (list view)
 */
async function formatLessonCard(lesson, userProgress) {
  return {
    id: lesson.id,
    module: lesson.module,
    title: lesson.title,
    subtitle: lesson.subtitle,
    description: lesson.shortDescription,
    dayNumber: lesson.dayNumber,
    dragonImageUrl: await resolveDragonImageUrl(lesson.dragonImageUrl),
    imageUpdatedAt: lesson.updatedAt,
    durationSeconds: lesson.durationSeconds ?? null,
    audioUrl: await resolveLessonAudioUrl(lesson.audioUrl),
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
 * GET /api/lessons/branding-images
 * Admin-configurable images for LearnScreen_v3's cover band and
 * LessonViewerScreen_v2's identity row, plus the cover band's title/subtitle
 * text for the caller's locale (?lang=, via localeMiddleware). Title/subtitle
 * fall back to the English admin-set copy if this locale isn't translated
 * yet, then to null (the mobile i18n default) if English isn't set either —
 * set via the admin portal's Settings page (images) and Content V2 list page
 * (title/subtitle, per-locale).
 */
router.get('/branding-images', requireAuth, async (req, res) => {
  try {
    const config = await prisma.appConfig.findUnique({ where: { key: 'branding-images' } });
    const value = config?.value || {};

    const [learnCoverUrl, lessonViewerUrl] = await Promise.all([
      resolveLessonAudioUrl(value.learnCoverKey || null),
      resolveLessonAudioUrl(value.lessonViewerKey || null),
    ]);

    const titleByLocale = value.learnTitleByLocale || (value.learnTitle ? { en: value.learnTitle } : {});
    const subtitleByLocale = value.learnSubtitleByLocale || (value.learnSubtitle ? { en: value.learnSubtitle } : {});

    res.json({
      learnCoverUrl,
      lessonViewerUrl,
      learnTitle: titleByLocale[req.locale] || titleByLocale.en || null,
      learnSubtitle: subtitleByLocale[req.locale] || subtitleByLocale.en || null,
    });
  } catch (error) {
    console.error('Get branding images error:', error.message);
    res.status(500).json({ error: 'Failed to fetch branding images' });
  }
});

/**
 * GET /api/lessons/demo-videos
 * Admin-uploaded demo videos for the Learn tab's "Demo Videos" section
 * (active only, in display order), with videoUrl/thumbnailUrl resolved to
 * presigned, playable URLs.
 */
router.get('/demo-videos', requireAuth, async (req, res) => {
  try {
    const demoVideos = await prisma.demoVideo.findMany({
      where: { isActive: true, videoUrl: { not: null } },
      orderBy: { displayOrder: 'asc' },
      select: { id: true, title: true, description: true, additionalText: true, videoUrl: true, thumbnailUrl: true, lessonId: true, createdAt: true, updatedAt: true },
    });

    const lessonIds = [...new Set(demoVideos.map(v => v.lessonId).filter(Boolean))];
    const lessons = lessonIds.length
      ? await prisma.lesson.findMany({ where: { id: { in: lessonIds } }, select: { id: true, title: true, module: true } })
      : [];
    const lessonById = new Map(lessons.map(l => [l.id, l]));

    const resolved = await Promise.all(demoVideos.map(async (v) => {
      const lesson = v.lessonId ? lessonById.get(v.lessonId) : null;
      return {
        ...v,
        videoUrl: await resolveDragonImageUrl(v.videoUrl),
        thumbnailUrl: await resolveDragonImageUrl(v.thumbnailUrl),
        lessonTitle: lesson?.title ?? null,
        moduleKey: lesson?.module ?? null,
      };
    }));

    res.json({ demoVideos: resolved });
  } catch (error) {
    console.error('Get demo videos error:', error.message);
    res.status(500).json({ error: 'Failed to fetch demo videos' });
  }
});

/**
 * POST /api/lessons/demo-videos/:id/view
 * Mark a demo video as viewed by the current user — called when the mobile
 * app opens DemoVideoDetailScreen. Upserts UserDemoVideoProgress, mirroring
 * how UserLessonProgress is created/touched on lesson GET /:id.
 */
router.post('/demo-videos/:id/view', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { id: demoVideoId } = req.params;

    const demoVideo = await prisma.demoVideo.findUnique({ where: { id: demoVideoId }, select: { id: true } });
    if (!demoVideo) {
      return res.status(404).json({ error: 'Demo video not found' });
    }

    const progress = await prisma.userDemoVideoProgress.upsert({
      where: { userId_demoVideoId: { userId, demoVideoId } },
      create: {
        id: crypto.randomUUID(),
        userId,
        demoVideoId,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      update: {
        lastViewedAt: new Date(),
      },
    });

    res.json({ progress });
  } catch (error) {
    console.error('Mark demo video viewed error:', error.message);
    res.status(500).json({ error: 'Failed to mark demo video viewed' });
  }
});

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

    // Get all lessons ordered by module displayOrder, then dayNumber
    const [lessons, moduleOrderMap] = await Promise.all([
      prisma.lesson.findMany({ where }),
      getModuleDisplayOrderMap()
    ]);
    lessons.sort((a, b) => {
      const modDiff = (moduleOrderMap[a.module] ?? 999) - (moduleOrderMap[b.module] ?? 999);
      return modDiff !== 0 ? modDiff : a.dayNumber - b.dayNumber;
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

    // Fetch lesson translations for locale
    const locale = req.locale;
    let lessonTxMap = {};
    if (locale !== 'en' && lessons.length > 0) {
      const txs = await prisma.lessonTranslation.findMany({
        where: { locale, lessonId: { in: lessons.map(l => l.id) } }
      });
      txs.forEach(tx => { lessonTxMap[tx.lessonId] = tx; });
    }

    // Format lesson cards — all unlocked
    const lessonCards = await Promise.all(lessons.map(lesson => {
      const progress = progressMap[lesson.id] || null;
      return formatLessonCard(applyLessonTx(lesson, lessonTxMap[lesson.id], locale), progress);
    }));

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
 * Public (no auth) — powers /share-lesson.html, the web landing page a
 * non-user opens from a shared "Read" link. Mirrors the mobile Read
 * experience (LessonReadScreen / LearnScreen_v3's Read modal), which only
 * renders contentV2 — lessons still on the legacy LessonSegment model have
 * nothing to show there either, so they 404 here the same way a
 * missing/inactive card 404s on /api/config/home-cards/share/:id.
 */
router.get('/share/:id', async (req, res) => {
  try {
    const lesson = await prisma.lesson.findUnique({ where: { id: req.params.id } });
    if (!lesson || !lesson.contentV2) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const moduleInfo = await prisma.module.findUnique({ where: { key: lesson.module } });

    res.json({
      id: lesson.id,
      title: lesson.title,
      moduleTitle: moduleInfo?.title || lesson.module,
      moduleColor: moduleInfo?.backgroundColor || '#E4E4FF',
      contentV2: await resolveContentMediaUrls(lesson.contentV2),
    });
  } catch (error) {
    console.error('Get shared lesson error:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch lesson' });
  }
});

/**
 * GET /api/lessons/:id/share-image.png
 * Public (no auth) — the shared title/subtitle/thumbnail card (see
 * server/services/shareImage.cjs). Title = the lesson's module name,
 * subtitle = the lesson's own title (e.g. "Positive Play" / "Introduction")
 * — mirrors the module-badge + lesson-title pairing already shown in
 * LearnScreen_v3's Read modal header.
 */
router.get('/:id/share-image.png', async (req, res) => {
  try {
    const lesson = await prisma.lesson.findUnique({ where: { id: req.params.id } });
    if (!lesson || !lesson.contentV2) return res.status(404).end();

    const moduleInfo = await prisma.module.findUnique({ where: { key: lesson.module } });
    const title = moduleInfo?.title || lesson.module;
    const thumbnailUrl = await resolveDragonImageUrl(lesson.dragonImageUrl);

    // Light purple (COLORS.cardPurple in nora-mobile) — lessons have no
    // badge color to derive a tint from like Home Cards do, so this is a
    // fixed brand tint instead.
    const png = await buildShareCardImage({ title, subtitle: lesson.title, thumbnailUrl, backgroundColor: '#E4E4FF' });
    res.set('Content-Type', 'image/png');
    // TODO: restore to a real max-age (e.g. 3600) once the share-card visual
    // design has settled — no-cache while we're actively tuning it so RN's
    // Image cache doesn't keep serving a stale render from before an edit.
    res.set('Cache-Control', 'no-cache');
    res.send(png);
  } catch (error) {
    console.error('Generate lesson share image error:', error);
    res.status(500).end();
  }
});

/**
 * GET /api/lessons/by-category/:category
 * Get lessons that teach a specific category
 */
router.get('/by-category/:category', requireAuth, async (req, res) => {
  try {
    const { category } = req.params;

    const [lessons, moduleOrderMap] = await Promise.all([
      prisma.lesson.findMany({ where: { teachesCategories: { has: category.toUpperCase() } } }),
      getModuleDisplayOrderMap()
    ]);
    lessons.sort((a, b) => {
      const modDiff = (moduleOrderMap[a.module] ?? 999) - (moduleOrderMap[b.module] ?? 999);
      return modDiff !== 0 ? modDiff : a.dayNumber - b.dayNumber;
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
      const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!userExists) {
        return res.status(401).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
      }

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

    // Fetch translations for the requested locale
    const locale = req.locale;
    let lessonTx = null, segmentTxMap = {}, quizTx = null;
    if (locale !== 'en') {
      const segmentIds = lesson.LessonSegment.map(s => s.id);
      const [lessonTxResult, segmentTxList, quizTxResult] = await Promise.all([
        prisma.lessonTranslation.findUnique({
          where: { lessonId_locale: { lessonId: id, locale } }
        }),
        prisma.lessonSegmentTranslation.findMany({
          where: { locale, segmentId: { in: segmentIds } }
        }),
        lesson.Quiz
          ? prisma.quizTranslation.findUnique({
              where: { quizId_locale: { quizId: lesson.Quiz.id, locale } }
            })
          : Promise.resolve(null),
      ]);
      lessonTx = lessonTxResult;
      quizTx = quizTxResult;
      segmentTxMap = Object.fromEntries(segmentTxList.map(t => [t.segmentId, t]));
    }

    // Map Prisma field names to frontend expected names, applying translations
    const translatedLesson = applyLessonTx(lesson, lessonTx, locale);
    const quizWithOptions = lesson.Quiz
      ? { ...lesson.Quiz, options: lesson.Quiz.QuizOption }
      : null;
    const moduleInfo = await prisma.module.findUnique({ where: { key: lesson.module } });
    const lessonResponse = {
      ...translatedLesson,
      audioUrl: await resolveLessonAudioUrl(translatedLesson.audioUrl),
      contentV2: await resolveContentMediaUrls(translatedLesson.contentV2),
      segments: lesson.LessonSegment.map(seg => applySegmentTx(seg, segmentTxMap[seg.id])),
      quiz: quizWithOptions ? applyQuizTx(quizWithOptions, quizTx) : null,
      // No real "share" tracking (sharing isn't a toggle like a like) — the
      // displayed count is just the random per-lesson base. See schema.prisma.
      shareCount: lesson.shareCountBase,
      shareCountBase: undefined,
      // Same module-title lookup used by the public /share/:id route and
      // the share-image endpoint — one source for the share card's title.
      moduleTitle: moduleInfo?.title || lesson.module,
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
          explanation: true,
          wrongExplanation: true
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
      explanation: isCorrect ? quiz.explanation : (quiz.wrongExplanation ?? quiz.explanation),
      wrongExplanation: quiz.wrongExplanation ?? null,
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
