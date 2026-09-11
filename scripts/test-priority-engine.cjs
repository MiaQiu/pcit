const prisma = require("../server/services/db.cjs");
const { runPriorityEngine } = require("../server/services/priorityEngine.cjs");

async function testChild(childId) {
  const child = await prisma.child.findUnique({
    where: { id: childId },
    include: { User: { select: { id: true, issue: true } } }
  });

  if (!child) {
    console.log("Child not found:", childId);
    return;
  }

  console.log("=".repeat(60));
  console.log("Child:", child.name, "| ID:", child.id.substring(0,8));
  console.log("User issue:", child.User.issue);

  const survey = await prisma.childSnapshotSurvey.findFirst({
    where: { userId: child.userId },
    orderBy: { submittedAt: "desc" }
  });

  if (survey) {
    console.log("Snapshot:", {
      q1Dawdle: survey.q1Dawdle,
      q2Disobey: survey.q2Disobey,
      q3Tantrum: survey.q3Tantrum,
      q4Defiance: survey.q4Defiance,
      q5FocusDemand: survey.q5FocusDemand,
      q6Restless: survey.q6Restless,
      q7TaskCompletion: survey.q7TaskCompletion,
      q8Destroy: survey.q8Destroy,
      q9Aggression: survey.q9Aggression,
      q10LieSteal: survey.q10LieSteal
    });
  } else {
    console.log("Snapshot: None");
  }

  const result = await runPriorityEngine(child.userId);
  console.log("Result:", {
    primaryIssue: result.primaryIssue,
    primaryStrategy: result.primaryStrategy,
    secondaryIssue: result.secondaryIssue,
    secondaryStrategy: result.secondaryStrategy
  });
}

async function main() {
  const childIds = process.argv.slice(2);
  for (const id of childIds) {
    await testChild(id);
  }
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
