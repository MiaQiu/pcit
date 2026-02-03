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

  const survey = await prisma.wacbSurvey.findFirst({
    where: { userId: child.userId },
    orderBy: { submittedAt: "desc" }
  });

  if (survey) {
    console.log("WACB:", {
      q1Dawdle: survey.q1Dawdle,
      q2MealBehavior: survey.q2MealBehavior,
      q3Disobey: survey.q3Disobey,
      q4Angry: survey.q4Angry,
      q5Scream: survey.q5Scream,
      q6Destroy: survey.q6Destroy,
      q7ProvokeFights: survey.q7ProvokeFights,
      q8Interrupt: survey.q8Interrupt,
      q9Attention: survey.q9Attention
    });
  } else {
    console.log("WACB: None");
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
