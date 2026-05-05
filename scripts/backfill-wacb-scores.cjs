/**
 * Backfill WACB totalScore using new scoring formula:
 * value 1 -> 1 pts, 2 -> 2 pts, 3 -> 4 pts, 4 -> 6 pts, 5 -> 7 pts
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const VALUE_TO_POINTS = { 1: 1, 2: 2, 3: 4, 4: 6, 5: 7 };
const toPoints = (v) => VALUE_TO_POINTS[v] ?? v;

async function backfill() {
  const surveys = await prisma.wacbSurvey.findMany();
  console.log(`Found ${surveys.length} survey(s) to recalculate.\n`);

  let updated = 0;
  for (const s of surveys) {
    const newScore =
      toPoints(s.q1Dawdle) + toPoints(s.q2MealBehavior) + toPoints(s.q3Disobey) +
      toPoints(s.q4Angry) + toPoints(s.q5Scream) + toPoints(s.q6Destroy) +
      toPoints(s.q7ProvokeFights) + toPoints(s.q8Interrupt) + toPoints(s.q9Attention);

    if (newScore !== s.totalScore) {
      await prisma.wacbSurvey.update({
        where: { id: s.id },
        data: { totalScore: newScore }
      });
      console.log(`  Survey ${s.id}: ${s.totalScore} -> ${newScore}`);
      updated++;
    } else {
      console.log(`  Survey ${s.id}: no change (${s.totalScore})`);
    }
  }

  console.log(`\nDone. Updated ${updated}/${surveys.length} survey(s).`);
  await prisma.$disconnect();
}

backfill().catch(err => {
  console.error(err);
  process.exit(1);
});
