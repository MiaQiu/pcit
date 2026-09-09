'use strict';

/**
 * One-off: run generateCdiCoaching for a single session against whatever DB
 * DATABASE_URL points at. Prints the resolved prompt vars + the split output.
 *
 * Read-only by default. Pass --write to persist the result onto the session
 * (coachingSummary + the coachingCards JSON blob), mirroring exactly what
 * analyzeRecording / enrichmentRepairService write in step 9.
 *
 * Usage:
 *   node server/scripts/run-cdi-coaching.cjs <sessionId> [--write] [--first]
 *
 *   --write   Persist coachingSummary + coachingCards onto the session row.
 *   --first   Treat as a first session (default: forced non-first).
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs = require('fs');
const path = require('path');
// Repo-local, gitignored scratch dir (see /scratch/ in .gitignore).
const OUT_DIR = path.resolve(__dirname, '../../scratch/cdi-coaching');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Suffix outputs with the coaching model so back-to-back flash/pro runs don't
// clobber each other's result file.
const MODEL_TAG = (process.env.GEMINI_STREAMING_MODEL || 'default').replace(/[^a-z0-9.-]/gi, '_');

// Patch the gateway's llmCall before pcitAnalysisService binds it, so we can dump
// the exact system prompt (cached) + per-call user prompt sent for the coaching call.
const gateway = require('../llm/gateway.cjs');
const origLlmCall = gateway.llmCall;
gateway.llmCall = function (prompt, options = {}) {
  if (options.label === 'coaching-narrative') {
    const sys = options.cache?.systemPrompt || options.systemPrompt || '(none)';
    fs.writeFileSync(path.join(OUT_DIR, `resolved-prompt.${MODEL_TAG}.txt`),
      `=== CACHED SYSTEM PROMPT (cdiCoaching.txt) ===\n${sys}\n\n=== PER-CALL USER PROMPT ===\n${prompt}\n`);
    console.log('\n=== COACHING CALL ===');
    console.log('cache.key      :', JSON.stringify(options.cache?.key));
    console.log('cache.primaryFile:', JSON.stringify(options.cache?.primaryFile));
    console.log('system prompt  :', sys.length, 'chars (cached)');
    console.log('user prompt    :', prompt.length, 'chars');
    console.log('(full → resolved-prompt.' + MODEL_TAG + '.txt)\n');
  }
  return origLlmCall(prompt, options);
};

const prisma = require('../services/db.cjs');
const { generateCdiCoaching } = require('../services/pcitAnalysisService.cjs');
const { getUtterances } = require('../utils/utteranceUtils.cjs');
const { decryptSensitiveData } = require('../utils/encryption.cjs');

const getChildSpeaker = (roleJson) => {
  const si = roleJson?.speaker_identification || {};
  for (const [id, info] of Object.entries(si)) if (info.role === 'CHILD') return id;
  return null;
};

function calculateChildAgeInMonths(birthday, birthYear) {
  const today = new Date();
  if (birthday) {
    const b = new Date(birthday);
    return (today.getFullYear() - b.getFullYear()) * 12 + (today.getMonth() - b.getMonth());
  }
  return birthYear ? (today.getFullYear() - birthYear) * 12 : null;
}
const formatGender = (g) => ({ BOY: 'boy', GIRL: 'girl', OTHER: 'child' }[g] || 'child');

const sessionId = process.argv[2];
const DO_WRITE = process.argv.includes('--write');
const AS_FIRST = process.argv.includes('--first');
if (!sessionId) {
  console.error('Usage: node server/scripts/run-cdi-coaching.cjs <sessionId> [--write] [--first]');
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

  const child = await prisma.child.findFirst({ where: { userId } });
  let clinicalPriority = { primaryIssue: null, primaryStrategy: null, secondaryIssue: null, secondaryStrategy: null, issuePriorities: [] };
  if (child) {
    const latest = await prisma.childIssuePriority.findFirst({ where: { childId: child.id }, orderBy: { computedAt: 'desc' }, select: { computedAt: true } });
    const issuePriorities = latest
      ? await prisma.childIssuePriority.findMany({ where: { childId: child.id, computedAt: latest.computedAt }, orderBy: { priorityRank: 'asc' } })
      : [];
    clinicalPriority = { primaryIssue: child.primaryIssue, primaryStrategy: child.primaryStrategy, secondaryIssue: child.secondaryIssue, secondaryStrategy: child.secondaryStrategy, issuePriorities };
  }

  const utterances = await getUtterances(sessionId);
  const tagCounts = session.tagCounts || {};
  const childSpeaker = getChildSpeaker(session.roleIdentificationJson);

  // Historical CDI sessions — same query enrichmentRepairService uses.
  const priorCdiSessions = await prisma.session.findMany({
    where: { userId, mode: 'CDI', analysisStatus: 'COMPLETED', enrichmentStatus: 'COMPLETED', id: { not: sessionId } },
    orderBy: { createdAt: 'desc' }, take: 5,
    select: { createdAt: true, tagCounts: true, coachingCards: true },
  });
  const historicalCdiSessions = priorCdiSessions.reverse();
  const yesterdayGoal = priorCdiSessions.length > 0 ? (priorCdiSessions[0].coachingCards?.tomorrowGoal || null) : null;

  const parentProgress = await prisma.parentSkillProgress.findUnique({ where: { userId } });
  const priorCompletedCount = await prisma.session.count({ where: { userId, analysisStatus: 'COMPLETED' } });

  console.log('='.repeat(70));
  console.log(`Session:            ${sessionId}`);
  console.log(`mode:              ${session.mode}`);
  console.log(`Child:             ${childName}, ${childAgeMonths} mo, ${childGender}`);
  console.log(`durationSeconds:   ${session.durationSeconds}`);
  console.log(`utterances:        ${utterances.length}`);
  console.log(`tagCounts:         praise=${tagCounts.praise||0} echo=${tagCounts.echo||0} narration=${tagCounts.narration||0} question=${tagCounts.question||0} command=${tagCounts.command||0} criticism=${tagCounts.criticism||0}`);
  console.log(`parentSkillLevel:  ${parentProgress?.currentLevel ?? '(none → 1)'}`);
  console.log(`priorCompleted:    ${priorCompletedCount}  (real isFirstSession=${priorCompletedCount === 0})`);
  console.log(`historical CDI:    ${historicalCdiSessions.length}`);
  console.log(`isFirstSession:    ${AS_FIRST}  (forced)`);
  console.log(`write:             ${DO_WRITE}`);
  console.log('='.repeat(70));

  const childInfo = {
    name: childName,
    ageMonths: childAgeMonths,
    gender: childGender,
    clinicalPriority,
    isFirstSession: AS_FIRST,
    durationSeconds: session.durationSeconds || null,
    historicalCdiSessions,
    yesterdayGoal,
    achievedMilestoneKeys: [],
    childId: child?.id || null,
    userId,
  };

  const primaryLanguage = session.elevenLabsJson?.language_code || null;

  const result = await generateCdiCoaching(utterances, childInfo, tagCounts, childSpeaker, sessionId, primaryLanguage);
  if (!result) { console.error('❌ generateCdiCoaching returned null'); process.exit(1); }

  fs.writeFileSync(path.join(OUT_DIR, `coaching-result.${MODEL_TAG}.json`), JSON.stringify(result, null, 2));

  console.log('\n=== PART 1 (→ Coach\'s Corner) ===\n' + (result.coachingPart1 || '(null)'));
  console.log('\n=== PART 2 (→ Learning Moment card) ===\n' + (result.coachingPart2 ? JSON.stringify(result.coachingPart2, null, 2) : '(null — not shown to parent)'));
  console.log('\n=== tomorrowGoal ===\n' + (result.tomorrowGoal || '(null)'));

  if (DO_WRITE) {
    // Same blob shape as pcitAnalysisService.cjs / enrichmentRepairService.cjs step 9.
    const coachingCards = (result.coachingCards || result.coachingPart1 || result.goalDirective)
      ? {
          sections: result.coachingCards || null,
          part1: result.coachingPart1 || null,
          part2: result.coachingPart2 || null,
          tomorrowGoal: result.tomorrowGoal || null,
          notifications: result.notifications || null,
          goalDirective: result.goalDirective || null,
        }
      : null;

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        coachingSummary: result.coachingSummary || null,
        coachingCards,
      },
    });
    console.log(`\n✅ WROTE coachingSummary (${result.coachingSummary?.length || 0} chars) + coachingCards blob to session ${sessionId}`);
  } else {
    console.log('\n(dry run — pass --write to persist to the session)');
  }

  console.log(`\n(written to ${path.relative(process.cwd(), OUT_DIR)}/: resolved-prompt.${MODEL_TAG}.txt, coaching-result.${MODEL_TAG}.json)`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
