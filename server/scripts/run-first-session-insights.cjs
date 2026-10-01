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
 *   node server/scripts/run-first-session-insights.cjs <sessionId> [--write] [--parent-goals='["tag1","tag2"]'] [--issue='["tag1","tag2"]']
 *
 *   --parent-goals   Override PARENT_GOALS for this run only (same raw shape
 *                     as User.parentGoal — a JSON array string or plain
 *                     string), formatted the same way the real pipeline does.
 *                     Does not touch the DB user record.
 *   --issue          Override the parent's target issue(s) (User.issue) for
 *                     this run only, same raw shape and caveat as
 *                     --parent-goals above.
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
const fmt = (s) => parseUserIssues(s).map(g => g.replace(/_/g, ' ').toLowerCase()).join(', ');

const formatGender = (g) => ({ BOY: 'boy', GIRL: 'girl', OTHER: 'child' }[g] || 'child');

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

const sessionId = process.argv[2];
const DO_WRITE = process.argv.includes('--write');
const parentGoalsArg = process.argv.find(a => a.startsWith('--parent-goals='));
const PARENT_GOALS_OVERRIDE = parentGoalsArg ? parentGoalsArg.slice('--parent-goals='.length) : null;
const issueArg = process.argv.find(a => a.startsWith('--issue='));
const ISSUE_OVERRIDE = issueArg ? issueArg.slice('--issue='.length) : null;
if (!sessionId) {
  console.error('Usage: node server/scripts/run-first-session-insights.cjs <sessionId> [--write] [--parent-goals=\'["tag1","tag2"]\']');
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
  const parentGoalsText = PARENT_GOALS_OVERRIDE != null ? fmt(PARENT_GOALS_OVERRIDE) : fmt(user?.parentGoal);
  const parentContextText = ISSUE_OVERRIDE != null ? fmt(ISSUE_OVERRIDE) : fmt(user?.issue);

  const utterances = await getUtterances(sessionId);
  const priorCompletedCount = await prisma.session.count({ where: { userId, analysisStatus: 'COMPLETED', id: { not: sessionId } } });
  const primaryLanguage = session.elevenLabsJson?.language_code || null;

  console.log('='.repeat(70));
  console.log(`Session:           ${sessionId}`);
  console.log(`mode:              ${session.mode}`);
  console.log(`Child:             ${childName}, ${childAge} yrs, ${childGender}`);
  console.log(`Parent goals:      ${parentGoalsText || '(none)'}${PARENT_GOALS_OVERRIDE != null ? '  (overridden for this run)' : ''}`);
  console.log(`Parent context:    ${parentContextText || '(none)'}${ISSUE_OVERRIDE != null ? '  (overridden for this run)' : ''}`);
  console.log(`utterances:        ${utterances.length}`);
  console.log(`priorCompleted:    ${priorCompletedCount}  (real isFirstSession=${priorCompletedCount === 0})`);
  console.log(`primaryLanguage:   ${primaryLanguage || '(none)'}`);
  console.log(`write:             ${DO_WRITE}`);
  console.log('='.repeat(70));

  const childInfo = { name: childName, ageYears: childAge, gender: childGender, parentGoalsText, parentContextText };

  const result = await generateFirstSessionInsights(utterances, childInfo, sessionId, primaryLanguage);
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
