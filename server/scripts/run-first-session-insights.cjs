'use strict';

/**
 * One-off: run generateFirstSessionInsights for a single session against
 * whatever DB DATABASE_URL points at. Prints the resolved result.
 *
 * Read-only by default. Pass --write to persist the result onto the
 * session's existing coachingCards JSON blob (adds/replaces the
 * `firstSessionInsights` key; every other key is left untouched), mirroring
 * exactly what analyzePCITCoding step 9 writes.
 *
 * Usage:
 *   node server/scripts/run-first-session-insights.cjs <sessionId> [--write]
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs = require('fs');
const path = require('path');
// Repo-local, gitignored scratch dir (see /scratch/ in .gitignore).
const OUT_DIR = path.resolve(__dirname, '../../scratch/first-session-insights');
fs.mkdirSync(OUT_DIR, { recursive: true });

const prisma = require('../services/db.cjs');
const { generateFirstSessionInsights } = require('../services/pcitAnalysisService.cjs');
const { getUtterances } = require('../utils/utteranceUtils.cjs');
const { decryptSensitiveData } = require('../utils/encryption.cjs');
const { parseUserIssues } = require('../services/priorityEngine.cjs');

function calculateChildAge(birthYear, birthday) {
  const today = new Date();
  if (birthday) {
    const b = new Date(birthday);
    let age = today.getFullYear() - b.getFullYear();
    const monthDiff = today.getMonth() - b.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < b.getDate())) age--;
    return age;
  }
  return birthYear ? today.getFullYear() - birthYear : null;
}
const formatGender = (g) => ({ BOY: 'boy', GIRL: 'girl', OTHER: 'child' }[g] || 'child');

const sessionId = process.argv[2];
const DO_WRITE = process.argv.includes('--write');
if (!sessionId) {
  console.error('Usage: node server/scripts/run-first-session-insights.cjs <sessionId> [--write]');
  process.exit(1);
}

async function main() {
  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { User: true } });
  if (!session) { console.error(`Session ${sessionId} not found`); process.exit(1); }

  const user = session.User;
  const userId = session.userId;
  const childName = user?.childName ? decryptSensitiveData(user.childName) : 'the child';
  const childAge = calculateChildAge(user?.childBirthYear, user?.childBirthday);
  const childGender = user?.childGender ? formatGender(user.childGender) : 'child';
  let userName = 'there';
  try {
    userName = user?.name ? decryptSensitiveData(user.name) : 'there';
  } catch (e) {
    console.error('⚠️ Failed to decrypt parent name, using fallback:', e.message);
  }
  const parentGoalsText = parseUserIssues(user?.parentGoal).map(g => g.replace(/_/g, ' ').toLowerCase()).join(', ');

  const utterances = await getUtterances(sessionId);
  const tagCounts = session.tagCounts || {};
  const priorCompletedCount = await prisma.session.count({ where: { userId, analysisStatus: 'COMPLETED', id: { not: sessionId } } });
  const primaryLanguage = session.elevenLabsJson?.language_code || null;

  console.log('='.repeat(70));
  console.log(`Session:           ${sessionId}`);
  console.log(`mode:              ${session.mode}`);
  console.log(`Child:             ${childName}, ${childAge} yrs, ${childGender}`);
  console.log(`Parent:            ${userName}`);
  console.log(`Parent goals:      ${parentGoalsText || '(none)'}`);
  console.log(`utterances:        ${utterances.length}`);
  console.log(`tagCounts:         praise=${tagCounts.praise || 0} echo=${tagCounts.echo || 0} narration=${tagCounts.narration || 0} question=${tagCounts.question || 0} command=${tagCounts.command || 0} criticism=${tagCounts.criticism || 0}`);
  console.log(`priorCompleted:    ${priorCompletedCount}  (real isFirstSession=${priorCompletedCount === 0})`);
  console.log(`primaryLanguage:   ${primaryLanguage || '(none)'}`);
  console.log(`write:             ${DO_WRITE}`);
  console.log('='.repeat(70));

  const childInfo = { name: childName, ageYears: childAge, gender: childGender, userName, parentGoalsText };

  const result = await generateFirstSessionInsights(utterances, childInfo, tagCounts, sessionId, primaryLanguage);
  if (!result) { console.error('❌ generateFirstSessionInsights returned null'); process.exit(1); }

  fs.writeFileSync(path.join(OUT_DIR, `result.${sessionId}.json`), JSON.stringify(result, null, 2));
  console.log('\n=== RESULT ===\n' + JSON.stringify(result, null, 2));

  if (DO_WRITE) {
    // Merge into the existing coachingCards blob rather than clobbering the
    // other keys already written by generateCdiCoaching for this session.
    const existing = session.coachingCards || {};
    const coachingCards = { ...existing, firstSessionInsights: result };

    await prisma.session.update({
      where: { id: sessionId },
      data: { coachingCards },
    });
    console.log(`\n✅ WROTE firstSessionInsights onto session ${sessionId}'s coachingCards blob`);
  } else {
    console.log('\n(dry run — pass --write to persist to the session)');
  }

  console.log(`\n(written to ${path.relative(process.cwd(), OUT_DIR)}/result.${sessionId}.json)`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
