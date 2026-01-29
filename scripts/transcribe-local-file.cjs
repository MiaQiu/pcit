require('dotenv').config();

const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const { parseElevenLabsTranscript } = require('../server/utils/parseElevenLabsTranscript.cjs');

async function main() {
  const filePath = process.argv[2];
  const modelId = process.argv[3] || 'scribe_v2';

  if (!filePath) {
    console.error('Usage: node transcribe-local-file.cjs <audio-file-path> [model_id]');
    console.error('  model_id: scribe_v1 or scribe_v2 (default: scribe_v2)');
    process.exit(1);
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('ELEVENLABS_API_KEY not set in environment');
    process.exit(1);
  }

  console.log('📥 Reading local file:', filePath);
  const audioBuffer = fs.readFileSync(filePath);
  console.log('File size:', audioBuffer.length, 'bytes');
  console.log('Model:', modelId);

  const formData = new FormData();
  formData.append('file', audioBuffer, { filename: 'audio.m4a', contentType: 'audio/x-m4a' });
  formData.append('model_id', modelId);
  formData.append('diarize', 'true');
  formData.append('diarization_threshold', 0.1);
  formData.append('temperature', 0);
  formData.append('tag_audio_events', 'true');
  formData.append('timestamps_granularity', 'word');

  console.log('📤 Calling ElevenLabs...');
  const apiResponse = await fetch('https://api.elevenlabs.io/v1/speech-to-text?include_timestamps=true', {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, ...formData.getHeaders() },
    body: formData
  });

  if (!apiResponse.ok) {
    const err = await apiResponse.text();
    throw new Error('API error: ' + err);
  }

  const result = await apiResponse.json();
  console.log('✅ Done. Words:', result.words?.length);

  const utterances = parseElevenLabsTranscript(result);
  console.log('');
  console.log('='.repeat(80));
  console.log(`TRANSCRIPT (${modelId})`);
  console.log('='.repeat(80));

  utterances.forEach((u, i) => {
    console.log('[' + String(i).padStart(3, '0') + '] ' + u.speaker + ' [' + u.start.toFixed(1) + 's - ' + u.end.toFixed(1) + 's]: ' + u.text);
  });

  console.log('='.repeat(80));
  console.log('Total utterances:', utterances.length);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
