// Learn module parent-input survey routes ("Tell Nora what happens instead")
const express = require('express');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth.cjs');
const prisma = require('../services/db.cjs');
const { logError } = require('../utils/errorLogger.cjs');
const { generateSurveyModuleSession, LEARN_MODULE_KEYS } = require('../services/pcitAnalysisService.cjs');
const { sendReportReadyNotification } = require('../services/pushNotifications.cjs');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

const MODULE_KEY_RE = /^[A-Za-z0-9_]{1,64}$/;
const ANSWER_KEY_RE = /^[A-Za-z0-9_]{1,64}$/;
const MAX_ANSWERS = 50;
const MAX_TEXT_LENGTH = 2000;
const MAX_SELECTIONS = 30;
const LANGUAGE_RE = /^[A-Za-z]{2,3}(-[A-Za-z]{2,4})?$/;
const SURVEY_REPORT_ATTEMPTS = 2;
const SURVEY_VARIANTS = new Set(['initial', 'followup']);

// Answers are { [questionKey]: string | string[] } — questions are defined
// client-side, so only the shape and sizes are checked here.
const validateAnswers = (answers) => {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return 'answers must be an object';
  }
  const entries = Object.entries(answers);
  if (entries.length === 0) return 'answers must not be empty';
  if (entries.length > MAX_ANSWERS) return 'Too many answers';
  for (const [key, value] of entries) {
    if (!ANSWER_KEY_RE.test(key)) return `Invalid answer key: ${key}`;
    if (typeof value === 'string') {
      if (value.length > MAX_TEXT_LENGTH) return `Answer too long: ${key}`;
    } else if (Array.isArray(value)) {
      if (value.length > MAX_SELECTIONS) return `Too many selections: ${key}`;
      if (!value.every(v => typeof v === 'string' && v.length <= MAX_TEXT_LENGTH)) {
        return `Invalid selections: ${key}`;
      }
    } else {
      return `Invalid answer value: ${key}`;
    }
  }
  return null;
};

// readableAnswers: [{ question, answers: string[] }] — the questions and
// answers as the parent saw them (their language), for the coaching prompt.
const validateReadableAnswers = (readable) => {
  if (readable === undefined || readable === null) return null;
  if (!Array.isArray(readable) || readable.length > MAX_ANSWERS) return 'Invalid readableAnswers';
  const ok = readable.every(item =>
    item && typeof item.question === 'string' && item.question.length <= MAX_TEXT_LENGTH &&
    Array.isArray(item.answers) && item.answers.length <= MAX_SELECTIONS &&
    item.answers.every(a => typeof a === 'string' && a.length <= MAX_TEXT_LENGTH));
  return ok ? null : 'Invalid readableAnswers';
};

// Generates the survey-based report + plan, with one retry. On success the
// app is told via the same report-ready push as a recording; on failure the
// session is marked FAILED, which the module screen treats as "no report".
async function runSurveyReport(sessionId, userId, moduleKey) {
  for (let attempt = 1; attempt <= SURVEY_REPORT_ATTEMPTS; attempt++) {
    try {
      await generateSurveyModuleSession(sessionId);
      await sendReportReadyNotification(userId, sessionId, 'session', { moduleKey }).catch(() => {});
      return;
    } catch (error) {
      console.error(`❌ [SURVEY-REPORT] Session ${sessionId.substring(0, 8)} attempt ${attempt} failed:`, error.message);
      if (attempt === SURVEY_REPORT_ATTEMPTS) {
        logError(error, { route: 'learn-module-survey#Generate survey report error', userId });
        await prisma.session.update({
          where: { id: sessionId },
          data: { analysisStatus: 'FAILED', analysisError: error.message, analysisFailedAt: new Date() },
        }).catch(() => {});
      }
    }
  }
}

/**
 * POST /api/learn-module-survey
 * Submit a module survey. Body: { moduleKey, variant?, answers, readableAnswers?, language? }
 * variant: 'initial' (default, Day 1) or 'followup' (Day 2+ strategy check-in).
 * Also starts a report + plan generated from the answers (for parents who
 * chose not to record) — returned as sessionId, analyzed in the background.
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.userId;
    const { moduleKey, answers, readableAnswers, language, variant = 'initial' } = req.body;

    if (typeof moduleKey !== 'string' || !MODULE_KEY_RE.test(moduleKey)) {
      return res.status(400).json({ error: 'Invalid moduleKey' });
    }
    const answersError = validateAnswers(answers) || validateReadableAnswers(readableAnswers);
    if (answersError) {
      return res.status(400).json({ error: answersError });
    }
    if (language !== undefined && (typeof language !== 'string' || !LANGUAGE_RE.test(language))) {
      return res.status(400).json({ error: 'Invalid language' });
    }
    if (!SURVEY_VARIANTS.has(variant)) {
      return res.status(400).json({ error: 'Invalid variant' });
    }

    const survey = await prisma.learnModuleSurvey.create({
      data: { userId, moduleKey, variant, answers, readableAnswers: readableAnswers || undefined, language: language || null },
    });

    // Report session for the survey — same shape as a module recording's
    // session (so the module screen, report, plan and calendar all pick it
    // up), minus audio/transcript.
    let sessionId = null;
    if (LEARN_MODULE_KEYS.has(moduleKey)) {
      sessionId = crypto.randomUUID();
      await prisma.session.create({
        data: {
          id: sessionId,
          userId,
          mode: 'CDI',
          moduleKey,
          moduleSurveyId: survey.id,
          storagePath: 'none',
          durationSeconds: 0,
          transcript: '',
          aiFeedbackJSON: {},
          pcitCoding: {},
          tagCounts: {},
          analysisStatus: 'PROCESSING',
        },
      });
      runSurveyReport(sessionId, userId, moduleKey);
    }

    res.status(201).json({
      surveyId: survey.id,
      sessionId,
      submittedAt: survey.submittedAt,
    });
  } catch (error) {
    logError(error, { route: 'learn-module-survey#Submit module survey error', userId: req.userId });
    res.status(500).json({ error: 'Failed to submit survey' });
  }
});

/**
 * GET /api/learn-module-survey/latest?moduleKey=screenTime[&variant=initial]
 * Get the user's most recent submission for a module (survey: null if none).
 */
router.get('/latest', async (req, res) => {
  try {
    const userId = req.userId;
    const { moduleKey, variant } = req.query;

    if (typeof moduleKey !== 'string' || !MODULE_KEY_RE.test(moduleKey)) {
      return res.status(400).json({ error: 'Invalid moduleKey' });
    }
    if (variant !== undefined && !SURVEY_VARIANTS.has(variant)) {
      return res.status(400).json({ error: 'Invalid variant' });
    }

    const survey = await prisma.learnModuleSurvey.findFirst({
      where: { userId, moduleKey, ...(variant ? { variant } : {}) },
      orderBy: { submittedAt: 'desc' },
    });

    res.json({ survey });
  } catch (error) {
    logError(error, { route: 'learn-module-survey#Get latest module survey error', userId: req.userId });
    res.status(500).json({ error: 'Failed to fetch survey' });
  }
});

module.exports = router;
