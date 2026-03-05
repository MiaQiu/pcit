const fetch = require('node-fetch');
const FormData = require('form-data');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Client } = require('pg');
const { parseElevenLabsTranscript } = require('../server/utils/parseElevenLabsTranscript.cjs');

const SESSION_ID = '3a3025ce-04de-4620-ba4a-e162672d9cd5';
const PROD_S3_BUCKET = 'nora-audio-059364397483-prod';
const PROD_REGION = 'ap-southeast-1';

const s3Client = new S3Client({ region: PROD_REGION });

async function main() {
  // Fetch storagePath from prod DB (tunnel must be running: ./scripts/start-prod-db-tunnel.sh)
  const db = new Client({
    host: 'localhost',
    port: 5433,
    database: 'nora',
    user: 'nora_admin',
    password: process.env.PROD_DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });
  await db.connect();
  const { rows } = await db.query('SELECT "storagePath" FROM "Session" WHERE id = $1', [SESSION_ID]);
  await db.end();

  if (!rows.length) throw new Error(`Session not found: ${SESSION_ID}`);
  const storagePath = rows[0].storagePath;
  console.log('storagePath:', storagePath);

  console.log('Downloading audio from prod S3...');
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: PROD_S3_BUCKET,
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
