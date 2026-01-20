/**
 * Transcription Service
 * Handles audio transcription using ElevenLabs
 */
const fetch = require('node-fetch');
const FormData = require('form-data');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const prisma = require('./db.cjs');
const { createAnonymizedRequest } = require('../utils/anonymization.cjs');
const { createUtterances } = require('../utils/utteranceUtils.cjs');
const { parseElevenLabsTranscript, formatUtterancesAsText } = require('../utils/parseElevenLabsTranscript.cjs');

// S3 Client for downloading audio files
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const s3Client = new S3Client({ region: AWS_REGION });
const S3_BUCKET = process.env.AWS_S3_BUCKET;

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

/**
 * Transcribe audio using ElevenLabs
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} requestId - Anonymized request ID for logging
 * @param {string} extension - File extension
 * @returns {Promise<Object>} ElevenLabs transcription result
 */
async function transcribeWithElevenLabs(audioBuffer, requestId, extension) {
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenLabsApiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  const contentType = CONTENT_TYPE_MAP[extension] || 'audio/m4a';

  // Prepare form data for ElevenLabs
  const formData = new FormData();
  formData.append('file', audioBuffer, {
    filename: `${requestId}.${extension}`,
    contentType: contentType
  });
  formData.append('model_id', 'scribe_v2');
  formData.append('diarize', 'true');
  formData.append('diarization_threshold', 0.1);
  formData.append('temperature', 0);
  formData.append('tag_audio_events', 'false');
  formData.append('timestamps_granularity', 'word');

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
    throw new Error(errorData.detail?.message || `ElevenLabs API error: ${elevenLabsResponse.status}`);
  }

  return elevenLabsResponse.json();
}

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
  console.log(`🎤 [TRANSCRIBE-START] Session ${sessionId.substring(0, 8)} - Starting background transcription`);
  console.log(`🎤 [TRANSCRIBE-START] Storage: ${storagePath}, User: ${userId.substring(0, 8)}`);

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

  // Transcribe with ElevenLabs
  let utterances;
  let transcriptFormatted;

  try {
    console.log(`Sending to ElevenLabs for transcription (request: ${requestId})...`);

    const result = await transcribeWithElevenLabs(audioBuffer, requestId, extension);

    console.log('ElevenLabs transcription successful');

    // STEP 1: Store raw ElevenLabs JSON in database
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        elevenLabsJson: result
      }
    });
    console.log(`Raw ElevenLabs JSON stored for session ${sessionId}`);

    // STEP 2: Parse JSON into utterances using utility function
    utterances = parseElevenLabsTranscript(result);

    if (utterances.length === 0) {
      throw new Error('No utterances parsed from ElevenLabs response');
    }

    // STEP 3: Format transcript for storage
    transcriptFormatted = formatUtterancesAsText(utterances);

    // Store formatted transcript and metadata
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        transcript: transcriptFormatted,
        transcribedAt: new Date(),
        transcriptionService: 'elevenlabs'
      }
    });

    // STEP 4: Create utterance records in database
    await createUtterances(sessionId, utterances);

    console.log(`✅ [TRANSCRIBE-DONE] Session ${sessionId.substring(0, 8)} - Formatted transcript and ${utterances.length} utterances stored`);

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
  CONTENT_TYPE_MAP
};
