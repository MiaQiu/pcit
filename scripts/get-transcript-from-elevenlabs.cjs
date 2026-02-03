#!/usr/bin/env node
/**
 * Get transcript from ElevenLabs for a session
 *
 * Usage: node scripts/get-transcript-from-elevenlabs.cjs <session-id>
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const fetch = require('node-fetch');
const FormData = require('form-data');

const prisma = new PrismaClient();

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const s3Client = new S3Client({ region: AWS_REGION });
const S3_BUCKET = process.env.AWS_S3_BUCKET;

const CONTENT_TYPE_MAP = {
  'm4a': 'audio/x-m4a',
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'webm': 'audio/webm',
  'aac': 'audio/aac'
};

/**
 * Download audio file from S3
 */
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

/**
 * Transcribe audio using ElevenLabs
 */
async function transcribeWithElevenLabs(audioBuffer, sessionId, extension) {
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenLabsApiKey) {
    throw new Error('ELEVENLABS_API_KEY not set');
  }

  const contentType = CONTENT_TYPE_MAP[extension] || 'audio/m4a';

  const formData = new FormData();
  formData.append('file', audioBuffer, {
    filename: `${sessionId}.${extension}`,
    contentType: contentType
  });
  formData.append('model_id', 'scribe_v2');
  formData.append('diarize', 'true');
  formData.append('diarization_threshold', 0.1);
  formData.append('temperature', 0);
  formData.append('tag_audio_events', 'true');
  formData.append('timestamps_granularity', 'word');

  console.log('Sending to ElevenLabs...');

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

/**
 * Parse ElevenLabs response into utterances
 */
function parseElevenLabsTranscript(elevenLabsJson) {
  if (!elevenLabsJson || !elevenLabsJson.words || elevenLabsJson.words.length === 0) {
    console.warn('No words found in ElevenLabs response');
    return [];
  }

  const words = elevenLabsJson.words;
  const utterances = [];

  let currentUtterance = {
    speaker: null,
    text: '',
    start: null,
    end: null
  };

  for (const word of words) {
    if (word.type === 'spacing') {
      continue;
    }

    if (currentUtterance.speaker === null) {
      currentUtterance.speaker = word.speaker_id;
      currentUtterance.start = word.start;
    }

    if (word.speaker_id !== currentUtterance.speaker && currentUtterance.text.trim()) {
      currentUtterance.end = word.start;
      utterances.push({ ...currentUtterance });
      currentUtterance = {
        speaker: word.speaker_id,
        text: '',
        start: word.start,
        end: null
      };
    }

    if (currentUtterance.text) {
      currentUtterance.text += ' ' + word.text;
    } else {
      currentUtterance.text = word.text;
    }
    currentUtterance.end = word.end;

    const endsWithPunctuation = /[。！？\.\!\?]$/.test(word.text);

    if (endsWithPunctuation && currentUtterance.text.trim()) {
      utterances.push({ ...currentUtterance });
      currentUtterance = {
        speaker: null,
        text: '',
        start: null,
        end: null
      };
    }
  }

  if (currentUtterance.text.trim()) {
    utterances.push(currentUtterance);
  }

  return utterances.map(utt => ({
    speaker: utt.speaker,
    text: utt.text.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim(),
    start: utt.start,
    end: utt.end,
    duration: parseFloat((utt.end - utt.start).toFixed(2))
  }));
}

/**
 * Format utterances for display
 */
function formatUtterances(utterances) {
  return utterances
    .map((utt, idx) => {
      const timeRange = `${utt.start.toFixed(2)}-${utt.end.toFixed(2)}s`;
      return `[${String(idx + 1).padStart(2, '0')}] ${utt.speaker} | ${timeRange.padEnd(14)} | ${utt.text}`;
    })
    .join('\n');
}

async function main() {
  const sessionId = process.argv[2];

  if (!sessionId) {
    console.error('Usage: node scripts/get-transcript-from-elevenlabs.cjs <session-id>');
    process.exit(1);
  }

  try {
    // Get session from database
    console.log(`Fetching session ${sessionId}...`);
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      console.error(`Session not found: ${sessionId}`);
      process.exit(1);
    }

    console.log(`Storage path: ${session.storagePath}`);

    // Download audio from S3
    console.log('Downloading audio from S3...');
    const audioBuffer = await downloadAudioFromS3(session.storagePath);
    console.log(`Downloaded ${audioBuffer.length} bytes`);

    // Get file extension
    const extension = session.storagePath.split('.').pop();

    // Transcribe with ElevenLabs
    const result = await transcribeWithElevenLabs(audioBuffer, sessionId, extension);

    // Parse and format utterances
    const utterances = parseElevenLabsTranscript(result);
    console.log(`\n=== Formatted Utterances (${utterances.length} total) ===\n`);
    console.log(formatUtterances(utterances));

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
