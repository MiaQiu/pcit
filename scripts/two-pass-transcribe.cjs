/**
 * Two-pass transcription: scribe_v2 quality + scribe_v1 diarization
 *
 * Pass 1: scribe_v2 for high-quality text + timestamps
 * Pass 2: scribe_v1 for 3-speaker diarization
 * Merge: Map v1 speaker IDs onto v2 words by closest timestamp
 */
require('dotenv').config();

const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

async function callElevenLabs(audioBuffer, modelId) {
  const formData = new FormData();
  formData.append('file', audioBuffer, { filename: 'audio.m4a', contentType: 'audio/x-m4a' });
  formData.append('model_id', modelId);
  formData.append('diarize', 'true');
  formData.append('diarization_threshold', 0.1);
  formData.append('temperature', 0);
  formData.append('tag_audio_events', 'true');
  formData.append('timestamps_granularity', 'word');

  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text?include_timestamps=true', {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, ...formData.getHeaders() },
    body: formData
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${modelId} API error: ${err}`);
  }

  return response.json();
}

/**
 * Find the closest v1 speaker for a given timestamp using binary search
 */
function findSpeakerAtTime(v1Words, targetTime) {
  // Filter to actual words with speaker IDs
  let bestMatch = null;
  let bestDistance = Infinity;

  for (const w of v1Words) {
    if (w.type === 'spacing' || !w.speaker_id) continue;

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
 * Merge v2 text with v1 speaker assignments
 * Word-level merge: assigns v1 speaker to each v2 word
 */
function mergeResultsWordLevel(v2Result, v1Result) {
  const v1Words = v1Result.words.filter(w => w.type !== 'spacing');
  const v2Words = v2Result.words;

  const mergedWords = v2Words.map(word => {
    if (word.type === 'spacing') return word;

    const midpoint = (word.start + word.end) / 2;
    const speaker = findSpeakerAtTime(v1Words, midpoint);

    return {
      ...word,
      speaker_id: speaker || word.speaker_id
    };
  });

  return { ...v2Result, words: mergedWords };
}

/**
 * Utterance-level merge: keep v2 utterance boundaries, assign v1 majority speaker
 * For each v2 utterance time range, find which v1 speaker dominates that range
 */
function assignSpeakerToUtterance(utterance, v1Words) {
  const speakerTime = {};

  for (const w of v1Words) {
    if (!w.speaker_id) continue;
    // Check if v1 word overlaps with utterance time range
    const overlapStart = Math.max(w.start, utterance.start);
    const overlapEnd = Math.min(w.end, utterance.end);
    if (overlapStart < overlapEnd) {
      const duration = overlapEnd - overlapStart;
      speakerTime[w.speaker_id] = (speakerTime[w.speaker_id] || 0) + duration;
    }
  }

  // If no overlap found, try nearest v1 word
  if (Object.keys(speakerTime).length === 0) {
    const mid = (utterance.start + utterance.end) / 2;
    return findSpeakerAtTime(v1Words, mid);
  }

  // Return speaker with most overlap time
  return Object.entries(speakerTime).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Parse merged result into utterances (same logic as parseElevenLabsTranscript)
 */
function parseToUtterances(result) {
  const words = result.words;
  const utterances = [];

  let current = { speaker: null, text: '', start: null, end: null };

  for (const word of words) {
    if (word.type === 'spacing') continue;

    if (current.speaker === null) {
      current.speaker = word.speaker_id;
      current.start = word.start;
    }

    // Speaker change -> save current, start new
    if (word.speaker_id !== current.speaker && current.text.trim()) {
      current.end = word.start;
      utterances.push({ ...current });
      current = { speaker: word.speaker_id, text: '', start: word.start, end: null };
    }

    current.text += (current.text ? ' ' : '') + word.text;
    current.end = word.end;

    // Sentence boundary
    if (/[。！？\.\!\?]$/.test(word.text) && current.text.trim()) {
      utterances.push({ ...current });
      current = { speaker: null, text: '', start: null, end: null };
    }
  }

  if (current.text.trim()) {
    utterances.push(current);
  }

  // Remove parentheses content and filter empty
  return utterances
    .map(u => ({
      ...u,
      text: u.text.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
    }))
    .filter(u => u.text.length > 0);
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node two-pass-transcribe.cjs <audio-file-path>');
    process.exit(1);
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('ELEVENLABS_API_KEY not set');
    process.exit(1);
  }

  console.log('📥 Reading:', filePath);
  const audioBuffer = fs.readFileSync(filePath);
  console.log('File size:', audioBuffer.length, 'bytes\n');

  // Pass 1: scribe_v2 for quality
  console.log('━'.repeat(80));
  console.log('PASS 1: scribe_v2 (high-quality transcription)');
  console.log('━'.repeat(80));
  const v2Result = await callElevenLabs(audioBuffer, 'scribe_v2');
  const v2Words = v2Result.words.filter(w => w.type !== 'spacing');
  const v2Speakers = new Set(v2Words.map(w => w.speaker_id).filter(Boolean));
  console.log(`✅ ${v2Words.length} words, ${v2Speakers.size} speakers\n`);

  // Pass 2: scribe_v1 for diarization
  console.log('━'.repeat(80));
  console.log('PASS 2: scribe_v1 (3-speaker diarization)');
  console.log('━'.repeat(80));
  const v1Result = await callElevenLabs(audioBuffer, 'scribe_v1');
  const v1Words = v1Result.words.filter(w => w.type !== 'spacing');
  const v1Speakers = new Set(v1Words.map(w => w.speaker_id).filter(Boolean));
  console.log(`✅ ${v1Words.length} words, ${v1Speakers.size} speakers\n`);

  // Build v2 utterances first (clean boundaries)
  const v2Utterances = parseToUtterances(v2Result);
  const v1FilteredWords = v1Result.words.filter(w => w.type !== 'spacing');

  // Utterance-level merge: keep v2 utterances, assign v1 speakers
  const mergedUtterances = v2Utterances.map(u => ({
    ...u,
    speaker: assignSpeakerToUtterance(u, v1FilteredWords)
  }));

  const mergedSpeakers = new Set(mergedUtterances.map(u => u.speaker));
  console.log('━'.repeat(80));
  console.log('MERGING: v2 utterances + v1 speaker (majority vote per utterance)');
  console.log('━'.repeat(80));
  console.log(`✅ ${mergedUtterances.length} utterances, ${mergedSpeakers.size} speakers\n`);

  // --- Merged ---
  console.log('='.repeat(80));
  console.log(`MERGED: V2 TEXT + V1 SPEAKERS (${mergedUtterances.length} utterances, ${mergedSpeakers.size} speakers)`);
  console.log('='.repeat(80));
  mergedUtterances.forEach((u, i) => {
    console.log(`[${String(i).padStart(3, '0')}] ${u.speaker} [${u.start.toFixed(1)}s - ${u.end.toFixed(1)}s]: ${u.text}`);
  });

  console.log('='.repeat(80));
  console.log('Speakers:', Array.from(mergedSpeakers).join(', '));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
