const fetch = require('node-fetch');
const FormData = require('form-data');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { parseElevenLabsTranscript } = require('../server/utils/parseElevenLabsTranscript.cjs');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const storagePath = 'audio/7624c281-64a3-4ea9-8cd0-5e4652d620a0/6974af24-e760-4066-82ee-38e5dbfda190.m4a';

async function main() {
  console.log('📥 Downloading audio from S3...');
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: storagePath
  }));

  const chunks = [];
  for await (const chunk of response.Body) chunks.push(chunk);
  const audioBuffer = Buffer.concat(chunks);
  console.log('Downloaded:', audioBuffer.length, 'bytes');

  const formData = new FormData();
  formData.append('file', audioBuffer, { filename: 'audio.m4a', contentType: 'audio/x-m4a' });
  formData.append('model_id', 'scribe_v2');
  formData.append('diarize', 'true');
  formData.append('diarization_threshold', 0.1);
  formData.append('temperature', 0);
  formData.append('tag_audio_events', 'true');
  formData.append('timestamps_granularity', 'word');

  console.log('📤 Calling ElevenLabs with scribe_v2...');
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
  console.log('TRANSCRIPT (scribe_v2)');
  console.log('='.repeat(80));

  utterances.forEach((u, i) => {
    console.log('[' + String(i).padStart(3, '0') + '] ' + u.speaker + ' [' + u.start.toFixed(1) + 's - ' + u.end.toFixed(1) + 's]: ' + u.text);
  });

  console.log('='.repeat(80));
  console.log('Total utterances:', utterances.length);
}

main().catch(console.error);
