/**
 * Weekly Report Generation Service
 *
 * Three-layer architecture:
 * 1. aggregateWeekData — pure mechanical aggregation
 * 2. generateNarrativeContent — single Claude call for all AI content
 * 3. generateWeeklyReport — orchestrator
 */
const prisma = require('./db.cjs');
const { callClaudeForFeedback } = require('./claudeService.cjs');
const { loadPromptWithVariables } = require('../prompts/index.cjs');
const { decryptSensitiveData } = require('../utils/encryption.cjs');
const { getUtterances } = require('../utils/utteranceUtils.cjs');

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ============================================================================
// Layer 1: Mechanical Aggregation
// ============================================================================

/**
 * Aggregate all session data for a given week. No AI involved.
 */
async function aggregateWeekData(userId, childId, weekStart, weekEnd) {
  // 1. Fetch completed sessions in the date range
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      analysisStatus: 'COMPLETED',
      overallScore: { not: null },
      createdAt: { gte: weekStart, lte: weekEnd },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (sessions.length === 0) {
    return null;
  }

  // 2. Sum tag counts
  let totalPraise = 0, totalEcho = 0, totalNarrate = 0;
  let totalQuestions = 0, totalCommands = 0, totalCriticism = 0;
  let totalDuration = 0;
  let totalScore = 0;
  let scoreCount = 0;

  for (const s of sessions) {
    const tc = s.tagCounts || {};
    totalPraise += (tc.labeled_praise || 0) + (tc.unlabeled_praise || 0);
    totalEcho += tc.echo || 0;
    totalNarrate += tc.narration || 0;
    totalQuestions += tc.question || 0;
    totalCommands += (tc.direct_command || 0) + (tc.indirect_command || 0);
    totalCriticism += tc.criticism || 0;
    totalDuration += s.durationSeconds || 0;
    if (s.overallScore != null) {
      totalScore += s.overallScore;
      scoreCount++;
    }
  }

  const totalDeposits = totalPraise + totalEcho + totalNarrate;
  const massageTimeMinutes = Math.round(totalDuration / 60);
  const avgNoraScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : null;

  // 3. Session count & unique days
  const sessionCount = sessions.length;
  const uniqueDaysSet = new Set();
  for (const s of sessions) {
    const d = new Date(s.createdAt);
    uniqueDaysSet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  const uniqueDays = uniqueDaysSet.size;

  // 4. Build top moments (with audio replay data)
  const topMoments = [];
  for (const s of sessions) {
    const ca = s.competencyAnalysis || {};
    const date = new Date(s.createdAt);
    const dayLabel = DAY_NAMES[date.getDay()];
    const dateLabel = MONTH_NAMES[date.getMonth()] + ' ' + date.getDate();

    let quote = (ca.topMoment) || '';
    quote = quote.replace(/\s+\[(LP|UP|RF|BD|NT|QU|CM|CR|IC|DC|PR|NA|EC|NE)\]/gi, '');

    // Resolve top moment timing from utterances table
    let startTime = null;
    let endTime = null;
    const topMomentIdx = ca.topMomentUtteranceNumber;
    if (typeof topMomentIdx === 'number') {
      const utterances = await getUtterances(s.id);
      if (utterances[topMomentIdx]) {
        startTime = utterances[topMomentIdx].startTime || null;
        endTime = utterances[topMomentIdx].endTime || null;
      }
    }

    // Store storagePath (not presigned URL) — URLs are generated at read time
    const storagePath = (s.storagePath && !s.storagePath.startsWith('mock')) ? s.storagePath : null;

    topMoments.push({
      date: dayLabel + '  ' + dateLabel,
      dayLabel,
      dateLabel,
      sessionTitle: ca.activity || '',
      quote,
      storagePath,
      audioUrl: null,
      startTime,
      endTime,
    });
  }

  // 5. Build milestones (deduplicated)
  const milestones = [];
  const seenTitles = new Set();

  for (const s of sessions) {
    if (s.milestoneCelebrations) {
      const mc = Array.isArray(s.milestoneCelebrations) ? s.milestoneCelebrations : [];
      for (const m of mc) {
        if (m.title && !seenTitles.has(m.title)) {
          seenTitles.add(m.title);
          milestones.push(m);
        }
      }
    }
  }

  if (childId) {
    const childMilestones = await prisma.childMilestone.findMany({
      where: { childId },
      include: { MilestoneLibrary: true },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });
    for (const cm of childMilestones) {
      const title = cm.MilestoneLibrary.displayTitle;
      if (!seenTitles.has(title)) {
        seenTitles.add(title);
        milestones.push({
          status: cm.status,
          category: cm.MilestoneLibrary.category,
          title,
          actionTip: cm.MilestoneLibrary.actionTip,
        });
      }
    }
  }

  // 6. Collect coaching cards/sections from all sessions
  const allCoachingCards = [];
  for (const s of sessions) {
    if (s.coachingCards) {
      // New format: { sections: [...], tomorrowGoal: "..." }, legacy: array of cards
      const cards = Array.isArray(s.coachingCards)
        ? s.coachingCards
        : (Array.isArray(s.coachingCards.sections) ? s.coachingCards.sections : []);
      for (const card of cards) {
        allCoachingCards.push(card);
      }
    }
  }

  // 7. Collect child reactions
  const childReactions = [];
  for (const s of sessions) {
    const ca = s.competencyAnalysis || {};
    if (ca.childReaction) {
      childReactions.push(ca.childReaction);
    }
  }

  // 7b. Collect child profiling observations for the week's sessions
  const childProfilingObservations = [];
  if (childId) {
    const profilings = await prisma.childProfiling.findMany({
      where: { sessionId: { in: sessions.map(s => s.id) } },
      orderBy: { createdAt: 'desc' },
    });
    for (const p of profilings) {
      const domains = Array.isArray(p.domains) ? p.domains : [];
      for (const domain of domains) {
        const obs = Array.isArray(domain.detailed_observations) ? domain.detailed_observations : [];
        for (const o of obs) {
          if (o.insight && o.evidence) {
            childProfilingObservations.push({
              category: domain.category || 'Unknown',
              insight: o.insight,
              evidence: o.evidence,
            });
          }
        }
      }
    }
  }

  // 7c. Compute personal bests by comparing against historical sessions
  const bestSessionScore = sessions.reduce((max, s) => Math.max(max, s.overallScore || 0), 0);
  let isPersonalBestScore = false;
  if (bestSessionScore > 0) {
    const historicalBest = await prisma.session.findFirst({
      where: {
        userId,
        analysisStatus: 'COMPLETED',
        overallScore: { not: null },
        createdAt: { lt: weekStart },
      },
      orderBy: { overallScore: 'desc' },
      select: { overallScore: true },
    });
    isPersonalBestScore = !historicalBest || bestSessionScore > (historicalBest.overallScore || 0);
  }

  // 7d. Fetch earliest child profiling for "since you started" comparison
  let earliestProfiling = null;
  if (childId) {
    earliestProfiling = await prisma.childProfiling.findFirst({
      where: { childId },
      orderBy: { createdAt: 'asc' },
      select: { summary: true, domains: true, createdAt: true },
    });
  }

  // 8. Previous week's report for trend comparison
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const previousReport = await prisma.weeklyReport.findUnique({
    where: {
      userId_weekStartDate: { userId, weekStartDate: prevWeekStart },
    },
  });

  // 9. Compute trend
  let depositsTrend = null;
  let depositsChangePercent = null;
  if (previousReport && previousReport.totalDeposits > 0) {
    const change = totalDeposits - previousReport.totalDeposits;
    depositsChangePercent = Math.round((change / previousReport.totalDeposits) * 100);
    if (depositsChangePercent > 10) {
      depositsTrend = 'up';
    } else if (depositsChangePercent < -10) {
      depositsTrend = 'down';
    } else {
      depositsTrend = 'stable';
    }
  }

  return {
    sessions,
    sessionIds: sessions.map(s => s.id),
    totalDeposits,
    praiseCount: totalPraise,
    echoCount: totalEcho,
    narrateCount: totalNarrate,
    questionCount: totalQuestions,
    commandCount: totalCommands,
    criticismCount: totalCriticism,
    massageTimeMinutes,
    avgNoraScore,
    sessionCount,
    uniqueDays,
    topMoments,
    milestones,
    allCoachingCards,
    childReactions,
    depositsTrend,
    depositsChangePercent,
    previousReport,
    childProfilingObservations,
    bestSessionScore,
    isPersonalBestScore,
    earliestProfiling,
  };
}

// ============================================================================
// Layer 2: AI Narrative Generation
// ============================================================================

/**
 * Single Claude call to generate all personalized narrative content.
 */
async function generateNarrativeContent(aggregatedData, childInfo) {
  const {
    totalDeposits, praiseCount, echoCount, narrateCount,
    questionCount, commandCount, sessionCount, uniqueDays,
    avgNoraScore, massageTimeMinutes, topMoments, childReactions,
    allCoachingCards, depositsTrend, depositsChangePercent, previousReport,
    childProfilingObservations, bestSessionScore, isPersonalBestScore, earliestProfiling,
  } = aggregatedData;

  // Format previous week data
  let previousWeekData = 'No previous week data available.';
  if (previousReport) {
    previousWeekData = [
      `Previous total deposits: ${previousReport.totalDeposits}`,
      `Previous praise: ${previousReport.praiseCount}, echo: ${previousReport.echoCount}, narrate: ${previousReport.narrateCount}`,
      `Trend: ${depositsTrend || 'unknown'} (${depositsChangePercent != null ? depositsChangePercent + '%' : 'N/A'})`,
    ].join('\n');
  }

  // Format top moments
  const topMomentsText = topMoments.length > 0
    ? topMoments.map(m => `- [${m.tag}] "${m.quote}"`).join('\n')
    : 'No top moments recorded.';

  // Format child reactions
  const childReactionsText = childReactions.length > 0
    ? childReactions.map(r => `- ${r}`).join('\n')
    : 'No child reactions recorded.';

  // Format coaching cards
  const coachingCardsText = allCoachingCards.length > 0
    ? JSON.stringify(allCoachingCards.slice(0, 6), null, 2)
    : 'No coaching cards available.';

  // Format child profiling observations
  const profilingText = childProfilingObservations && childProfilingObservations.length > 0
    ? childProfilingObservations.map(o => `- [${o.category}] ${o.insight}: "${o.evidence}"`).join('\n')
    : 'No profiling observations available.';

  // Format earliest profiling for comparison
  let earliestProfilingText = 'No earlier profiling available for comparison.';
  if (earliestProfiling && earliestProfiling.summary) {
    earliestProfilingText = `First session summary: "${earliestProfiling.summary}" (${new Date(earliestProfiling.createdAt).toLocaleDateString()})`;
  }

  const prompt = loadPromptWithVariables('weeklyReportNarrative', {
    CHILD_NAME: childInfo.name,
    CHILD_AGE: childInfo.age || 'unknown',
    CHILD_GENDER: childInfo.gender || 'child',
    CLINICAL_FOCUS: childInfo.clinicalFocus || 'general positive parenting',
    TOTAL_DEPOSITS: String(totalDeposits),
    PRAISE_COUNT: String(praiseCount),
    ECHO_COUNT: String(echoCount),
    NARRATE_COUNT: String(narrateCount),
    QUESTION_COUNT: String(questionCount),
    COMMAND_COUNT: String(commandCount),
    SESSION_COUNT: String(sessionCount),
    UNIQUE_DAYS: String(uniqueDays),
    AVG_NORA_SCORE: String(avgNoraScore || 'N/A'),
    MASSAGE_TIME_MINUTES: String(massageTimeMinutes),
    BEST_SESSION_SCORE: String(bestSessionScore || 'N/A'),
    IS_PERSONAL_BEST: String(isPersonalBestScore),
    PREVIOUS_WEEK_DATA: previousWeekData,
    TOP_MOMENTS: topMomentsText,
    CHILD_REACTIONS: childReactionsText,
    CHILD_PROFILING_OBSERVATIONS: profilingText,
    EARLIEST_PROFILING: earliestProfilingText,
    COACHING_CARDS: coachingCardsText,
  });

  const result = await callClaudeForFeedback(prompt, {
    temperature: 0.7,
    maxTokens: 2000,
  });

  return result;
}

// ============================================================================
// Layer 3: Orchestrator
// ============================================================================

/**
 * Generate a complete weekly report for a user.
 *
 * @param {string} userId
 * @param {string} [weekStartDate] - ISO date string for Monday. Defaults to most recent Monday.
 * @returns {Object} The created/updated WeeklyReport
 */
async function generateWeeklyReport(userId, weekStartDate) {
  console.log(`📊 [WEEKLY-REPORT] Starting generation for user ${userId}`);

  // 1. Resolve child
  const child = await prisma.child.findFirst({ where: { userId } });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      childName: true,
      childGender: true,
      childBirthYear: true,
      childBirthday: true,
      issue: true,
      childConditions: true,
    },
  });

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  // Resolve child name — prefer Child.name (full name) over User.childName (may be initial)
  const decryptedUserChildName = user.childName ? decryptSensitiveData(user.childName) : null;
  const childName = child?.name || decryptedUserChildName || 'the child';
  const childGender = user.childGender === 'BOY' ? 'boy' : user.childGender === 'GIRL' ? 'girl' : 'child';

  let childAge = 'unknown';
  if (user.childBirthday) {
    const birth = new Date(user.childBirthday);
    const now = new Date();
    const ageYears = Math.floor((now - birth) / (365.25 * 24 * 60 * 60 * 1000));
    childAge = `${ageYears} years old`;
  } else if (user.childBirthYear) {
    const ageYears = new Date().getFullYear() - user.childBirthYear;
    childAge = `${ageYears} years old`;
  }

  // Clinical focus from child record or user issue
  let clinicalFocus = 'general positive parenting';
  if (child && child.primaryIssue) {
    clinicalFocus = `${child.primaryIssue}${child.primaryStrategy ? ' / ' + child.primaryStrategy : ''}`;
  } else if (user.issue) {
    clinicalFocus = user.issue;
  }

  // 2. Compute week boundaries (Monday 00:00 → Sunday 23:59 UTC)
  let weekStart;
  if (weekStartDate) {
    weekStart = new Date(weekStartDate);
    weekStart.setUTCHours(0, 0, 0, 0);
  } else {
    // Default to the most recent Monday
    weekStart = new Date();
    const day = weekStart.getUTCDay();
    const diff = day === 0 ? 6 : day - 1; // Monday = 0 offset
    weekStart.setUTCDate(weekStart.getUTCDate() - diff);
    weekStart.setUTCHours(0, 0, 0, 0);
  }
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  console.log(`📊 [WEEKLY-REPORT] Week: ${weekStart.toISOString()} → ${weekEnd.toISOString()}`);

  // 3. Aggregate data
  const aggregated = await aggregateWeekData(userId, child?.id, weekStart, weekEnd);

  if (!aggregated) {
    console.log(`📊 [WEEKLY-REPORT] No completed sessions found, skipping`);
    return { skipped: true, reason: 'no_sessions' };
  }

  console.log(`📊 [WEEKLY-REPORT] Aggregated: ${aggregated.sessionCount} sessions, ${aggregated.totalDeposits} deposits`);

  // 4. Generate AI narrative
  let narrative = null;
  try {
    narrative = await generateNarrativeContent(aggregated, {
      name: childName,
      age: childAge,
      gender: childGender,
      clinicalFocus,
    });
    console.log(`📊 [WEEKLY-REPORT] AI narrative generated successfully`);
  } catch (err) {
    console.error(`📊 [WEEKLY-REPORT] AI narrative generation failed, saving mechanical data only:`, err.message);
  }

  // 5. Build growth metrics (data-driven micro-wins for page 3)
  const growthMetrics = [];
  if (aggregated.depositsTrend === 'up' && aggregated.depositsChangePercent > 0) {
    growthMetrics.push({
      icon: 'trending-up',
      value: `+${aggregated.depositsChangePercent}%`,
      label: `${narrative?.strongestGrowthArea || 'Deposits'} growth`,
    });
  }
  if (aggregated.uniqueDays > 0) {
    growthMetrics.push({
      icon: 'calendar',
      value: `${aggregated.uniqueDays} of 7`,
      label: 'Days practiced',
    });
  }
  if (aggregated.isPersonalBestScore && aggregated.bestSessionScore > 0) {
    growthMetrics.push({
      icon: 'trophy',
      value: String(aggregated.bestSessionScore),
      label: 'Personal best',
    });
  } else if (aggregated.avgNoraScore) {
    growthMetrics.push({
      icon: 'star',
      value: String(aggregated.avgNoraScore),
      label: 'Avg Nora score',
    });
  }

  // 6. Upsert report
  const reportData = {
    userId,
    childId: child?.id || null,
    weekStartDate: weekStart,
    weekEndDate: weekEnd,
    visibility: false,

    // Mechanical data
    totalDeposits: aggregated.totalDeposits,
    massageTimeMinutes: aggregated.massageTimeMinutes,
    praiseCount: aggregated.praiseCount,
    echoCount: aggregated.echoCount,
    narrateCount: aggregated.narrateCount,
    topMoments: aggregated.topMoments,
    milestones: aggregated.milestones,
    sessionIds: aggregated.sessionIds,
    sessionCount: aggregated.sessionCount,
    uniqueDays: aggregated.uniqueDays,
    avgNoraScore: aggregated.avgNoraScore,
    depositsTrend: aggregated.depositsTrend,
    depositsChangePercent: aggregated.depositsChangePercent,

    // AI-generated content (null if AI failed)
    headline: narrative?.headline || null,
    // Page 3: parent celebration
    parentGrowthNarrative: narrative?.parentGrowthNarrative || null,
    growthMetrics: growthMetrics.length > 0 ? growthMetrics : null,
    noraObservation: narrative?.noraObservation || null,
    // Page 5: child celebration
    childSpotlight: narrative?.childSpotlight || null,
    growthSnapshots: narrative?.growthSnapshots || null,
    childProgressNote: narrative?.childProgressNote || null,
    // Legacy fields (kept for backward compat)
    skillCelebrationTitle: narrative?.parentGrowthNarrative || null,
    scenarioCards: null,
    focusHeading: narrative?.focusHeading || null,
    focusSubtext: narrative?.focusSubtext || null,
    whyExplanation: narrative?.whyExplanation || null,
    trendMessage: narrative?.trendMessage || null,
    strongestGrowthArea: narrative?.strongestGrowthArea || null,
    childResponseSummary: narrative?.childResponseSummary || null,
    consistencyMessage: narrative?.consistencyMessage || null,

    // Metadata
    generatedAt: new Date(),
    generationVersion: 1,
  };

  const report = await prisma.weeklyReport.upsert({
    where: {
      userId_weekStartDate: { userId, weekStartDate: weekStart },
    },
    create: reportData,
    update: reportData,
  });

  console.log(`📊 [WEEKLY-REPORT] Report saved: ${report.id}`);
  return report;
}

/**
 * Resolve presigned audio URLs for a report's topMoments at read time.
 * Storage paths are stored at generation time; presigned URLs are ephemeral.
 */
async function resolveReportAudioUrls(report) {
  if (!report || !report.topMoments || !Array.isArray(report.topMoments)) {
    return report;
  }

  const storage = require('./storage-s3.cjs');
  const resolvedMoments = await Promise.all(
    report.topMoments.map(async (moment) => {
      if (moment.storagePath && !moment.audioUrl) {
        try {
          const audioUrl = await storage.getSignedUrl(moment.storagePath);
          return { ...moment, audioUrl };
        } catch (err) {
          console.warn('Failed to generate audio URL for moment:', err.message);
        }
      }
      return moment;
    })
  );

  return { ...report, topMoments: resolvedMoments };
}

module.exports = {
  aggregateWeekData,
  generateNarrativeContent,
  generateWeeklyReport,
  resolveReportAudioUrls,
};
