/**
 * End-to-end analysis run for testing the Gemini context cache implementation.
 * - Keeps roleIdDone checkpoint (roles already assigned, no audio needed)
 * - Clears pcitCodingDone so PCIT coding reruns via the new cache path
 * - Runs full analyzePCITCoding pipeline: coding → profiling → coaching → feedback
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const prisma = require('../server/services/db.cjs');
const { analyzePCITCoding } = require('../server/services/pcitAnalysisService.cjs');

const SESSION_ID = 'c52f3ecd-d418-4bc2-a834-29c941f3a772';

async function main() {
  const session = await prisma.session.findUnique({
    where: { id: SESSION_ID },
    select: { userId: true, mode: true, analysisStatus: true, enrichmentStatus: true, roleIdDone: true }
  });
  if (!session) throw new Error(`Session ${SESSION_ID} not found`);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`E2E CACHE TEST — Session ${SESSION_ID}`);
  console.log(`Mode: ${session.mode} | Status: ${session.analysisStatus} | Enrichment: ${session.enrichmentStatus}`);
  console.log(`${'='.repeat(80)}\n`);

  // Reset pcitCodingDone so coding reruns through the cache path
  await prisma.session.update({
    where: { id: SESSION_ID },
    data: { pcitCodingDone: false }
  });
  console.log('✅ Cleared pcitCodingDone — PCIT coding will rerun via cache\n');

  const t0 = Date.now();
  const result = await analyzePCITCoding(SESSION_ID, session.userId);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`RESULT (${elapsed}s total)`);
  console.log(`${'='.repeat(80)}\n`);

  console.log('── Tag Counts:');
  console.log(JSON.stringify(result.tagCounts, null, 2));

  console.log(`\n── Overall Score: ${result.overallScore}`);

  const cp = result.childProfilingResult;
  if (cp) {
    console.log(`\n── Coaching Cards: ${cp.coachingCards?.length ?? 0} sections`);
    if (cp.coachingCards?.length) {
      for (const s of cp.coachingCards) {
        console.log(`   [${s.title}] ${s.content?.substring(0, 80)}...`);
      }
    }
    console.log(`\n── Tomorrow Goal: ${cp.tomorrowGoal}`);
    console.log(`\n── Notifications: ${JSON.stringify(cp.notifications, null, 2)}`);
    console.log(`\n── About Child: ${cp.aboutChild?.length ?? 0} observations`);
    console.log(`\n── Dev Profiling Domains: ${cp.developmentalObservation?.domains?.length ?? 0}`);
  } else {
    console.log('\n⚠️  No child profiling result');
  }

  const comp = result.competencyAnalysis;
  if (comp) {
    console.log(`\n── Top Moment: "${comp.topMoment?.substring(0, 80)}"`);
    console.log(`── Feedback: "${comp.feedback?.substring(0, 100)}"`);
    console.log(`── Activity: ${comp.activity}`);
  }
}

main()
  .then(() => { console.log(`\n${'='.repeat(80)}\n✅ Done.\n${'='.repeat(80)}\n`); })
  .catch(e => { console.error('❌ Fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
