/**
 * Run generateAboutChild for a single session and save result to session.aboutChild
 */
const prisma = require('../server/services/db.cjs');
const { generateAboutChild } = require('../server/services/pcitAnalysisService.cjs');
const { getUtterances } = require('../server/utils/utteranceUtils.cjs');
const { decryptSensitiveData } = require('../server/utils/encryption.cjs');

const SESSION_ID = process.argv[2] || '9c747ef2-dec1-4f34-8ae9-e356008a3cd8';

function calculateChildAgeInMonths(birthday, birthYear) {
  const today = new Date();
  if (birthday) {
    const birthDate = new Date(birthday);
    return (today.getFullYear() - birthDate.getFullYear()) * 12 + (today.getMonth() - birthDate.getMonth());
  }
  return birthYear ? (today.getFullYear() - birthYear) * 12 : null;
}

function formatGender(g) {
  return { BOY: 'boy', GIRL: 'girl', OTHER: 'child' }[g] || 'child';
}

async function run() {
  console.log('='.repeat(60));
  console.log(`Running generateAboutChild for session ${SESSION_ID}`);
  console.log('='.repeat(60));

  const session = await prisma.session.findUnique({
    where: { id: SESSION_ID },
    include: { User: true }
  });

  if (!session) {
    console.error('❌ Session not found');
    process.exit(1);
  }
  console.log(`✅ Session found — mode: ${session.mode}, status: ${session.analysisStatus}`);

  const user = session.User;
  const childName = user?.childName ? decryptSensitiveData(user.childName) : 'the child';
  const childAgeMonths = calculateChildAgeInMonths(user?.childBirthday, user?.childBirthYear);
  const childGender = formatGender(user?.childGender);
  console.log(`   Child: ${childName}, ${childAgeMonths} months, ${childGender}`);

  const tagCounts = session.tagCounts || {};
  console.log(`   Tag counts: ${JSON.stringify(tagCounts)}`);

  const utterances = await getUtterances(SESSION_ID);
  console.log(`   Utterances: ${utterances.length}`);

  const childInfo = { name: childName, ageMonths: childAgeMonths, gender: childGender };

  const start = Date.now();
  const result = await generateAboutChild(utterances, childInfo, tagCounts);
  console.log(`\n⏱  Completed in ${((Date.now() - start) / 1000).toFixed(1)}s`);

  if (!result) {
    console.error('❌ generateAboutChild returned null');
    process.exit(1);
  }

  console.log(`\n✅ Got ${result.length} observations:`);
  result.forEach((item, i) => {
    console.log(`\n[${i + 1}] ${item.Title}`);
    console.log(`    Description: ${item.Description}`);
    console.log(`    Details: ${item.Details?.substring(0, 100)}...`);
  });

  await prisma.session.update({
    where: { id: SESSION_ID },
    data: { aboutChild: result }
  });
  console.log(`\n💾 Saved to session.aboutChild`);

  await prisma.$disconnect();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
