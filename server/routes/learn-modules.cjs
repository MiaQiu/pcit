// Learn module routes (e.g. Screen Time Management)
const express = require('express');
const { Prisma } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth.cjs');
const prisma = require('../services/db.cjs');
const { logError } = require('../utils/errorLogger.cjs');
const { LEARN_MODULE_KEYS } = require('../services/pcitAnalysisService.cjs');
const { reportedDifferences } = require('../utils/screenTimeIntake.cjs');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/learn-modules/:moduleKey/plan
 * The parent's current "My plan" — myPlan from their most recent analyzed
 * recording in this module (session.moduleCoaching). plan is null until the
 * first module recording has been analyzed. masteredStrategies lists the
 * strategies a Day 2+ report judged mastered, first mastery only, in order.
 * suggestedStrategies are the latest report's "Next Growth Focus" strategies
 * ({ name, description }) — the module chat's suggested ideas.
 */
router.get('/:moduleKey/plan', async (req, res) => {
  try {
    const userId = req.userId;
    const { moduleKey } = req.params;

    if (!LEARN_MODULE_KEYS.has(moduleKey)) {
      return res.status(404).json({ error: 'Unknown module' });
    }

    const sessions = await prisma.session.findMany({
      where: {
        userId,
        moduleKey,
        analysisStatus: 'COMPLETED',
        moduleCoaching: { not: Prisma.DbNull },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true, moduleCoaching: true },
    });
    const session = sessions[sessions.length - 1];

    // Same identity rule as getModuleProgressState: Knowledge Base number
    // when present, else the title.
    const masteredStrategies = [];
    const seen = new Set();
    sessions.forEach((s, i) => {
      const progress = s.moduleCoaching?.progress;
      if (!progress?.strategyMastered || !progress.practicedStrategy) return;
      const key = progress.practicedStrategyId || progress.practicedStrategy.trim().toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      masteredStrategies.push({
        strategy: progress.practicedStrategy,
        strategyId: progress.practicedStrategyId || null,
        dayNumber: i + 1,
        reportId: s.id,
      });
    });

    res.json({
      plan: session?.moduleCoaching?.myPlan || null,
      recordingId: session?.id || null,
      createdAt: session?.createdAt || null,
      masteredStrategies,
      suggestedStrategies: session?.moduleCoaching?.suggestedStrategies
        || session?.moduleCoaching?.coachingReport?.nextGrowthFocus?.strategies || [],
    });
  } catch (error) {
    logError(error, { route: 'learn-modules#Get module plan error', userId: req.userId });
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
});

// A module upload whose init ran but whose audio never arrived stays PENDING
// with this storagePath forever — don't let it show as "processing" for good.
const STALE_PENDING_UPLOAD_MS = 60 * 60 * 1000;
// Unsubscribed parents get this many analyzed play recordings from the module.
const FREE_PLAY_RECORDINGS = 3;

/**
 * GET /api/learn-modules/:moduleKey/latest-session
 * State of the parent's most recent recording in this module, for the module
 * screen's practice card: status is 'processing' (uploaded, being analyzed),
 * 'ready' (report available) or null (nothing in flight / no report yet —
 * failed and abandoned uploads are skipped). activeStrategy is the strategy
 * from the newest plan, or null before the first report; dayNumber is the
 * day the parent is on (analyzed reports + 1).
 *
 * Also for the following-day "Play time recording" card: hasDifferences (the parent
 * reported a learning and thinking difference in onboarding) and playSession,
 * the same status for their latest regular (non-module) play recording.
 * playLimitReached: an unsubscribed parent has used their
 * FREE_PLAY_RECORDINGS analyzed play recordings.
 */
router.get('/:moduleKey/latest-session', async (req, res) => {
  try {
    const userId = req.userId;
    const { moduleKey } = req.params;

    if (!LEARN_MODULE_KEYS.has(moduleKey)) {
      return res.status(404).json({ error: 'Unknown module' });
    }

    const sessions = await prisma.session.findMany({
      where: { userId, moduleKey, analysisStatus: { not: 'FAILED' } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, createdAt: true, analysisStatus: true, storagePath: true, moduleCoaching: true, moduleSurveyId: true },
    });

    const now = Date.now();
    const isLive = s => !(s.storagePath === 'pending_upload' && now - s.createdAt.getTime() > STALE_PENDING_UPLOAD_MS);
    const latest = sessions.find(isLive);

    const [user, playSessions, completedPlays] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { screenTimeIntake: true, isFreeAccount: true, subscriptionStatus: true, subscriptionEndDate: true },
      }),
      prisma.session.findMany({
        where: { userId, moduleKey: null, analysisStatus: { not: 'FAILED' } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, createdAt: true, analysisStatus: true, storagePath: true },
      }),
      prisma.session.count({ where: { userId, moduleKey: null, analysisStatus: 'COMPLETED' } }),
    ]);
    const hasDifferences = reportedDifferences(user?.screenTimeIntake).length > 0;
    // Same rule as GET /api/auth/me's isSubscribed.
    const isSubscribed = !!user && (user.isFreeAccount
      || (['ACTIVE', 'TRIAL', 'CANCELLED', 'PAST_DUE'].includes(user.subscriptionStatus)
          && !!user.subscriptionEndDate && user.subscriptionEndDate > new Date()));
    const playLimitReached = !isSubscribed && completedPlays >= FREE_PLAY_RECORDINGS;
    const latestPlay = playSessions.find(isLive);
    const playSession = latestPlay
      ? { id: latestPlay.id, createdAt: latestPlay.createdAt, status: latestPlay.analysisStatus === 'COMPLETED' ? 'ready' : 'processing' }
      : null;

    // Strategy the parent is practicing now (from the newest plan) — the app
    // asks how it went when the next recording stops.
    const activeStrategy = sessions.find(s => s.moduleCoaching?.myPlan?.activeStrategy)?.moduleCoaching.myPlan.activeStrategy || null;

    // The day the parent is on: each analyzed report completes a day (same
    // count as getModuleProgressState's dayNumber for the next report).
    const completedReports = await prisma.session.count({
      where: { userId, moduleKey, analysisStatus: 'COMPLETED', moduleCoaching: { not: Prisma.DbNull } },
    });
    const dayNumber = completedReports + 1;

    if (!latest) return res.json({ session: null, activeStrategy, dayNumber, hasDifferences, playSession, playLimitReached });

    const ready = latest.analysisStatus === 'COMPLETED' && !!latest.moduleCoaching;
    // COMPLETED without coaching shouldn't happen; treat it like no report.
    const status = ready ? 'ready' : latest.analysisStatus === 'COMPLETED' ? null : 'processing';

    res.json({
      session: status ? { id: latest.id, createdAt: latest.createdAt, status, fromSurvey: !!latest.moduleSurveyId } : null,
      activeStrategy,
      dayNumber,
      hasDifferences,
      playSession,
      playLimitReached,
    });
  } catch (error) {
    logError(error, { route: 'learn-modules#Get latest module session error', userId: req.userId });
    res.status(500).json({ error: 'Failed to fetch latest session' });
  }
});

/**
 * GET /api/learn-modules/:moduleKey/days
 * The parent's analyzed reports in this module, one per day (report N is
 * day N, same counting as getModuleProgressState), with the plan each one
 * produced — so the app can show a past day's protocol (from the previous
 * day's plan) and open that day's report.
 */
router.get('/:moduleKey/days', async (req, res) => {
  try {
    const userId = req.userId;
    const { moduleKey } = req.params;

    if (!LEARN_MODULE_KEYS.has(moduleKey)) {
      return res.status(404).json({ error: 'Unknown module' });
    }

    const sessions = await prisma.session.findMany({
      where: { userId, moduleKey, analysisStatus: 'COMPLETED', moduleCoaching: { not: Prisma.DbNull } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true, moduleSurveyId: true, moduleCoaching: true },
    });

    res.json({
      days: sessions.map((s, i) => ({
        dayNumber: i + 1,
        reportId: s.id,
        createdAt: s.createdAt,
        fromSurvey: !!s.moduleSurveyId,
        plan: s.moduleCoaching?.myPlan
          ? {
              activeStrategy: s.moduleCoaching.myPlan.activeStrategy,
              activeStrategyId: s.moduleCoaching.myPlan.activeStrategyId ?? null,
              protocolSteps: s.moduleCoaching.myPlan.protocolSteps || [],
            }
          : null,
      })),
    });
  } catch (error) {
    logError(error, { route: 'learn-modules#Get module days error', userId: req.userId });
    res.status(500).json({ error: 'Failed to fetch days' });
  }
});

module.exports = router;
