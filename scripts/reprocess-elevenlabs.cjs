/**
 * Script to reprocess ElevenLabs transcript for a session
 * Can either re-call the API or just re-parse existing JSON
 */
const prisma = require('../server/services/db.cjs');
const { transcribeRecording } = require('../server/services/transcriptionService.cjs');
const { parseElevenLabsTranscript, formatUtterancesAsText } = require('../server/utils/parseElevenLabsTranscript.cjs');
const { createUtterances, extractAndInsertSilentSlots } = require('../server/utils/utteranceUtils.cjs');

async function main() {
  const sessionId = process.argv[2];
  const forceNewCall = process.argv[3] === '--force';

  if (!sessionId) {
    console.error('Usage: node reprocess-elevenlabs.cjs <sessionId> [--force]');
    console.error('  --force: Re-call ElevenLabs API instead of using cached JSON');
    process.exit(1);
  }

  // Get session
  const session = await prisma.session.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    console.error('Session not found:', sessionId);
    process.exit(1);
  }

  console.log('Session ID:', session.id);
  console.log('Storage Path:', session.storagePath);
  console.log('Duration:', session.durationSeconds, 'seconds');
  console.log('Has ElevenLabs JSON:', session.elevenLabsJson ? 'Yes' : 'No');
  console.log('Transcribed At:', session.transcribedAt);

  if (forceNewCall) {
    // Re-call ElevenLabs API
    console.log('\n🔄 Force mode: Re-calling ElevenLabs API...');

    // Delete existing utterances first
    await prisma.utterance.deleteMany({
      where: { sessionId }
    });
    console.log('Deleted existing utterances');

    const result = await transcribeRecording(
      sessionId,
      session.userId,
      session.storagePath,
      session.durationSeconds
    );

    console.log('\n✅ Transcription complete');
    console.log('Utterances:', result.utterances.length);

  } else if (session.elevenLabsJson) {
    // Re-parse existing JSON
    console.log('\n🔄 Re-parsing existing ElevenLabs JSON...');

    // Delete existing utterances first
    await prisma.utterance.deleteMany({
      where: { sessionId }
    });
    console.log('Deleted existing utterances');

    // Parse JSON into utterances
    const utterances = parseElevenLabsTranscript(session.elevenLabsJson);
    console.log('Parsed utterances:', utterances.length);

    if (utterances.length === 0) {
      console.error('No utterances parsed from ElevenLabs JSON');
      process.exit(1);
    }

    // Format transcript
    const transcriptFormatted = formatUtterancesAsText(utterances);

    // Update session
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        transcript: transcriptFormatted,
        transcribedAt: new Date(),
        transcriptionService: 'elevenlabs'
      }
    });
    console.log('Updated transcript in session');

    // Create utterance records
    await createUtterances(sessionId, utterances);
    console.log('Created utterance records');

    // Extract and insert silent slots
    const silentSlotResult = await extractAndInsertSilentSlots(sessionId, utterances, {
      threshold: 3.0,
      recordingDuration: session.durationSeconds
    });
    console.log('Inserted', silentSlotResult.count, 'silent slots');

    console.log('\n✅ Re-processing complete');

  } else {
    console.log('\n⚠️ No ElevenLabs JSON found. Use --force to re-call the API.');
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
