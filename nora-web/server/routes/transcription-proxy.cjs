/**
 * Transcription Proxy Routes - PDPA Compliant
 *
 * All transcription requests go through this proxy with:
 * - Anonymization (request_id instead of user_id)
 * - No client IP exposure to third parties
 * - Centralized audit logging
 * - API key security (keys never exposed to frontend)
 */

const express = require('express');
const fetch = require('node-fetch');
const FormData = require('form-data');
const { requireAuth } = require('../middleware/auth.cjs');
const { createAnonymizedRequest } = require('../utils/anonymization.cjs');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// API Keys from environment (backend only)
const API_KEYS = {
  elevenLabs: process.env.ELEVENLABS_API_KEY,
  deepgram: process.env.DEEPGRAM_API_KEY,
  assemblyAI: process.env.ASSEMBLYAI_API_KEY
};

/**
 * POST /api/transcription/elevenlabs
 * Anonymized proxy for ElevenLabs Scribe API
 */
router.post('/elevenlabs', async (req, res) => {
  try {
    const userId = req.userId;

    if (!API_KEYS.elevenLabs) {
      return res.status(503).json({ error: 'ElevenLabs service not configured' });
    }

    // Create anonymized request mapping
    const requestId = await createAnonymizedRequest(
      userId,
      'elevenlabs',
      'transcription',
      { audioSize: req.body.audioSize || 'unknown' }
    );

    // Get audio from request body (base64 or buffer)
    const { audioData } = req.body;
    if (!audioData) {
      return res.status(400).json({ error: 'No audio data provided' });
    }

    // Convert base64 to buffer if needed
    const audioBuffer = Buffer.isBuffer(audioData)
      ? audioData
      : Buffer.from(audioData, 'base64');

    // Prepare form data for ElevenLabs
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: `${requestId}.webm`,
      contentType: 'audio/webm'
    });
    formData.append('model_id', 'scribe_v1');
    formData.append('diarize', 'true');
    formData.append('diarization_threshold', '0.1');  // Auto-detect speakers with 0.1 threshold
    formData.append('temperature', '0');              // Use temperature=0 for maximum accuracy
    formData.append('timestamps_granularity', 'word');

    // Forward to ElevenLabs (NO user metadata)
    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text?include_timestamps=true', {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEYS.elevenLabs,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[PROXY] ElevenLabs error for ${requestId}:`, errorData);
      return res.status(response.status).json({
        error: errorData.detail?.message || 'Transcription failed'
      });
    }

    const result = await response.json();
    console.log(`[PROXY] ElevenLabs success for ${requestId}`);

    // Return result (no user info in logs or response)
    res.json(result);

  } catch (error) {
    console.error('[PROXY] ElevenLabs proxy error:', error);
    res.status(500).json({ error: 'Transcription proxy failed' });
  }
});

/**
 * POST /api/transcription/deepgram
 * Anonymized proxy for Deepgram Nova-2 API
 */
router.post('/deepgram', async (req, res) => {
  try {
    const userId = req.userId;

    if (!API_KEYS.deepgram) {
      return res.status(503).json({ error: 'Deepgram service not configured' });
    }

    // Create anonymized request mapping
    const requestId = await createAnonymizedRequest(
      userId,
      'deepgram',
      'transcription',
      { audioSize: req.body.audioSize || 'unknown' }
    );

    // Get audio from request body
    const { audioData, contentType = 'audio/webm' } = req.body;
    if (!audioData) {
      return res.status(400).json({ error: 'No audio data provided' });
    }

    const audioBuffer = Buffer.isBuffer(audioData)
      ? audioData
      : Buffer.from(audioData, 'base64');

    // Forward to Deepgram (NO user metadata)
    const response = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&punctuate=true&utterances=true&multichannel=false',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${API_KEYS.deepgram}`,
          'Content-Type': contentType
        },
        body: audioBuffer
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[PROXY] Deepgram error for ${requestId}:`, errorData);
      return res.status(response.status).json({
        error: errorData.err_msg || 'Transcription failed'
      });
    }

    const result = await response.json();
    console.log(`[PROXY] Deepgram success for ${requestId}`);

    res.json(result);

  } catch (error) {
    console.error('[PROXY] Deepgram proxy error:', error);
    res.status(500).json({ error: 'Transcription proxy failed' });
  }
});

/**
 * POST /api/transcription/assemblyai
 * Anonymized proxy for AssemblyAI API
 */
router.post('/assemblyai', async (req, res) => {
  try {
    const userId = req.userId;

    if (!API_KEYS.assemblyAI) {
      return res.status(503).json({ error: 'AssemblyAI service not configured' });
    }

    // Create anonymized request mapping
    const requestId = await createAnonymizedRequest(
      userId,
      'assemblyai',
      'transcription',
      { audioSize: req.body.audioSize || 'unknown' }
    );

    // Get audio from request body
    const { audioData } = req.body;
    if (!audioData) {
      return res.status(400).json({ error: 'No audio data provided' });
    }

    const audioBuffer = Buffer.isBuffer(audioData)
      ? audioData
      : Buffer.from(audioData, 'base64');

    // Step 1: Upload audio
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': API_KEYS.assemblyAI,
        'Content-Type': 'application/octet-stream'
      },
      body: audioBuffer
    });

    if (!uploadResponse.ok) {
      console.error(`[PROXY] AssemblyAI upload error for ${requestId}`);
      return res.status(uploadResponse.status).json({ error: 'Upload failed' });
    }

    const { upload_url } = await uploadResponse.json();

    // Step 2: Request transcription
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': API_KEYS.assemblyAI,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: upload_url,
        speaker_labels: true,
        speakers_expected: 2
      })
    });

    if (!transcriptResponse.ok) {
      console.error(`[PROXY] AssemblyAI transcription error for ${requestId}`);
      return res.status(transcriptResponse.status).json({ error: 'Transcription request failed' });
    }

    const { id } = await transcriptResponse.json();
    console.log(`[PROXY] AssemblyAI transcription started for ${requestId}, job: ${id}`);

    // Return job ID for client to poll
    res.json({ transcription_id: id, requestId });

  } catch (error) {
    console.error('[PROXY] AssemblyAI proxy error:', error);
    res.status(500).json({ error: 'Transcription proxy failed' });
  }
});

/**
 * GET /api/transcription/assemblyai/:id
 * Poll AssemblyAI transcription status
 */
router.get('/assemblyai/:id', async (req, res) => {
  try {
    if (!API_KEYS.assemblyAI) {
      return res.status(503).json({ error: 'AssemblyAI service not configured' });
    }

    const { id } = req.params;

    const response = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { 'Authorization': API_KEYS.assemblyAI }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Poll request failed' });
    }

    const result = await response.json();
    res.json(result);

  } catch (error) {
    console.error('[PROXY] AssemblyAI poll error:', error);
    res.status(500).json({ error: 'Poll failed' });
  }
});

/**
 * GET /api/transcription/health
 * Check which transcription services are available
 */
router.get('/health', (req, res) => {
  const services = {
    elevenlabs: !!API_KEYS.elevenLabs,
    deepgram: !!API_KEYS.deepgram,
    assemblyai: !!API_KEYS.assemblyAI
  };

  const available = Object.values(services).filter(Boolean).length;

  res.json({
    status: available > 0 ? 'ok' : 'unavailable',
    services,
    available,
    anonymization: 'enabled'
  });
});

module.exports = router;
