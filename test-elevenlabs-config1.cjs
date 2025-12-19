/**
 * Test ElevenLabs API Configuration 1
 * WITHOUT num_speakers parameter
 */

const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');
require('dotenv').config();

async function testElevenLabsConfig1() {
  console.log('=== Testing ElevenLabs API Configuration 1 ===');
  console.log('Configuration: WITHOUT num_speakers parameter\n');

  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not found in environment');
  }

  // Read audio file
  const audioPath = '/Users/mia/nora/audio2_anya_mama_papa.m4a';
  const audioBuffer = fs.readFileSync(audioPath);
  console.log(`Audio file loaded: ${audioBuffer.length} bytes\n`);

  // Prepare form data WITHOUT num_speakers
  const formData = new FormData();
  formData.append('file', audioBuffer, {
    filename: 'audio2_anya_mama_papa.m4a',
    contentType: 'audio/x-m4a'
  });
  formData.append('model_id', 'scribe_v1');
  formData.append('diarize', 'true');
  // NOT setting num_speakers - this is the key difference
  formData.append('timestamps_granularity', 'word');

  console.log('Sending request to ElevenLabs...');
  console.log('Parameters:');
  console.log('  - model_id: scribe_v1');
  console.log('  - diarize: true');
  console.log('  - num_speakers: NOT SET (auto-detect)');
  console.log('  - timestamps_granularity: word\n');

  const startTime = Date.now();

  // Call ElevenLabs API
  const response = await fetch(
    'https://api.elevenlabs.io/v1/speech-to-text?include_timestamps=true',
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        ...formData.getHeaders()
      },
      body: formData
    }
  );

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`ElevenLabs API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const result = await response.json();

  console.log(`✓ Request completed in ${duration}s\n`);
  console.log('=== RESULTS ===\n');

  // Analyze results
  console.log(`Full Transcript Text:`);
  console.log(`"${result.text}"\n`);

  if (result.words && result.words.length > 0) {
    // Count speakers
    const speakers = new Set(result.words.map(w => w.speaker_id));
    console.log(`Number of speakers detected: ${speakers.size}`);
    console.log(`Speakers: ${Array.from(speakers).join(', ')}\n`);

    // Count words per speaker
    const speakerCounts = {};
    result.words.forEach(word => {
      speakerCounts[word.speaker_id] = (speakerCounts[word.speaker_id] || 0) + 1;
    });

    console.log('Words per speaker:');
    Object.entries(speakerCounts).forEach(([speaker, count]) => {
      console.log(`  ${speaker}: ${count} words`);
    });
    console.log();

    // Group words by speaker into utterances
    console.log('=== TRANSCRIPT BY SPEAKER ===\n');

    const parseSpeakerId = (speakerId) => {
      if (!speakerId) return 0;
      const match = speakerId.match(/speaker_(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };

    let currentUtterance = {
      speaker: result.words[0].speaker_id,
      speakerNum: parseSpeakerId(result.words[0].speaker_id),
      text: '',
      start: result.words[0].start,
      end: result.words[0].end,
    };

    const utterances = [];

    for (const word of result.words) {
      if (word.speaker_id === currentUtterance.speaker) {
        currentUtterance.text += (currentUtterance.text ? ' ' : '') + word.text;
        currentUtterance.end = word.end;
      } else {
        if (currentUtterance.text) {
          utterances.push(currentUtterance);
        }
        currentUtterance = {
          speaker: word.speaker_id,
          speakerNum: parseSpeakerId(word.speaker_id),
          text: word.text,
          start: word.start,
          end: word.end,
        };
      }
    }

    if (currentUtterance.text) {
      utterances.push(currentUtterance);
    }

    // Display utterances
    utterances.forEach((utt, idx) => {
      const timestamp = `[${utt.start.toFixed(2)}s - ${utt.end.toFixed(2)}s]`;
      console.log(`${idx + 1}. Speaker ${utt.speakerNum} ${timestamp}:`);
      console.log(`   "${utt.text}"\n`);
    });

    console.log(`Total utterances: ${utterances.length}`);
    console.log(`Total words: ${result.words.length}`);
  } else {
    console.log('No word-level data returned');
  }

  // Save full response to file for inspection
  fs.writeFileSync(
    '/Users/mia/nora/elevenlabs-config1-output.json',
    JSON.stringify(result, null, 2)
  );
  console.log('\nFull response saved to: elevenlabs-config1-output.json');
}

// Run test
testElevenLabsConfig1()
  .then(() => {
    console.log('\n✓ Test completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n✗ Test failed:', err.message);
    process.exit(1);
  });
