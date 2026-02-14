/**
 * Quick script to re-run CDI coaching for a specific session.
 * Usage: node scripts/run-cdi-coaching.cjs <sessionId>
 */
require('dotenv').config();
const prisma = require('../server/services/db.cjs');
const { getUtterances } = require('../server/utils/utteranceUtils.cjs');
const { generateCdiCoaching } = require('../server/services/pcitAnalysisService.cjs');
const { decryptSensitiveData } = require('../server/utils/encryption.cjs');

const SESSION_ID = process.argv[2] || '807db5e6-74ad-423c-ba20-b3ead3b58aac';

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

async function main() {
  console.log(`Running CDI coaching for session: ${SESSION_ID}\n`);

  // Fetch session
  const session = await prisma.session.findUnique({ where: { id: SESSION_ID } });
  if (!session) throw new Error(`Session ${SESSION_ID} not found`);
  console.log(`Session found: mode=${session.mode}, status=${session.analysisStatus}`);

  // Fetch user info
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  const childName = user?.childName ? decryptSensitiveData(user.childName) : 'the child';
  const childAgeMonths = user?.childBirthYear ? calculateChildAgeInMonths(user.childBirthday, user.childBirthYear) : null;
  const childGender = user?.childGender ? formatGender(user.childGender) : 'child';
  console.log(`Child: ${childName}, ${childAgeMonths} months, ${childGender}`);

  // Fetch child + clinical priority
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
  const primaryRow = (clinicalPriority.issuePriorities || []).find(r => r.priorityRank === 1);
  const issueLabel = primaryRow?.fromUserIssue && primaryRow.userIssues
    ? JSON.parse(primaryRow.userIssues).join(', ')
    : clinicalPriority.primaryIssue || 'none';
  console.log(`Clinical priority: ${issueLabel} (level: ${clinicalPriority.primaryIssue || 'none'})\n`);

  // Fetch utterances + tagCounts
  const utterances = await getUtterances(SESSION_ID);
  const tagCounts = session.tagCounts || {};
  console.log(`Utterances: ${utterances.length}, tagCounts:`, JSON.stringify(tagCounts, null, 2), '\n');

  // Run CDI coaching
  console.log('--- Running generateCdiCoaching ---\n');
  const result = await generateCdiCoaching(
    utterances,
    { name: childName, ageMonths: childAgeMonths, gender: childGender, clinicalPriority },
    tagCounts,
    null
  );

  if (!result) {
    console.log('\n❌ Coaching returned null');
    process.exit(1);
  }

  console.log('\n--- RESULT ---');
  console.log('\n📝 coachingSummary (raw Gemini report):');
  console.log(result.coachingSummary);
  console.log('\n📋 coachingCards (3 formatted sections):');
  console.log(JSON.stringify(result.coachingCards, null, 2));
  console.log('\n🎯 tomorrowGoal:', result.tomorrowGoal);

  // Save to DB
  console.log('\n💾 Saving to session...');
  await prisma.session.update({
    where: { id: SESSION_ID },
    data: {
      coachingSummary: result.coachingSummary,
      coachingCards: result.coachingCards
        ? { sections: result.coachingCards, tomorrowGoal: result.tomorrowGoal || null }
        : null
    }
  });
  console.log('✅ Saved! Check the app.');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal:', err);
  prisma.$disconnect();
  process.exit(1);
});
