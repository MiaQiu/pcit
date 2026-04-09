const fetch = require('node-fetch');
const FormData = require('form-data');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Client } = require('pg');
const { parseElevenLabsTranscript } = require('../server/utils/parseElevenLabsTranscript.cjs');

const s3Client = new S3Client({ region: 'ap-southeast-1' });

async function main() {
  const db = new Client({
    host: 'localhost',
    port: 5432,
    database: 'nora_dev',
    user: 'nora_admin',
    password: 'D7upDeIjZc1S1BG6Mca1QxKzVqxF4Bbw',
    ssl: { rejectUnauthorized: false }
  });
  await db.connect();
  const { rows } = await db.query('SELECT "storagePath" FROM "Session" WHERE id = $1', ['50b82d30-0685-4d5e-ac73-2a41de3bb01c']);
  await db.end();
  if (!rows.length) throw new Error('Session not found');
  const storagePath = rows[0].storagePath;
  console.log('storagePath:', storagePath);

  const response = await s3Client.send(new GetObjectCommand({ Bucket: 'nora-audio-059364397483-sg', Key: storagePath }));
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

  console.log('Calling ElevenLabs...');
  const apiResponse = await fetch('https://api.elevenlabs.io/v1/speech-to-text?include_timestamps=true', {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, ...formData.getHeaders() },
    body: formData
  });
  if (!apiResponse.ok) throw new Error('API error: ' + await apiResponse.text());

  const result = await apiResponse.json();
  console.log('Words:', result.words?.length);

  const events = (result.words || []).filter(w => w.type === 'audio_event');
  console.log('Audio events:', events.length, events.map(e => e.text));

  const utterances = parseElevenLabsTranscript(result);
  console.log('');
  console.log('='.repeat(80));
  console.log('TRANSCRIPT');
  console.log('='.repeat(80));
  utterances.forEach((u, i) => {
    console.log('[' + String(i).padStart(3, '0') + '] ' + u.speaker + ' [' + u.start.toFixed(1) + 's - ' + u.end.toFixed(1) + 's]: ' + u.text);
  });
  console.log('='.repeat(80));
  console.log('Total utterances:', utterances.length);
}
main().catch(console.error);
