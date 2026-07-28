'use strict';

/**
 * Text-to-Speech Service
 * Generates lesson narration audio from contentV2 text using ElevenLabs TTS.
 * Companion to transcriptionService.cjs (which goes the other direction:
 * audio -> text via ElevenLabs Speech-to-Text for the manual admin upload flow).
 *
 * Word timings are derived from exact character offsets computed by
 * buildNarrationPlan() (server/utils/lessonContentTokenizer.cjs), which mirrors
 * the mobile app's own word tokenization character-for-character. This
 * guarantees wordTimings.length always matches the word count the client
 * computes for display/highlighting -- required for word-by-word highlighting
 * to engage at all (LiveScriptCard.tsx falls back to a crude position/duration
 * estimate for the whole lesson on any count mismatch).
 *
 * Offsets are tracked in Unicode CODEPOINTS, not JS string (UTF-16) units --
 * ElevenLabs' alignment arrays return one entry per codepoint (an emoji is 1
 * entry there but 2 JS string units), so mixing the two indexing schemes
 * silently misaligns every word timing after the first surrogate-pair
 * character. See tokenizeCodepoints() in lessonContentTokenizer.cjs.
 */
const fetch = require('node-fetch');
const { buildNarrationPlan } = require('../utils/lessonContentTokenizer.cjs');

const MODEL_ID = 'eleven_v3';
const RETRY_DELAYS_MS = [0, 5000, 15000];
const MAX_CHUNK_CHARS = 4000;
const DEFAULT_VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0, speed: 1, use_speaker_boost: true };

// Voice settings saved on a voice (in the ElevenLabs dashboard/web app) are
// per-voice, not generic -- using hardcoded defaults instead of a voice's own
// saved settings can produce a noticeably different (worse) result than what
// the ElevenLabs web Speech Synthesis studio produces for that same voice.
const voiceSettingsCache = new Map();

async function getVoiceSettings(voiceId) {
  if (voiceSettingsCache.has(voiceId)) {
    return voiceSettingsCache.get(voiceId);
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}/settings`, {
      headers: { 'xi-api-key': apiKey },
    });
    if (!response.ok) {
      console.warn(`Could not fetch saved settings for voice ${voiceId} (${response.status}), using defaults`);
      voiceSettingsCache.set(voiceId, DEFAULT_VOICE_SETTINGS);
      return DEFAULT_VOICE_SETTINGS;
    }
    const settings = await response.json();
    voiceSettingsCache.set(voiceId, settings);
    return settings;
  } catch (err) {
    console.warn(`Error fetching saved settings for voice ${voiceId}: ${err.message}, using defaults`);
    voiceSettingsCache.set(voiceId, DEFAULT_VOICE_SETTINGS);
    return DEFAULT_VOICE_SETTINGS;
  }
}

async function callElevenLabsTTS(text, voiceId) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  const voiceSettings = await getVoiceSettings(voiceId);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: voiceSettings,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail?.message || `ElevenLabs TTS error: ${response.status}`);
  }

  return response.json();
}

async function callElevenLabsTTSWithRetry(text, voiceId) {
  let lastError;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    if (RETRY_DELAYS_MS[attempt] > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
    try {
      return await callElevenLabsTTS(text, voiceId);
    } catch (err) {
      lastError = err;
      console.error(`ElevenLabs TTS attempt ${attempt + 1} failed: ${err.message}`);
    }
  }
  throw lastError;
}

/**
 * Generate narration audio + word timings for lesson contentV2 via ElevenLabs TTS.
 * @param {string} contentV2 - raw lesson content markup (not pre-stripped)
 * @param {string} voiceId - ElevenLabs voice_id
 * @returns {Promise<{ audioBuffer: Buffer, wordTimings: Array<{text: string, start: number, end: number}>, durationSeconds: number }>}
 */
async function generateLessonNarration(contentV2, voiceId) {
  const chunks = buildNarrationPlan(contentV2, MAX_CHUNK_CHARS);
  if (chunks.length === 0) {
    return { audioBuffer: Buffer.alloc(0), wordTimings: [], durationSeconds: 0 };
  }

  const audioBuffers = [];
  const wordTimings = [];
  let timeOffset = 0;

  for (const chunk of chunks) {
    const result = await callElevenLabsTTSWithRetry(chunk.text, voiceId);
    audioBuffers.push(Buffer.from(result.audio_base64, 'base64'));

    const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } = result.alignment;
    const chunkCodepoints = Array.from(chunk.text);
    if (characters.length !== chunkCodepoints.length) {
      throw new Error(
        `ElevenLabs alignment length (${characters.length}) does not match sent text length (${chunkCodepoints.length} codepoints) -- word timing offsets would be wrong`
      );
    }

    for (const w of chunk.words) {
      wordTimings.push({
        text: chunkCodepoints.slice(w.start, w.end).join(''),
        start: starts[w.start] + timeOffset,
        end: ends[w.end - 1] + timeOffset,
      });
    }

    timeOffset += ends[characters.length - 1];
  }

  const durationSeconds = wordTimings.length > 0 ? Math.floor(wordTimings[wordTimings.length - 1].end) : 0;

  return {
    audioBuffer: Buffer.concat(audioBuffers),
    wordTimings,
    durationSeconds,
  };
}

module.exports = {
  generateLessonNarration,
};
