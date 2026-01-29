/**
 * Transcription Service
 * Handles audio transcription using ElevenLabs
 *
 * Supports three transcription modes (set via TRANSCRIPTION_MODE env var):
 *   - 'v1'       : scribe_v1 only (better 3-speaker diarization)
 *   - 'v2'       : scribe_v2 only (better text quality, default)
 *   - 'two-pass' : scribe_v2 text + scribe_v1 diarization (best of both)
 */
const fetch = require('node-fetch');
const FormData = require('form-data');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const prisma = require('./db.cjs');
const { createAnonymizedRequest } = require('../utils/anonymization.cjs');
const { createUtterances, extractAndInsertSilentSlots } = require('../utils/utteranceUtils.cjs');
const { decryptSensitiveData } = require('../utils/encryption.cjs');
const { parseElevenLabsTranscript, formatUtterancesAsText } = require('../utils/parseElevenLabsTranscript.cjs');

// S3 Client for downloading audio files
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const s3Client = new S3Client({ region: AWS_REGION });
const S3_BUCKET = process.env.AWS_S3_BUCKET;

/**
 * Transcription mode: 'v1', 'v2', or 'two-pass'
 */
const TRANSCRIPTION_MODE = process.env.TRANSCRIPTION_MODE || 'v2';

/**
 * Content type map for audio file extensions
 */
const CONTENT_TYPE_MAP = {
  'm4a': 'audio/x-m4a',
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'webm': 'audio/webm',
  'aac': 'audio/aac'
};

/**
 * Download audio file from S3
 * @param {string} storagePath - S3 key for the audio file
 * @returns {Promise<Buffer>} Audio file buffer
 */
async function downloadAudioFromS3(storagePath) {
  if (storagePath.startsWith('mock://')) {
    throw new Error('Transcription not available in mock storage mode');
  }

  const getCommand = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: storagePath
  });

  const response = await s3Client.send(getCommand);

  // Convert stream to buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

// ============================================================================
// ElevenLabs API helpers
// ============================================================================

/**
 * Call ElevenLabs speech-to-text API
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} requestId - Request ID for filename
 * @param {string} extension - File extension
 * @param {string} modelId - 'scribe_v1' or 'scribe_v2'
 * @param {string} [childName] - Child's name as keyterm
 * @returns {Promise<Object>} ElevenLabs API response
 */
async function callElevenLabs(audioBuffer, requestId, extension, modelId, childName) {
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenLabsApiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  const contentType = CONTENT_TYPE_MAP[extension] || 'audio/m4a';

  const formData = new FormData();
  formData.append('file', audioBuffer, {
    filename: `${requestId}.${extension}`,
    contentType: contentType
  });
  formData.append('model_id', modelId);
  formData.append('diarize', 'true');
  formData.append('diarization_threshold', 0.1);
  formData.append('temperature', 0);
  formData.append('tag_audio_events', 'true');
  formData.append('timestamps_granularity', 'word');

  // Add child's name as keyterm to improve transcription accuracy
  if (childName) {
    formData.append('keyterms', childName);
  }

  const elevenLabsResponse = await fetch(
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

  if (!elevenLabsResponse.ok) {
    const errorData = await elevenLabsResponse.json().catch(() => ({}));
    throw new Error(errorData.detail?.message || `ElevenLabs API error (${modelId}): ${elevenLabsResponse.status}`);
  }

  return elevenLabsResponse.json();
}

/**
 * Legacy wrapper - calls ElevenLabs with scribe_v1
 */
async function transcribeWithElevenLabs(audioBuffer, requestId, extension, childName) {
  return callElevenLabs(audioBuffer, requestId, extension, 'scribe_v1', childName);
}

// ============================================================================
// Two-pass merge logic
// ============================================================================

/**
 * Find the closest v1 speaker for a given timestamp
 * @param {Array} v1Words - Filtered v1 words (no spacing)
 * @param {number} targetTime - Timestamp to match
 * @returns {string|null} Speaker ID
 */
function findSpeakerAtTime(v1Words, targetTime) {
  let bestMatch = null;
  let bestDistance = Infinity;

  for (const w of v1Words) {
    if (!w.speaker_id) continue;
    const midpoint = (w.start + w.end) / 2;
    const distance = Math.abs(midpoint - targetTime);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = w.speaker_id;
    }
  }

  return bestMatch;
}

/**
 * Assign a speaker to a v2 utterance using v1 word-level diarization (majority vote)
 * @param {Object} utterance - V2 utterance with start/end times
 * @param {Array} v1Words - Filtered v1 words (no spacing)
 * @returns {string} Speaker ID from v1
 */
function assignSpeakerToUtterance(utterance, v1Words) {
  const speakerTime = {};

  for (const w of v1Words) {
    if (!w.speaker_id) continue;
    const overlapStart = Math.max(w.start, utterance.start);
    const overlapEnd = Math.min(w.end, utterance.end);
    if (overlapStart < overlapEnd) {
      const duration = overlapEnd - overlapStart;
      speakerTime[w.speaker_id] = (speakerTime[w.speaker_id] || 0) + duration;
    }
  }

  // If no overlap found, fall back to nearest v1 word
  if (Object.keys(speakerTime).length === 0) {
    const mid = (utterance.start + utterance.end) / 2;
    return findSpeakerAtTime(v1Words, mid);
  }

  // Return speaker with most overlap time
  return Object.entries(speakerTime).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Two-pass transcription: v2 text quality + v1 3-speaker diarization
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} requestId - Request ID
 * @param {string} extension - File extension
 * @param {string} [childName] - Child's name as keyterm
 * @returns {Promise<{result: Object, utterances: Array}>} Merged result and utterances
 */
async function transcribeTwoPass(audioBuffer, requestId, extension, childName) {
  // Pass 1: scribe_v2 for high-quality text
  console.log(`🎤 [TWO-PASS] Pass 1: scribe_v2 (text quality)...`);
  const v2Result = await callElevenLabs(audioBuffer, requestId, extension, 'scribe_v2', childName);
  const v2Utterances = parseElevenLabsTranscript(v2Result);
  const v2Speakers = new Set(v2Utterances.map(u => u.speaker));
  console.log(`✅ [TWO-PASS] Pass 1 done: ${v2Utterances.length} utterances, ${v2Speakers.size} speakers`);

  // Pass 2: scribe_v1 for diarization
  console.log(`🎤 [TWO-PASS] Pass 2: scribe_v1 (diarization)...`);
  const v1Result = await callElevenLabs(audioBuffer, requestId, extension, 'scribe_v1', childName);
  const v1Words = v1Result.words.filter(w => w.type !== 'spacing');
  const v1Speakers = new Set(v1Words.map(w => w.speaker_id).filter(Boolean));
  console.log(`✅ [TWO-PASS] Pass 2 done: ${v1Words.length} words, ${v1Speakers.size} speakers`);

  // Merge: assign v1 speakers to v2 utterances (majority vote per utterance)
  console.log(`🎤 [TWO-PASS] Merging v2 text + v1 speakers...`);
  const mergedUtterances = v2Utterances.map(u => ({
    ...u,
    speaker: assignSpeakerToUtterance(u, v1Words)
  }));

  const mergedSpeakers = new Set(mergedUtterances.map(u => u.speaker));
  console.log(`✅ [TWO-PASS] Merged: ${mergedUtterances.length} utterances, ${mergedSpeakers.size} speakers`);

  // Return v2 raw result (for elevenLabsJson storage) and merged utterances
  return { result: v2Result, utterances: mergedUtterances };
}

// ============================================================================
// Main transcription entry point
// ============================================================================

/**
 * Transcribe recording helper function
 * Downloads audio from S3, transcribes with ElevenLabs, stores results
 *
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @param {string} storagePath - S3 path to audio file
 * @param {number} durationSeconds - Recording duration
 * @returns {Promise<{transcript: string, utterances: Array}>}
 */
async function transcribeRecording(sessionId, userId, storagePath, durationSeconds) {
  const mode = TRANSCRIPTION_MODE;
  console.log(`🎤 [TRANSCRIBE-START] Session ${sessionId.substring(0, 8)} - Mode: ${mode}`);
  console.log(`🎤 [TRANSCRIBE-START] Storage: ${storagePath}, User: ${userId.substring(0, 8)}`);

  // Fetch child's name from user for keyterms (decrypt since it's stored encrypted)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { childName: true }
  });
  const childName = user?.childName ? decryptSensitiveData(user.childName) : null;

  // Get audio file from S3
  let audioBuffer;
  try {
    audioBuffer = await downloadAudioFromS3(storagePath);
    console.log(`Retrieved audio from S3: ${audioBuffer.length} bytes`);
  } catch (s3Error) {
    console.error('S3 download error:', s3Error);
    throw new Error(`Failed to retrieve audio file: ${s3Error.message}`);
  }

  // Determine content type from storage path
  const extension = storagePath.split('.').pop();

  // Create anonymized request
  const requestId = await createAnonymizedRequest(
    userId,
    'elevenlabs',
    'transcription',
    { sessionId, audioSize: audioBuffer.length }
  );

  let utterances;
  let transcriptFormatted;

  try {
    if (mode === 'two-pass') {
      // Two-pass: v2 text + v1 diarization
      const { result, utterances: merged } = await transcribeTwoPass(audioBuffer, requestId, extension, childName);

      // Store raw v2 JSON
      await prisma.session.update({
        where: { id: sessionId },
        data: { elevenLabsJson: result }
      });
      console.log(`Raw ElevenLabs JSON (v2) stored for session ${sessionId}`);

      utterances = merged;

    } else {
      // Single-pass: v1 or v2
      const modelId = mode === 'v1' ? 'scribe_v1' : 'scribe_v2';
      console.log(`Sending to ElevenLabs (${modelId}) for transcription (request: ${requestId})...`);

      const result = await callElevenLabs(audioBuffer, requestId, extension, modelId, childName);
      console.log(`ElevenLabs transcription successful (${modelId})`);

      // Store raw JSON
      await prisma.session.update({
        where: { id: sessionId },
        data: { elevenLabsJson: result }
      });
      console.log(`Raw ElevenLabs JSON stored for session ${sessionId}`);

      // Parse into utterances
      utterances = parseElevenLabsTranscript(result);
    }

    if (utterances.length === 0) {
      throw new Error('No utterances parsed from ElevenLabs response');
    }

    // Format transcript for storage
    transcriptFormatted = formatUtterancesAsText(utterances);

    // Store formatted transcript and metadata
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        transcript: transcriptFormatted,
        transcribedAt: new Date(),
        transcriptionService: `elevenlabs-${mode}`
      }
    });

    // Create utterance records in database
    await createUtterances(sessionId, utterances);

    // Extract and insert silent slots (gaps >= 3 seconds)
    const silentSlotResult = await extractAndInsertSilentSlots(sessionId, utterances, {
      threshold: 3.0,
      recordingDuration: durationSeconds
    });

    console.log(`✅ [TRANSCRIBE-DONE] Session ${sessionId.substring(0, 8)} - Mode: ${mode}, ${utterances.length} utterances, ${silentSlotResult.count} silent slots`);

  } catch (transcriptionError) {
    console.error(`❌ [TRANSCRIBE-ERROR] Session ${sessionId.substring(0, 8)} - Transcription error:`, transcriptionError);
    console.error(`❌ [TRANSCRIBE-ERROR] Error stack:`, transcriptionError.stack);
    throw new Error(`Transcription failed: ${transcriptionError.message}`);
  }

  return {
    transcript: transcriptFormatted,
    utterances
  };
}

module.exports = {
  transcribeRecording,
  downloadAudioFromS3,
  transcribeWithElevenLabs,
  callElevenLabs,
  transcribeTwoPass,
  CONTENT_TYPE_MAP,
  TRANSCRIPTION_MODE
};
