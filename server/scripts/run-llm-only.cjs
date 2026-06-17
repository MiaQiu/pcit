'use strict';

/**
 * Run only the LLM analysis steps for a session that already has utterances.
 *
 * Skips: ElevenLabs parsing, DPICS segmentation, utterance creation.
 * Runs:  role identification vote → quality gate → PCIT coding → feedback → profiling.
 *
 * Usage:
 *   node server/scripts/run-llm-only.cjs <sessionId> [--skip-role-id]
 *
 *   --skip-role-id  Reuse the existing roleIdentificationJson checkpoint instead
 *                   of re-running the role ID vote. Useful when only re-running
 *                   coding/feedback/profiling.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const prisma = require('../services/db.cjs');
const { analyzePCITCoding } = require('../services/pcitAnalysisService.cjs');
const { getUtterances } = require('../utils/utteranceUtils.cjs');

const SESSION_ID  = process.argv[2];
const SKIP_ROLE_ID = process.argv.includes('--skip-role-id');

if (!SESSION_ID) {
  console.error('Usage: node server/scripts/run-llm-only.cjs <sessionId> [--skip-role-id]');
  process.exit(1);
}

async function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`LLM-only pipeline for session: ${SESSION_ID}`);
  if (SKIP_ROLE_ID) console.log(`  (--skip-role-id: reusing existing role checkpoint)`);
  console.log(`${'='.repeat(70)}\n`);

  // ── Fetch session ─────────────────────────────────────────────────────────
  const session = await prisma.session.findUnique({ where: { id: SESSION_ID } });
  if (!session) {
    console.error(`❌ Session ${SESSION_ID} not found`);
    process.exit(1);
  }
  console.log(`✅ Session found`);
  console.log(`   mode:           ${session.mode}`);
  console.log(`   userId:         ${session.userId}`);
  console.log(`   durationSeconds:${session.durationSeconds}`);
  console.log(`   analysisStatus: ${session.analysisStatus}`);
  console.log(`   roleIdDone:     ${session.roleIdDone}`);
  console.log(`   pcitCodingDone: ${session.pcitCodingDone}`);

  // ── Verify utterances exist ───────────────────────────────────────────────
  const utterances = await getUtterances(SESSION_ID);
  if (utterances.length === 0) {
    console.error(`❌ No utterances found for session ${SESSION_ID}`);
    console.error('   Run the full e2e script first to parse the transcript.');
    process.exit(1);
  }
  console.log(`\n✅ ${utterances.length} utterances found in DB\n`);

  // ── Reset checkpoints ─────────────────────────────────────────────────────
  const resetData = {
    analysisStatus:   'PENDING',
    analysisError:    null,
    analysisFailedAt: null,
    permanentFailure: false,
    pcitCodingDone:   false,
    pcitCoding:       null,
    tagCounts:        null,
    competencyAnalysis: null,
    overallScore:     null,
    coachingSummary:  null,
    coachingCards:    null,
    aboutChild:       null,
    enrichmentStatus: 'PENDING',
    enrichmentError:  null,
  };

  if (!SKIP_ROLE_ID) {
    resetData.roleIdDone           = false;
    resetData.roleIdentificationJson = null;
  }

  await prisma.session.update({ where: { id: SESSION_ID }, data: resetData });

  if (SKIP_ROLE_ID) {
    console.log('✅ Analysis checkpoints reset (role ID checkpoint preserved)\n');
    if (!session.roleIdentificationJson) {
      console.warn('⚠️  --skip-role-id passed but no roleIdentificationJson exists — role ID will run anyway\n');
    }
  } else {
    console.log('✅ All LLM checkpoints reset (role ID + coding + profiling)\n');
  }

  // ── Run LLM analysis ──────────────────────────────────────────────────────
  console.log(`${'─'.repeat(70)}`);
  console.log('Running analyzePCITCoding...');
  console.log(`${'─'.repeat(70)}\n`);

  const t0 = Date.now();
  const result = await analyzePCITCoding(SESSION_ID, session.userId);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  // ── Mark completed ────────────────────────────────────────────────────────
  await prisma.session.update({
    where: { id: SESSION_ID },
    data: { analysisStatus: 'COMPLETED' }
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  const tc = result?.tagCounts || {};
  console.log(`\n${'='.repeat(70)}`);
  console.log(`✅ Done (${elapsed}s) — session: ${SESSION_ID}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`\nTag counts:`);
  console.log(`  Praise:    ${tc.labeled_praise ?? 0} LP + ${tc.unlabeled_praise ?? 0} UP`);
  console.log(`  Echo:      ${tc.echo ?? 0}`);
  console.log(`  Narration: ${tc.narration ?? 0}`);
  console.log(`  Questions: ${tc.question ?? 0}`);
  console.log(`  Commands:  ${tc.command ?? 0}  (DC: ${tc.direct_command ?? 0}, IC: ${tc.indirect_command ?? 0})`);
  console.log(`  Criticism: ${tc.criticism ?? 0}`);
  console.log(`\nNora score:  ${result?.overallScore ?? 'n/a'}`);
  console.log(`Feedback:    ${result?.competencyAnalysis?.feedback ? '✅' : '❌ missing'}`);
  console.log(`Coaching:    ${result?.childProfilingResult?.coachingSummary ? '✅' : '❌ missing'}`);
  console.log(`Profiling:   ${result?.childProfilingResult?.developmentalObservation ? '✅' : '❌ missing'}`);
  console.log(`About child: ${result?.childProfilingResult?.aboutChild ? '✅' : '❌ missing'}`);
  console.log();

  await prisma.$disconnect();
}

main().catch(async err => {
  console.error('\n❌ Fatal error:', err.message);
  console.error(err.stack);

  // Leave session in FAILED state so the retry queue can pick it up
  await prisma.session.update({
    where: { id: SESSION_ID },
    data: { analysisStatus: 'FAILED', analysisError: err.message, analysisFailedAt: new Date() }
  }).catch(() => {});

  await prisma.$disconnect();
  process.exit(1);
});
