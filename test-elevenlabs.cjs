/**
 * Test ElevenLabs Speech-to-Text API
 */
const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');
require('dotenv').config();

async function testElevenLabs() {
  try {
    // Read audio file
    const audioPath = '/Users/mia/nora/nora-mobile/calm_or_talk.mp3';
    console.log(`Reading audio file: ${audioPath}`);

    const audioBuffer = fs.readFileSync(audioPath);
    console.log(`Audio file size: ${audioBuffer.length} bytes`);

    // Get API key
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      throw new Error('ELEVENLABS_API_KEY not found in .env file');
    }
    console.log('API key found ✓');

    // Prepare form data
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: 'test.mp3',
      contentType: 'audio/mpeg'
    });
    formData.append('model_id', 'scribe_v1');
    formData.append('diarize', 'true');
    formData.append('diarization_threshold', 0.1);
    formData.append('temperature', 0);
    formData.append('tag_audio_events', 'false');
    formData.append('timestamps_granularity', 'word');

    console.log('\nSending request to ElevenLabs API...');
    console.log('Parameters:');
    console.log('  - model_id: scribe_v1');
    console.log('  - diarize: true');
    console.log('  - diarization_threshold: 0.1');
    console.log('  - temperature: 0');
    console.log('  - tag_audio_events: false');
    console.log('  - timestamps_granularity: word');

    const startTime = Date.now();

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

    const duration = Date.now() - startTime;
    console.log(`\nResponse received in ${duration}ms`);
    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('\n❌ Error Response:');
      console.error(errorText);
      return;
    }

    const result = await response.json();

    console.log('\n✅ SUCCESS!\n');
    console.log('Response structure:');
    console.log(JSON.stringify(result, null, 2));

    // Parse and display utterances
    if (result.utterances && result.utterances.length > 0) {
      console.log('\n📝 Utterances found:', result.utterances.length);
      console.log('\nFirst 5 utterances:');
      result.utterances.slice(0, 5).forEach((utt, idx) => {
        console.log(`\n[${idx + 1}] Speaker ${utt.speaker_id}`);
        console.log(`    Time: ${utt.start_time.toFixed(2)}s - ${utt.end_time.toFixed(2)}s`);
        console.log(`    Text: "${utt.text}"`);
      });
    }

    // Display full transcript
    if (result.text) {
      console.log('\n📄 Full Transcript:');
      console.log(result.text);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testElevenLabs();
