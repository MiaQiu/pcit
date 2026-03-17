/**
 * Re-run CDI coaching for a specific session using the current pipeline,
 * then write coachingCards and coachingSummary back to the session record.
 *
 * Usage:
 *   DATABASE_URL="postgresql://nora_admin:<pwd>@localhost:5433/nora" \
 *   GEMINI_STREAMING_MODEL=gemini-3.1-pro-preview \
 *   node scripts/rerun-cdi-coaching.cjs <sessionId>
 */
require('dotenv').config();

const prisma = require('../server/services/db.cjs');
const { getUtterances } = require('../server/utils/utteranceUtils.cjs');
const { generateCdiCoaching } = require('../server/services/pcitAnalysisService.cjs');
const { decryptSensitiveData } = require('../server/utils/encryption.cjs');

const SESSION_ID = process.argv[2];
if (!SESSION_ID) {
  console.error('Usage: node scripts/rerun-cdi-coaching.cjs <sessionId>');
  process.exit(1);
}

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

async function main() {
  console.log(`Re-running CDI coaching for session: ${SESSION_ID}`);
  console.log(`GEMINI_STREAMING_MODEL: ${process.env.GEMINI_STREAMING_MODEL || 'gemini-3.1-pro-preview (default)'}\n`);

  const session = await prisma.session.findUnique({ where: { id: SESSION_ID } });
  if (!session) throw new Error(`Session ${SESSION_ID} not found`);
  if (session.mode !== 'CDI') throw new Error(`Session mode is ${session.mode}, expected CDI`);
  console.log(`Session: mode=${session.mode}, status=${session.analysisStatus}`);

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  const childName = user?.childName ? decryptSensitiveData(user.childName) : 'the child';
  const childAgeMonths = calculateChildAgeInMonths(user?.childBirthday, user?.childBirthYear);
  const childGender = user?.childGender ? formatGender(user.childGender) : 'child';
  console.log(`Child: ${childName}, ${childAgeMonths} months, ${childGender}`);

  // Fetch clinical priority (mirrors pipeline)
  const child = await prisma.child.findFirst({ where: { userId: session.userId } });
  let clinicalPriority = {};
  if (child) {
    const latestComputedAt = await prisma.childIssuePriority.findFirst({
      where: { childId: child.id },
      orderBy: { computedAt: 'desc' },
      select: { computedAt: true }
    });
    const issuePriorities = latestComputedAt
      ? await prisma.childIssuePriority.findMany({
          where: { childId: child.id, computedAt: latestComputedAt.computedAt },
          orderBy: { priorityRank: 'asc' }
        })
      : [];
    clinicalPriority = {
      primaryIssue: child.primaryIssue,
      primaryStrategy: child.primaryStrategy,
      secondaryIssue: child.secondaryIssue,
      secondaryStrategy: child.secondaryStrategy,
      issuePriorities
    };
  }

  // Compute isFirstSession (mirrors pipeline)
  const priorCompletedCount = await prisma.session.count({
    where: { userId: session.userId, analysisStatus: 'COMPLETED' }
  });
  const isFirstSession = priorCompletedCount === 0;
  console.log(`Prior completed sessions: ${priorCompletedCount}, isFirstSession: ${isFirstSession}`);

  const childSpeaker = getChildSpeaker(session.roleIdentificationJson || {});
  const utterances = await getUtterances(SESSION_ID);
  const tagCounts = session.tagCounts || {};
  console.log(`Utterances: ${utterances.length}, childSpeaker: ${childSpeaker}`);
  console.log(`tagCounts:`, JSON.stringify(tagCounts, null, 2), '\n');

  const childInfo = {
    name: childName,
    ageMonths: childAgeMonths,
    gender: childGender,
    clinicalPriority,
    isFirstSession,
    durationSeconds: session.durationSeconds || null
  };

  console.log('--- Running generateCdiCoaching ---\n');
  const result = await generateCdiCoaching(utterances, childInfo, tagCounts, childSpeaker);

  if (!result) {
    console.error('\nCDI coaching returned null');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('\n' + '='.repeat(80));
  console.log('CDI COACHING RESULT');
  console.log('='.repeat(80));
  console.log('\n--- coachingSummary ---\n');
  console.log(result.coachingSummary);
  console.log('\n--- coachingCards ---\n');
  console.log(JSON.stringify(result.coachingCards, null, 2));
  console.log('\n--- tomorrowGoal ---\n');
  console.log(result.tomorrowGoal);
  console.log('\n' + '='.repeat(80));

  // Write back to session
  const coachingCards = result.coachingCards
    ? { sections: result.coachingCards, tomorrowGoal: result.tomorrowGoal || null }
    : null;

  await prisma.session.update({
    where: { id: SESSION_ID },
    data: {
      coachingSummary: result.coachingSummary || null,
      coachingCards
    }
  });
  console.log(`\nSession updated — coachingCards (${result.coachingCards?.length || 0} sections) and coachingSummary written to DB.`);

  await prisma.$disconnect();
}

main().catch(async err => {
  console.error('Fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
