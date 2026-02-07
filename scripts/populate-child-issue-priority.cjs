/**
 * Run priority engine for a user and populate ChildIssuePriority table.
 *
 * Usage: node scripts/populate-child-issue-priority.cjs <userId>
 */

const prisma = require("../server/services/db.cjs");
const { runPriorityEngine, evaluatePriorities } = require("../server/services/priorityEngine.cjs");

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error("Usage: node scripts/populate-child-issue-priority.cjs <userId>");
    process.exit(1);
  }

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, childName: true, issue: true }
  });
  if (!user) {
    console.error("User not found:", userId);
    process.exit(1);
  }
  console.log("User:", user.childName, "| Issues:", user.issue);

  // Show latest WACB survey
  const survey = await prisma.wacbSurvey.findFirst({
    where: { userId },
    orderBy: { submittedAt: "desc" }
  });
  if (survey) {
    console.log("Latest WACB survey:", survey.id.substring(0, 8), "| submitted:", survey.submittedAt.toISOString());
  } else {
    console.log("No WACB survey found");
  }

  // Preview priorities
  const priorities = await evaluatePriorities(userId);
  console.log("\nActive levels:", priorities.activeLevels.length);
  for (const entry of priorities.activeLevels) {
    console.log(`  ${entry.level} — userIssues: [${entry.userIssues}] wacbQuestions: [${entry.wacbQuestions}] wacbScore: ${entry.wacbScore}`);
  }

  // Count existing rows before
  const child = await prisma.child.findFirst({ where: { userId } });
  const beforeCount = child
    ? await prisma.childIssuePriority.count({ where: { childId: child.id } })
    : 0;
  console.log(`\nChildIssuePriority rows before: ${beforeCount}`);

  // Run the engine (pass wacbSurveyId if a survey exists)
  const result = await runPriorityEngine(userId, { wacbSurveyId: survey?.id });
  console.log("\nChild updated:", {
    primaryIssue: result.primaryIssue,
    primaryStrategy: result.primaryStrategy,
    secondaryIssue: result.secondaryIssue,
    secondaryStrategy: result.secondaryStrategy
  });

  // Count after and show new rows
  const afterCount = await prisma.childIssuePriority.count({ where: { childId: result.id } });
  console.log(`ChildIssuePriority rows after: ${afterCount} (+${afterCount - beforeCount})`);

  const rows = await prisma.childIssuePriority.findMany({
    where: { childId: result.id },
    orderBy: [{ computedAt: "desc" }, { priorityRank: "asc" }],
    take: 10
  });
  console.log("\nLatest ChildIssuePriority rows:");
  for (const row of rows) {
    console.log(`  rank=${row.priorityRank} ${row.clinicalLevel} → ${row.strategy} | userIssue=${row.fromUserIssue} wacb=${row.fromWacb} score=${row.wacbScore} | ${row.computedAt.toISOString()}`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
