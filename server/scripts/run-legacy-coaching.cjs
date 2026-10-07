'use strict';

/**
 * One-off: run generateLegacyCdiCoaching (the restored pre-2026-09-09
 * Coach's Corner pipeline — see server/prompts/cdiCoaching-legacy.txt /
 * cdiCoachingFormat-legacy.txt) for a single existing session against
 * whatever DB DATABASE_URL points at. Prints the resolved result.
 *
 * Read-only by default. Pass --write to persist the result onto the
 * session's existing coachingCards JSON blob (adds/replaces the
 * `legacyCoaching` key; every other key — part1/part2/firstSessionInsights/
 * etc — is left untouched), mirroring exactly what analyzePCITCoding STEP 9
 * writes for a real first session.
 *
 * Usage:
 *   node server/scripts/run-legacy-coaching.cjs <sessionId> [--write]
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs = require('fs');
const path = require('path');
// Repo-local, gitignored scratch dir (see /scratch/ in .gitignore).
const OUT_DIR = path.resolve(__dirname, '../../scratch/legacy-coaching');
fs.mkdirSync(OUT_DIR, { recursive: true });

const prisma = require('../services/db.cjs');
const { generateLegacyCdiCoaching } = require('../services/pcitAnalysisService.cjs');
const { getUtterances } = require('../utils/utteranceUtils.cjs');
const { decryptSensitiveData } = require('../utils/encryption.cjs');

// Same small helpers run-first-session-insights.cjs defines locally rather
// than importing — calculateChildAgeInMonths/formatGender aren't exported
// from pcitAnalysisService.cjs.
function calculateChildAgeInMonths(birthday, birthYear) {
  const today = new Date();
  if (birthday) {
    const birthDate = new Date(birthday);
    return (today.getFullYear() - birthDate.getFullYear()) * 12 + (today.getMonth() - birthDate.getMonth());
  }
  return birthYear ? (today.getFullYear() - birthYear) * 12 : null;
}
const formatGender = (g) => ({ BOY: 'boy', GIRL: 'girl', OTHER: 'child' }[g] || 'child');

const sessionId = process.argv[2];
const DO_WRITE = process.argv.includes('--write');
if (!sessionId) {
  console.error('Usage: node server/scripts/run-legacy-coaching.cjs <sessionId> [--write]');
  process.exit(1);
}

async function main() {
  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { User: true } });
  if (!session) { console.error(`Session ${sessionId} not found`); process.exit(1); }

  const user = session.User;
  const userId = session.userId;
  const childName = user?.childName ? decryptSensitiveData(user.childName) : 'the child';
  const childAgeMonths = calculateChildAgeInMonths(user?.childBirthday, user?.childBirthYear);
  const childGender = user?.childGender ? formatGender(user.childGender) : 'child';

  // Same clinicalPriority shape buildProfilingVariables expects — read from
  // whatever the real pipeline already computed for this child (STEP 1c),
  // rather than recomputing it.
  const child = await prisma.child.findFirst({ where: { userId } });
  let clinicalPriority = { primaryIssue: null, primaryStrategy: null, secondaryIssue: null, secondaryStrategy: null, issuePriorities: [] };
  if (child) {
    const latest = await prisma.childIssuePriority.findFirst({
      where: { childId: child.id },
      orderBy: { computedAt: 'desc' },
      select: { computedAt: true },
    });
    const issuePriorities = latest
      ? await prisma.childIssuePriority.findMany({
          where: { childId: child.id, computedAt: latest.computedAt },
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

  // Chronological first-session check — same definition used in
  // recordings.cjs's buildAnalysisResponse / the real STEP 9 orchestration,
  // not just "no other completed session exists right now".
  const priorCompletedCount = await prisma.session.count({
    where: { userId, analysisStatus: 'COMPLETED', createdAt: { lt: session.createdAt } },
  });
  const isFirstSession = priorCompletedCount === 0;

  const utterances = await getUtterances(sessionId);
  const tagCounts = session.tagCounts || {};
  const primaryLanguage = session.elevenLabsJson?.language_code || null;
  // Seed {{TOMORROW_GOAL}} from whatever the real pipeline already decided
  // for this session (same value the live orchestration passes in) rather
  // than the generic fallback string.
  const fallbackTomorrowGoal = session.coachingCards?.tomorrowGoal || null;

  console.log('='.repeat(70));
  console.log(`Session:           ${sessionId}`);
  console.log(`mode:              ${session.mode}`);
  console.log(`Child:             ${childName}, ${childAgeMonths} months old, ${childGender}`);
  console.log(`Clinical priority: primary=${clinicalPriority.primaryIssue || 'none'}, secondary=${clinicalPriority.secondaryIssue || 'none'}, detail rows=${clinicalPriority.issuePriorities.length}`);
  console.log(`tagCounts:         ${JSON.stringify(tagCounts)}`);
  console.log(`utterances:        ${utterances.length}`);
  console.log(`priorCompleted:    ${priorCompletedCount}  (real isFirstSession=${isFirstSession})`);
  console.log(`primaryLanguage:   ${primaryLanguage || '(none)'}`);
  console.log(`fallbackGoal:      ${fallbackTomorrowGoal || '(none — using generic fallback)'}`);
  console.log(`write:             ${DO_WRITE}`);
  console.log('='.repeat(70));

  const childInfo = {
    name: childName,
    ageMonths: childAgeMonths,
    gender: childGender,
    clinicalPriority,
    isFirstSession,
    durationSeconds: session.durationSeconds || null,
    achievedMilestoneKeys: [],
    historicalCdiSessions: null,
    yesterdayGoal: null,
  };

  const result = await generateLegacyCdiCoaching(utterances, childInfo, tagCounts, null, sessionId, primaryLanguage, fallbackTomorrowGoal);
  if (!result) { console.error('❌ generateLegacyCdiCoaching returned null'); process.exit(1); }

  fs.writeFileSync(path.join(OUT_DIR, `result.${sessionId}.json`), JSON.stringify(result, null, 2));
  console.log('\n=== RESULT ===\n' + JSON.stringify(result, null, 2));

  if (DO_WRITE) {
    // Merge into the existing coachingCards blob rather than clobbering the
    // other keys already written by generateCdiCoaching/generateFirstSessionInsights.
    const existing = session.coachingCards || {};
    const coachingCards = { ...existing, legacyCoaching: result };

    await prisma.session.update({
      where: { id: sessionId },
      data: { coachingCards },
    });
    console.log(`\n✅ WROTE legacyCoaching onto session ${sessionId}'s coachingCards blob`);
  } else {
    console.log('\n(dry run — pass --write to persist to the session)');
  }

  console.log(`\n(written to ${path.relative(process.cwd(), OUT_DIR)}/result.${sessionId}.json)`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
