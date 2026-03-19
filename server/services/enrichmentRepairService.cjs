/**
 * Enrichment Repair Service
 * Re-runs Steps 9-10 (child profiling + competency analysis) for sessions that
 * completed PCIT coding but have enrichmentStatus = PARTIAL or FAILED.
 *
 * Usage: node server/services/enrichmentRepairService.cjs [--limit=N] [--sessionId=ID]
 *
 * Options:
 *   --limit=N        Max sessions to process (default: 50)
 *   --sessionId=ID   Repair a specific session only
 */
'use strict';

require('dotenv').config();
const prisma = require('./db.cjs');
const {
  generateDevelopmentalProfiling,
  generateCdiCoaching,
  generateAboutChild,
  generatePDITwoChoicesAnalysis,
  generateCDIFeedback,
} = require('./pcitAnalysisService.cjs');
const { getUtterances } = require('../utils/utteranceUtils.cjs');
const { decryptSensitiveData } = require('../utils/encryption.cjs');
const { calculateNoraScore } = require('../utils/scoreConstants.cjs');

// ── Parse CLI args ─────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { limit: 50, sessionId: null };
  for (const arg of args) {
    const [key, val] = arg.replace(/^--/, '').split('=');
    if (key === 'limit') opts.limit = parseInt(val, 10);
    if (key === 'sessionId') opts.sessionId = val;
  }
  return opts;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function calculateChildAgeInMonths(birthday, birthYear) {
  const today = new Date();
  if (birthday) {
    const d = new Date(birthday);
    return (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth());
  }
  return birthYear ? (today.getFullYear() - birthYear) * 12 : null;
}

function formatGender(g) {
  return { BOY: 'boy', GIRL: 'girl', OTHER: 'child' }[g] || 'child';
}

function getChildSpeaker(roleIdentificationJson) {
  const s = roleIdentificationJson?.speaker_identification || {};
  for (const [id, info] of Object.entries(s)) {
    if (info.role === 'CHILD') return id;
  }
  return null;
}

// ── Core repair function ───────────────────────────────────────────────────────

async function repairSession(session) {
  const sessionId = session.id;
  const userId = session.userId;

  console.log(`\n▶ Repairing session ${sessionId.substring(0, 8)} (enrichmentStatus=${session.enrichmentStatus})`);

  // Fetch user + child context
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { childName: true, childGender: true, childBirthYear: true, childBirthday: true, childConditions: true }
  });
  if (!user) {
    console.warn(`  ⚠️  User not found for session ${sessionId.substring(0, 8)} — skipping`);
    return false;
  }

  let childName = 'the child';
  try { childName = user.childName ? decryptSensitiveData(user.childName) : 'the child'; } catch (_) {}
  const childAgeMonths = calculateChildAgeInMonths(user.childBirthday, user.childBirthYear);
  const childGender = user.childGender ? formatGender(user.childGender) : 'child';

  const child = await prisma.child.findFirst({ where: { userId } });
  let clinicalPriority = { primaryIssue: null, primaryStrategy: null, secondaryIssue: null, secondaryStrategy: null, issuePriorities: [] };
  if (child) {
    const latestComputedAt = await prisma.childIssuePriority.findFirst({
      where: { childId: child.id }, orderBy: { computedAt: 'desc' }, select: { computedAt: true }
    });
    const issuePriorities = latestComputedAt
      ? await prisma.childIssuePriority.findMany({ where: { childId: child.id, computedAt: latestComputedAt.computedAt }, orderBy: { priorityRank: 'asc' } })
      : [];
    clinicalPriority = { primaryIssue: child.primaryIssue, primaryStrategy: child.primaryStrategy, secondaryIssue: child.secondaryIssue, secondaryStrategy: child.secondaryStrategy, issuePriorities };
  }

  const priorCompletedCount = await prisma.session.count({ where: { userId, analysisStatus: 'COMPLETED' } });
  const utterances = await getUtterances(sessionId);
  const tagCounts = session.tagCounts || {};
  const isCDI = session.mode === 'CDI';
  const childSpeaker = getChildSpeaker(session.roleIdentificationJson);

  const childInfo = {
    name: childName,
    ageMonths: childAgeMonths,
    gender: childGender,
    clinicalPriority,
    isFirstSession: priorCompletedCount === 0,
    durationSeconds: session.durationSeconds || null
  };

  // Step 9 — child profiling (parallel)
  let childProfilingResult = null;
  try {
    const [profilingSettled, coachingSettled, aboutChildSettled] = await Promise.allSettled([
      generateDevelopmentalProfiling(utterances, childInfo, tagCounts, childSpeaker),
      isCDI ? generateCdiCoaching(utterances, childInfo, tagCounts, childSpeaker) : Promise.resolve(null),
      generateAboutChild(utterances, childInfo, tagCounts)
    ]);
    const profilingResult  = profilingSettled.status  === 'fulfilled' ? profilingSettled.value  : null;
    const coachingResult   = coachingSettled.status   === 'fulfilled' ? coachingSettled.value   : null;
    const aboutChildResult = aboutChildSettled.status === 'fulfilled' ? aboutChildSettled.value : null;
    if (profilingSettled.status  === 'rejected') console.warn(`  ⚠️  Profiling rejected: ${profilingSettled.reason?.message}`);
    if (coachingSettled.status   === 'rejected') console.warn(`  ⚠️  Coaching rejected: ${coachingSettled.reason?.message}`);
    if (aboutChildSettled.status === 'rejected') console.warn(`  ⚠️  AboutChild rejected: ${aboutChildSettled.reason?.message}`);
    if (profilingResult || coachingResult) {
      childProfilingResult = {
        developmentalObservation: profilingResult?.developmentalObservation || null,
        metadata: profilingResult?.metadata || null,
        coachingSummary: coachingResult?.coachingSummary || null,
        coachingCards: coachingResult?.coachingCards || null,
        tomorrowGoal: coachingResult?.tomorrowGoal || null,
        aboutChild: aboutChildResult || null
      };
    }
  } catch (err) {
    console.warn(`  ⚠️  Step 9 error: ${err.message}`);
  }

  // Step 10 — competency analysis
  let competencyAnalysis = null;
  try {
    let pdiResult = null;
    if (!isCDI) {
      pdiResult = await generatePDITwoChoicesAnalysis(utterances, childName).catch(e => { console.warn(`  ⚠️  PDI analysis error: ${e.message}`); return null; });
    }
    const feedbackResult = await generateCDIFeedback(tagCounts, utterances, childName, isCDI, pdiResult);
    competencyAnalysis = {
      topMoment: feedbackResult.topMoment,
      topMomentUtteranceNumber: typeof feedbackResult.topMomentUtteranceNumber === 'number' ? feedbackResult.topMomentUtteranceNumber : null,
      feedback: feedbackResult.feedback || null,
      example: typeof feedbackResult.example === 'number' ? feedbackResult.example : null,
      childReaction: feedbackResult.childReaction || null,
      tips: null,
      reminder: feedbackResult.reminder,
      activity: feedbackResult.activity || null,
      analyzedAt: new Date().toISOString(),
      mode: session.mode
    };
    if (pdiResult) {
      competencyAnalysis.pdiSkills = pdiResult.pdiSkills;
      competencyAnalysis.pdiCommandSequences = pdiResult.commandSequences;
      competencyAnalysis.pdiTomorrowGoal = pdiResult.tomorrowGoal;
      competencyAnalysis.pdiEncouragement = pdiResult.encouragement;
      competencyAnalysis.pdiSummary = pdiResult.summary;
    }
  } catch (err) {
    console.warn(`  ⚠️  Step 10 error: ${err.message}`);
  }

  // Evaluate new enrichment status
  const hasFeedback  = competencyAnalysis !== null;
  const hasProfiling = childProfilingResult !== null;
  const newEnrichmentStatus =
    hasFeedback && hasProfiling ? 'COMPLETED' :
    hasFeedback || hasProfiling ? 'PARTIAL'   : 'FAILED';
  const newEnrichmentError =
    newEnrichmentStatus !== 'COMPLETED'
      ? [!hasFeedback && 'competencyAnalysis', !hasProfiling && 'childProfiling'].filter(Boolean).join(', ') + ' failed'
      : null;

  // Write results
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      competencyAnalysis,
      coachingSummary: childProfilingResult?.coachingSummary || null,
      coachingCards: childProfilingResult?.coachingCards
        ? { sections: childProfilingResult.coachingCards, tomorrowGoal: childProfilingResult.tomorrowGoal || null }
        : null,
      aboutChild: childProfilingResult?.aboutChild || null,
      enrichmentStatus: newEnrichmentStatus,
      enrichmentError: newEnrichmentError
    }
  });

  // Upsert ChildProfiling if available
  if (childProfilingResult?.developmentalObservation && child) {
    try {
      await prisma.childProfiling.upsert({
        where: { sessionId },
        create: { userId, sessionId, childId: child.id, summary: childProfilingResult.developmentalObservation.summary || null, domains: childProfilingResult.developmentalObservation.domains || [], metadata: childProfilingResult.metadata || null },
        update: { childId: child.id, summary: childProfilingResult.developmentalObservation.summary || null, domains: childProfilingResult.developmentalObservation.domains || [], metadata: childProfilingResult.metadata || null }
      });
    } catch (err) {
      console.warn(`  ⚠️  ChildProfiling upsert failed: ${err.message}`);
    }
  }

  console.log(`  ✅ Done — enrichmentStatus: ${session.enrichmentStatus} → ${newEnrichmentStatus}`);
  return newEnrichmentStatus === 'COMPLETED';
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { limit, sessionId } = parseArgs();

  console.log('='.repeat(70));
  console.log('🔧 Enrichment Repair Service');
  console.log(`   limit=${limit}${sessionId ? `, sessionId=${sessionId}` : ''}`);
  console.log('='.repeat(70));

  const where = sessionId
    ? { id: sessionId, analysisStatus: 'COMPLETED' }
    : { analysisStatus: 'COMPLETED', enrichmentStatus: { in: ['PARTIAL', 'FAILED'] } };

  const sessions = await prisma.session.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, userId: true, mode: true, enrichmentStatus: true,
      tagCounts: true, roleIdentificationJson: true, pcitCoding: true,
      durationSeconds: true
    }
  });

  if (sessions.length === 0) {
    console.log('\n✅ No sessions need repair.');
    await prisma.$disconnect();
    return;
  }

  console.log(`\nFound ${sessions.length} session(s) to repair.\n`);

  let fixed = 0, partial = 0, failed = 0;
  for (const session of sessions) {
    const ok = await repairSession(session);
    if (ok) fixed++;
    else if (session.enrichmentStatus !== 'COMPLETED') partial++;
    else failed++;
  }

  console.log('\n' + '='.repeat(70));
  console.log(`✅ Repair complete — ${fixed} fixed, ${partial} still partial/failed, ${failed} errors`);
  console.log('='.repeat(70));

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
