'use strict';

/**
 * One-off script: run generateAboutChild (steps 1 & 3) for a single session.
 * Usage: DATABASE_URL="..." node server/scripts/run-about-child.cjs <sessionId>
 */

// Allow DATABASE_URL override via env before dotenv loads
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const prisma = require('../services/db.cjs');
const { generateAboutChild } = require('../services/pcitAnalysisService.cjs');
const { getUtterances } = require('../utils/utteranceUtils.cjs');
const { decryptSensitiveData } = require('../utils/encryption.cjs');

const sessionId = process.argv[2];
if (!sessionId) {
  console.error('Usage: DATABASE_URL="..." node server/scripts/run-about-child.cjs <sessionId>');
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

async function main() {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { User: true },
  });

  if (!session) {
    console.error(`Session ${sessionId} not found`);
    process.exit(1);
  }

  const user = session.User;
  const childName = user?.childName ? decryptSensitiveData(user.childName) : 'the child';
  const childAgeMonths = calculateChildAgeInMonths(user?.childBirthday, user?.childBirthYear);
  const childGender = user?.childGender ? formatGender(user.childGender) : 'child';

  console.log(`Session: ${sessionId} | mode: ${session.mode}`);
  console.log(`Child: ${childName}, ${childAgeMonths} months old, ${childGender}`);

  const utterances = await getUtterances(sessionId);
  console.log(`Utterances loaded: ${utterances.length}`);

  const tagCounts = session.tagCounts || {};
  console.log(`Tag counts: praise=${tagCounts.praise || 0}, echo=${tagCounts.echo || 0}, narration=${tagCounts.narration || 0}`);

  const childInfo = { name: childName, ageMonths: childAgeMonths, gender: childGender };

  const result = await generateAboutChild(utterances, childInfo, tagCounts);

  console.log('\n=== ABOUT CHILD RESULT ===');
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
