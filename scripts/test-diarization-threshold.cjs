/**
 * Test Diarization Threshold Script
 * Tests different diarization_threshold values to find the best one for identifying 3 speakers
 */
require('dotenv').config();
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const AUDIO_FILE = '/Users/yihui/Downloads/bobby_vitamin.m4a';

// Thresholds to test
// Lower values = more aggressive speaker separation (more speakers)
// Higher values = less aggressive (fewer speakers)
const THRESHOLDS_TO_TEST = [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4];

// Model to use
const MODEL_ID = 'scribe_v1';

/**
 * Transcribe audio with a specific diarization threshold
 */
async function transcribeWithThreshold(audioBuffer, threshold) {
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenLabsApiKey) {
    throw new Error('ELEVENLABS_API_KEY not set in environment');
  }

  const formData = new FormData();
  formData.append('file', audioBuffer, {
    filename: 'test_audio.m4a',
    contentType: 'audio/x-m4a'
  });
  formData.append('model_id', MODEL_ID);
  formData.append('diarize', 'true');
  formData.append('diarization_threshold', threshold);
  formData.append('temperature', 0);
  formData.append('tag_audio_events', 'true');
  formData.append('timestamps_granularity', 'word');

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
 * Count unique speakers from ElevenLabs response
 */
function countSpeakers(result) {
  const speakers = new Set();

  if (result.words) {
    for (const word of result.words) {
      if (word.speaker_id) {
        speakers.add(word.speaker_id);
      }
    }
  }

  return {
    count: speakers.size,
    speakers: Array.from(speakers).sort()
  };
}

/**
 * Get speaker distribution (utterances per speaker)
 */
function getSpeakerDistribution(result) {
  const distribution = {};

  if (result.words) {
    let currentSpeaker = null;
    let utteranceCount = 0;

    for (const word of result.words) {
      if (word.speaker_id && word.speaker_id !== currentSpeaker) {
        currentSpeaker = word.speaker_id;
        distribution[currentSpeaker] = (distribution[currentSpeaker] || 0) + 1;
      }
    }
  }

  return distribution;
}

/**
 * Get sample utterances for each speaker
 */
function getSampleUtterances(result, maxSamplesPerSpeaker = 2) {
  const samples = {};
  const currentUtterance = {};
  let lastSpeaker = null;

  if (result.words) {
    for (const word of result.words) {
      const speaker = word.speaker_id;
      if (!speaker) continue;

      if (speaker !== lastSpeaker) {
        // Save previous utterance
        if (lastSpeaker && currentUtterance[lastSpeaker]) {
          if (!samples[lastSpeaker]) samples[lastSpeaker] = [];
          if (samples[lastSpeaker].length < maxSamplesPerSpeaker) {
            samples[lastSpeaker].push(currentUtterance[lastSpeaker].trim());
          }
        }
        currentUtterance[speaker] = '';
        lastSpeaker = speaker;
      }

      currentUtterance[speaker] = (currentUtterance[speaker] || '') + word.text + ' ';
    }

    // Don't forget the last utterance
    if (lastSpeaker && currentUtterance[lastSpeaker]) {
      if (!samples[lastSpeaker]) samples[lastSpeaker] = [];
      if (samples[lastSpeaker].length < maxSamplesPerSpeaker) {
        samples[lastSpeaker].push(currentUtterance[lastSpeaker].trim());
      }
    }
  }

  return samples;
}

async function main() {
  console.log('='.repeat(80));
  console.log('Diarization Threshold Test');
  console.log('Model:', MODEL_ID);
  console.log('Target: 3 speakers (anya, mama, papa)');
  console.log('Audio file:', AUDIO_FILE);
  console.log('='.repeat(80));
  console.log('');

  // Read audio file
  if (!fs.existsSync(AUDIO_FILE)) {
    console.error(`Audio file not found: ${AUDIO_FILE}`);
    process.exit(1);
  }

  const audioBuffer = fs.readFileSync(AUDIO_FILE);
  console.log(`Audio file size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);
  console.log('');

  const results = [];

  for (const threshold of THRESHOLDS_TO_TEST) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Testing threshold: ${threshold}`);
    console.log('─'.repeat(60));

    try {
      const result = await transcribeWithThreshold(audioBuffer, threshold);
      const speakerInfo = countSpeakers(result);
      const distribution = getSpeakerDistribution(result);
      const samples = getSampleUtterances(result);

      const isTarget = speakerInfo.count === 3;
      const marker = isTarget ? '✅ TARGET MATCH!' : '';

      console.log(`Speakers found: ${speakerInfo.count} ${marker}`);
      console.log(`Speaker IDs: ${speakerInfo.speakers.join(', ')}`);
      console.log(`Distribution (turn changes per speaker):`, distribution);

      console.log('\nSample utterances per speaker:');
      for (const [speaker, utterances] of Object.entries(samples)) {
        console.log(`  ${speaker}:`);
        for (const utt of utterances) {
          console.log(`    - "${utt.substring(0, 80)}${utt.length > 80 ? '...' : ''}"`);
        }
      }

      results.push({
        threshold,
        speakerCount: speakerInfo.count,
        speakers: speakerInfo.speakers,
        distribution,
        samples,
        isTarget
      });

    } catch (error) {
      console.error(`Error with threshold ${threshold}:`, error.message);
      results.push({
        threshold,
        error: error.message
      });
    }

    // Small delay between API calls to be nice to the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log('\nThreshold | Speakers | Match | Speaker IDs');
  console.log('-'.repeat(60));

  for (const r of results) {
    if (r.error) {
      console.log(`${r.threshold.toFixed(2).padStart(9)} | ERROR: ${r.error}`);
    } else {
      const match = r.isTarget ? '✅' : '❌';
      console.log(`${r.threshold.toFixed(2).padStart(9)} | ${r.speakerCount.toString().padStart(8)} | ${match.padStart(5)} | ${r.speakers.join(', ')}`);
    }
  }

  const matchingThresholds = results.filter(r => r.isTarget);
  if (matchingThresholds.length > 0) {
    console.log('\n✅ Thresholds that correctly identify 3 speakers:');
    for (const r of matchingThresholds) {
      console.log(`   - ${r.threshold}`);
    }
    console.log(`\nRecommended: ${matchingThresholds[0].threshold} (first match)`);
  } else {
    console.log('\n❌ No threshold found that identifies exactly 3 speakers');
    console.log('Consider trying additional threshold values or checking the audio quality');
  }
}

main().catch(console.error);
