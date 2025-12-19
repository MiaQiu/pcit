/**
 * Test Script for New ElevenLabs Flow
 * Tests the modified flow with actual audio file
 */

const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');
const { parseElevenLabsTranscript, formatUtterancesAsText } = require('./server/utils/parseElevenLabsTranscript.cjs');

require('dotenv').config();

async function testNewFlow() {
  console.log('=== Testing New ElevenLabs Flow ===\n');

  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not found');
  }

  // Read audio file
  const audioPath = '/Users/mia/nora/audio2_anya_mama_papa.m4a';
  const audioBuffer = fs.readFileSync(audioPath);
  console.log(`✓ Audio file loaded: ${audioBuffer.length} bytes\n`);

  // Step 1: Call ElevenLabs API
  console.log('Step 1: Calling ElevenLabs API...');
  const formData = new FormData();
  formData.append('file', audioBuffer, {
    filename: 'test.m4a',
    contentType: 'audio/x-m4a'
  });
  formData.append('model_id', 'scribe_v1');
  formData.append('diarize', 'true');
 //formData.append('num_speakers', '2');
  formData.append('timestamps_granularity', 'word');

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

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`ElevenLabs API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const result = await response.json();
  console.log(`✓ ElevenLabs response received\n`);

  // Step 2: Simulate storing raw JSON (in real code, this would be stored in DB)
  console.log('Step 2: Raw JSON would be stored in elevenLabsJson field');
  console.log(`  - Language: ${result.language_code}`);
  console.log(`  - Words count: ${result.words.length}`);
  console.log(`  - Text length: ${result.text.length} chars\n`);

  // Step 3: Parse using new utility
  console.log('Step 3: Parsing with new utility function...');
  const utterances = parseElevenLabsTranscript(result);
  console.log(`✓ Parsed ${utterances.length} utterances\n`);

  // Step 4: Format transcript
  console.log('Step 4: Formatting transcript...');
  const transcriptFormatted = formatUtterancesAsText(utterances);
  console.log('✓ Transcript formatted\n');

  // Display results
  console.log('=== RESULTS ===\n');
  console.log('Formatted Transcript (first 10 lines):');
  console.log(transcriptFormatted.split('\n').slice(0, 10).join('\n'));
  console.log('...\n');

  console.log('Utterances Summary:');
  const speakerCounts = {};
  utterances.forEach(utt => {
    speakerCounts[utt.speaker] = (speakerCounts[utt.speaker] || 0) + 1;
  });
  Object.entries(speakerCounts).forEach(([speaker, count]) => {
    console.log(`  ${speaker}: ${count} utterances`);
  });

  console.log('\nFirst 3 utterances (detailed):');
  utterances.slice(0, 3).forEach((utt, idx) => {
    console.log(`\n${idx + 1}. Speaker: ${utt.speaker}`);
    console.log(`   Time: ${utt.start.toFixed(2)}s - ${utt.end.toFixed(2)}s (${utt.duration}s)`);
    console.log(`   Text: "${utt.text}"`);
  });

  // Save outputs
  console.log('\n=== SAVING OUTPUTS ===\n');

  fs.writeFileSync(
    '/Users/mia/nora/test_new_flow_raw.json',
    JSON.stringify(result, null, 2)
  );
  console.log('✓ Raw JSON saved to: test_new_flow_raw.json');

  fs.writeFileSync(
    '/Users/mia/nora/test_new_flow_utterances.json',
    JSON.stringify({ utterances }, null, 2)
  );
  console.log('✓ Utterances saved to: test_new_flow_utterances.json');

  fs.writeFileSync(
    '/Users/mia/nora/test_new_flow_transcript.txt',
    transcriptFormatted
  );
  console.log('✓ Formatted transcript saved to: test_new_flow_transcript.txt');

  console.log('\n✓ Test completed successfully!');
}

testNewFlow()
  .then(() => {
    console.log('\n=== ALL TESTS PASSED ===');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n✗ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
