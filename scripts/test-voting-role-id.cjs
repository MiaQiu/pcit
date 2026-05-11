'use strict';
/**
 * Test the 3-way voting role identification on a real session.
 *
 * Runs Gemini + Claude in parallel (ML Lambda skipped unless
 * DIARIZATION_LAMBDA_NAME env var is set).
 *
 * Usage:
 *   node scripts/test-voting-role-id.cjs <sessionId>
 *
 * Example:
 *   node scripts/test-voting-role-id.cjs 807db5e6-74ad-423c-ba20-b3ead3b58aad
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const prisma = require('../server/services/db.cjs');
const { identifyRolesWithVoting } = require('../server/services/pcitAnalysisService.cjs');

const SESSION_ID = process.argv[2];
if (!SESSION_ID) {
  console.error('Usage: node scripts/test-voting-role-id.cjs <sessionId>');
  process.exit(1);
}

async function main() {
  const session = await prisma.session.findUnique({
    where: { id: SESSION_ID },
    select: { id: true, userId: true, storagePath: true, roleIdentificationJson: true }
  });

  if (!session) {
    console.error('Session not found:', SESSION_ID);
    process.exit(1);
  }

  const utterances = await prisma.utterance.findMany({
    where:   { sessionId: SESSION_ID },
    orderBy: { order: 'asc' }
  });

  if (utterances.length === 0) {
    console.error('No utterances found for session', SESSION_ID);
    process.exit(1);
  }

  console.log(`Session : ${SESSION_ID}`);
  console.log(`Storage : ${session.storagePath || '(none)'}`);
  console.log(`Utts    : ${utterances.length}`);
  if (!process.env.DIARIZATION_LAMBDA_NAME) {
    console.log(`ML      : skipped (DIARIZATION_LAMBDA_NAME not set — 2-voter mode)`);
  }
  console.log('');

  const utterancesForPrompt = utterances.map(u => ({
    speaker: u.speaker,
    text:    u.text,
    start:   u.startTime,
    end:     u.endTime
  }));

  console.time('identifyRolesWithVoting');
  const { roleIdentificationJson, roleMap } = await identifyRolesWithVoting(
    utterancesForPrompt,
    utterances,
    session.storagePath,
    SESSION_ID
  );
  console.timeEnd('identifyRolesWithVoting');

  // Pull ML confidence from roleIdentificationJson if present
  const mlConf = {};
  for (const [spk, info] of Object.entries(roleIdentificationJson.speaker_identification || {})) {
    if (info._ml_confidence !== undefined) mlConf[spk] = info._ml_confidence;
  }

  console.log('\n── Vote detail ─────────────────────────────────────────');
  for (const [spk, detail] of Object.entries(roleIdentificationJson._vote_detail || {})) {
    const sources = detail.votes.map(v => {
      const conf = v.source === 'ml' && mlConf[spk] !== undefined ? ` (conf=${mlConf[spk].toFixed(2)})` : '';
      return `${v.source}→${v.role}${conf}`;
    }).join('  ');
    const flag = detail.adult > 0 && detail.child > 0 ? '  ⚠️  DISAGREEMENT' : '';
    console.log(`  ${spk}: adult=${detail.adult} child=${detail.child} → ${detail.winner.toUpperCase()}${flag}`);
    console.log(`         ${sources}`);
  }

  console.log('\n── Final role map ──────────────────────────────────────');
  console.log(JSON.stringify(roleMap, null, 2));

  console.log('\n── Sources used ────────────────────────────────────────');
  console.log(roleIdentificationJson._vote_sources.join(' + '));

  if (session.roleIdentificationJson) {
    console.log('\n── Previous stored result (for comparison) ─────────────');
    const prev = session.roleIdentificationJson.speaker_identification || {};
    for (const [spk, info] of Object.entries(prev)) {
      console.log(`  ${spk}: ${info.role}  (conf=${info.confidence ?? 'n/a'})`);
    }
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
