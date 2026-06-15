'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const prisma = require('../services/db.cjs');
const { parseElevenLabsTranscript, formatUtterancesAsText } = require('../utils/parseElevenLabsTranscript.cjs');
const { reSegmentUtterances } = require('../utils/dpicsSegmenter.cjs');
const { createUtterances, extractAndInsertSilentSlots } = require('../utils/utteranceUtils.cjs');
const { analyzePCITCoding } = require('../services/pcitAnalysisService.cjs');

const SESSION_ID = process.argv[2];
if (!SESSION_ID) {
  console.error('Usage: node server/scripts/run-e2e-session.cjs <sessionId>');
  process.exit(1);
}

async function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`E2E pipeline for session: ${SESSION_ID}`);
  console.log(`${'='.repeat(70)}\n`);

  const session = await prisma.session.findUnique({ where: { id: SESSION_ID } });
  if (!session) {
    console.error(`❌ Session ${SESSION_ID} not found`);
    process.exit(1);
  }
  console.log(`✅ Session: mode=${session.mode}  duration=${session.durationSeconds}s  userId=${session.userId}`);
  console.log(`   analysisStatus: ${session.analysisStatus}  transcribedAt: ${session.transcribedAt}`);

  const elevenLabsJson = session.elevenLabsJson;
  if (!elevenLabsJson) {
    console.error('❌ No elevenLabsJson stored on session — cannot re-process without audio');
    process.exit(1);
  }
  console.log(`   elevenLabsJson: ${elevenLabsJson.words?.length ?? 0} words\n`);

  // ── Reset state ────────────────────────────────────────────────────────────
  await prisma.utterance.deleteMany({ where: { sessionId: SESSION_ID } });
  await prisma.session.update({
    where: { id: SESSION_ID },
    data: {
      transcribedAt:    null,
      analysisStatus:   'PENDING',
      analysisError:    null,
      analysisFailedAt: null,
      permanentFailure: false,
    }
  });
  console.log('✅ State reset — utterances cleared\n');

  // ── Step 1: Parse + DPICS segmentation ────────────────────────────────────
  console.log(`${'─'.repeat(70)}`);
  console.log('STEP 1: Parse ElevenLabs JSON + DPICS segmentation');
  console.log(`${'─'.repeat(70)}`);

  let utterances = parseElevenLabsTranscript(elevenLabsJson);
  const words = elevenLabsJson.words ?? [];
  console.log(`✅ Parsed ${utterances.length} utterances from cached ElevenLabs JSON`);

  utterances = await reSegmentUtterances(utterances, words);

  const transcriptFormatted = formatUtterancesAsText(utterances);
  await prisma.session.update({
    where: { id: SESSION_ID },
    data: {
      transcript: transcriptFormatted,
      transcribedAt: new Date(),
      transcriptionService: 'elevenlabs-v2'
    }
  });

  await createUtterances(SESSION_ID, utterances);

  const silentResult = await extractAndInsertSilentSlots(SESSION_ID, utterances, {
    threshold: 3.0,
    recordingDuration: session.durationSeconds
  });
  console.log(`✅ ${utterances.length} utterances + ${silentResult.count} silent slots written\n`);

  // ── Step 2: PCIT analysis ──────────────────────────────────────────────────
  console.log(`${'─'.repeat(70)}`);
  console.log('STEP 2: PCIT analysis');
  console.log(`${'─'.repeat(70)}`);

  await analyzePCITCoding(SESSION_ID, session.userId);

  await prisma.session.update({
    where: { id: SESSION_ID },
    data: { analysisStatus: 'COMPLETED' }
  });

  console.log(`\n${'='.repeat(70)}`);
  console.log(`✅ Done. Session: ${SESSION_ID}`);
  console.log(`${'='.repeat(70)}\n`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
