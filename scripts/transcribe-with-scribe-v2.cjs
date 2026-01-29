/**
 * Script to transcribe a session using ElevenLabs scribe_v2 model
 */
const fetch = require('node-fetch');
const FormData = require('form-data');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const prisma = require('../server/services/db.cjs');
const { createUtterances, extractAndInsertSilentSlots } = require('../server/utils/utteranceUtils.cjs');
const { parseElevenLabsTranscript, formatUtterancesAsText } = require('../server/utils/parseElevenLabsTranscript.cjs');

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const s3Client = new S3Client({ region: AWS_REGION });
const S3_BUCKET = process.env.AWS_S3_BUCKET;

async function downloadAudioFromS3(storagePath) {
  const getCommand = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: storagePath
  });

  const response = await s3Client.send(getCommand);
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function transcribeWithScribeV2(audioBuffer, extension) {
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenLabsApiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  const contentTypeMap = {
    'm4a': 'audio/x-m4a',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'webm': 'audio/webm',
    'aac': 'audio/aac'
  };

  const contentType = contentTypeMap[extension] || 'audio/m4a';

  const formData = new FormData();
  formData.append('file', audioBuffer, {
    filename: `audio.${extension}`,
    contentType: contentType
  });
  formData.append('model_id', 'scribe_v2');  // Using scribe_v2
  formData.append('diarize', 'true');
  formData.append('diarization_threshold', 0.1);
  formData.append('temperature', 0);
  formData.append('tag_audio_events', 'true');
  formData.append('timestamps_granularity', 'word');

  console.log('📤 Calling ElevenLabs API with scribe_v2...');

  const response = await fetch(
    'https://api.elevenlabs.io/v1/speech-to-text?include_timestamps=true',
    {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey,
        ...formData.getHeaders()
      },
      body: formData
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail?.message || `ElevenLabs API error: ${response.status}`);
  }

  return response.json();
}

async function main() {
  const sessionId = process.argv[2];
  const saveToDb = process.argv[3] === '--save';

  if (!sessionId) {
    console.error('Usage: node transcribe-with-scribe-v2.cjs <sessionId> [--save]');
    console.error('  --save: Save results to database (default: just display)');
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
  console.log('');

  // Download audio from S3
  console.log('📥 Downloading audio from S3...');
  const audioBuffer = await downloadAudioFromS3(session.storagePath);
  console.log('Downloaded:', audioBuffer.length, 'bytes');

  // Get extension
  const extension = session.storagePath.split('.').pop();

  // Transcribe with scribe_v2
  const result = await transcribeWithScribeV2(audioBuffer, extension);
  console.log('✅ Transcription complete\n');

  // Debug: show structure of response
  console.log('Response keys:', Object.keys(result));
  if (result.words) {
    console.log('Words count:', result.words.length);
    console.log('First word sample:', JSON.stringify(result.words[0], null, 2));
  }
  if (result.utterances) {
    console.log('Utterances count:', result.utterances.length);
    console.log('First utterance sample:', JSON.stringify(result.utterances[0], null, 2));
  }
  console.log('');

  // Parse utterances
  const utterances = parseElevenLabsTranscript(result);
  console.log('Parsed', utterances.length, 'utterances\n');

  // Format and display transcript
  console.log('='.repeat(80));
  console.log('TRANSCRIPT (scribe_v2)');
  console.log('='.repeat(80));

  utterances.forEach((u, i) => {
    const start = u.startTime ?? u.start ?? 0;
    const end = u.endTime ?? u.end ?? 0;
    const timeStr = `[${start.toFixed(1)}s - ${end.toFixed(1)}s]`;
    console.log(`[${String(i).padStart(3, '0')}] ${u.speaker} ${timeStr}: ${u.text}`);
  });

  console.log('='.repeat(80));
  console.log('Total utterances:', utterances.length);
  console.log('='.repeat(80));

  if (saveToDb) {
    console.log('\n💾 Saving to database...');

    // Delete existing utterances
    await prisma.utterance.deleteMany({
      where: { sessionId }
    });

    // Store raw JSON
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        elevenLabsJson: result,
        transcript: formatUtterancesAsText(utterances),
        transcribedAt: new Date(),
        transcriptionService: 'elevenlabs-scribe_v2'
      }
    });

    // Create utterance records
    await createUtterances(sessionId, utterances);

    // Insert silent slots
    const silentSlotResult = await extractAndInsertSilentSlots(sessionId, utterances, {
      threshold: 3.0,
      recordingDuration: session.durationSeconds
    });

    console.log('✅ Saved to database');
    console.log('   Utterances:', utterances.length);
    console.log('   Silent slots:', silentSlotResult.count);
  } else {
    console.log('\n💡 Add --save flag to save results to database');
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
