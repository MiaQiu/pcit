/**
 * Print the assembled CDI coaching prompt for a session (no API call).
 * Usage: node scripts/print-cdi-prompt.cjs <sessionId>
 */
require('dotenv').config();
const prisma = require('../server/services/db.cjs');
const { getUtterances, SILENT_SPEAKER_ID } = require('../server/utils/utteranceUtils.cjs');
const { decryptSensitiveData } = require('../server/utils/encryption.cjs');
const { loadPromptWithVariables } = require('../server/prompts/index.cjs');

const SESSION_ID = process.argv[2] || '807db5e6-74ad-423c-ba20-b3ead3b58aac';

function formatUtterancesForPsychologist(utterances) {
  return utterances
    .filter(u => u.speaker !== SILENT_SPEAKER_ID)
    .map(u => {
      const roleLabel = u.role === 'adult' ? 'Parent' : u.role === 'child' ? 'Child' : u.speaker;
      return `${roleLabel}: ${u.text}`;
    }).join('\n');
}

function formatLevel(level) { return level ? level.replace(/_/g, ' ').toLowerCase() : 'none'; }
function formatStrategy(strategy) { return strategy ? strategy.replace(/_/g, ' ').toLowerCase() : 'none'; }

function formatIssueLabel(row) {
  if (row && row.fromUserIssue && row.userIssues) {
    try { return JSON.parse(row.userIssues).map(i => i.replace(/_/g, ' ').toLowerCase()).join(', '); } catch (_) {}
  }
  if (row && row.fromWacb && row.wacbQuestions) {
    try { return JSON.parse(row.wacbQuestions).join(', '); } catch (_) {}
  }
  return formatLevel(row ? row.clinicalLevel : null);
}

async function main() {
  const session = await prisma.session.findUnique({ where: { id: SESSION_ID } });
  if (!session) throw new Error('Session not found');

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  const child = await prisma.child.findFirst({ where: { userId: session.userId } });
  const childName = user && user.childName ? decryptSensitiveData(user.childName) : 'the child';
  const childAgeMonths = user && user.childBirthYear
    ? ((new Date().getFullYear() - new Date(user.childBirthday || `${user.childBirthYear}-06-01`).getFullYear()) * 12 +
       (new Date().getMonth() - new Date(user.childBirthday || `${user.childBirthYear}-06-01`).getMonth()))
    : 'unknown';
  const genderMap = { BOY: 'boy', GIRL: 'girl', OTHER: 'child' };
  const childGender = (user && user.childGender) ? (genderMap[user.childGender] || 'child') : 'child';

  // Clinical priority
  let issuePriorities = [];
  if (child) {
    const latestComputedAt = await prisma.childIssuePriority.findFirst({
      where: { childId: child.id }, orderBy: { computedAt: 'desc' }, select: { computedAt: true }
    });
    if (latestComputedAt) {
      issuePriorities = await prisma.childIssuePriority.findMany({
        where: { childId: child.id, computedAt: latestComputedAt.computedAt },
        orderBy: { priorityRank: 'asc' }
      });
    }
  }

  const primaryRow = issuePriorities.find(r => r.priorityRank === 1);
  const otherPriorities = issuePriorities.filter(r => r.priorityRank > 1);
  const primaryIssueText = primaryRow ? formatIssueLabel(primaryRow) : 'none';
  const otherIssuesText = otherPriorities.length > 0
    ? otherPriorities.map(r => `  - ${formatIssueLabel(r)}`).join('\n')
    : '  none';

  const utterances = await getUtterances(SESSION_ID);
  const tagCounts = session.tagCounts || {};
  const transcript = formatUtterancesForPsychologist(utterances);

  const sessionMetrics = `- Labeled Praises: ${tagCounts.praise || 0} (goal: 10+)
- Reflections: ${tagCounts.echo || 0} (goal: 10+)
- Behavioral Descriptions: ${tagCounts.narration || 0} (goal: 10+)
- Questions: ${tagCounts.question || 0} (reduce)
- Commands: ${tagCounts.command || 0} (reduce)
- Criticisms: ${tagCounts.criticism || 0} (eliminate)`;

  const prompt = loadPromptWithVariables('cdiCoaching', {
    CHILD_NAME: childName,
    CHILD_AGE_MONTHS: String(childAgeMonths),
    CHILD_GENDER: childGender,
    PRIMARY_ISSUE: primaryIssueText,
    PRIMARY_STRATEGY: formatStrategy(child ? child.primaryStrategy : null),
    PRIMARY_DETAILS: 'none',
    OTHER_ISSUES: otherIssuesText,
    SESSION_METRICS: sessionMetrics,
    TRANSCRIPT: transcript
  });

  console.log(prompt);
  await prisma.$disconnect();
}

main().catch(err => { console.error(err); prisma.$disconnect(); process.exit(1); });
