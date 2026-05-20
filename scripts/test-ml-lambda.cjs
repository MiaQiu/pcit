/**
 * Test the ML diarization Lambda directly (bypasses Gemini / voting logic).
 * Usage: DIARIZATION_LAMBDA_NAME=nora-diarization node scripts/test-ml-lambda.cjs
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { classifySpeakersML } = require('../server/services/mlDiarizationService.cjs');

const STORAGE_PATH = 'audio/01a50a36-cd18-4311-ab2e-897d088dec02/807db5e6-74ad-423c-ba20-b3ead3b58aac.m4a';
const UTTERANCES = [
  { speaker: 'speaker_0', startTime: 11.48, endTime: 14.18 },
  { speaker: 'speaker_0', startTime: 31.78, endTime: 38.84 },
  { speaker: 'speaker_0', startTime: 38.86, endTime: 44.16 },
  { speaker: 'speaker_0', startTime: 63.68, endTime: 65.08 },
  { speaker: 'speaker_0', startTime: 65.04, endTime: 67.86 },
  { speaker: 'speaker_0', startTime: 67.86, endTime: 70.38 },
  { speaker: 'speaker_0', startTime: 73.26, endTime: 78.60 },
  { speaker: 'speaker_0', startTime: 78.60, endTime: 82.34 },
  { speaker: 'speaker_1', startTime: 25.82, endTime: 27.60 },
  { speaker: 'speaker_1', startTime: 52.26, endTime: 63.68 },
  { speaker: 'speaker_1', startTime: 97.60, endTime: 103.17 },
  { speaker: 'speaker_1', startTime: 103.96, endTime: 106.10 },
  { speaker: 'speaker_1', startTime: 108.64, endTime: 110.90 },
];

const EXPECTED = { speaker_0: 'adult', speaker_1: 'child' };

async function main() {
  const lambdaName = process.env.DIARIZATION_LAMBDA_NAME;
  if (!lambdaName) {
    console.error('ERROR: set DIARIZATION_LAMBDA_NAME=nora-diarization');
    process.exit(1);
  }

  const s0 = Object.fromEntries(['speaker_0','speaker_1'].map(id => [id, UTTERANCES.filter(u => u.speaker === id).length]));
  console.log(`Lambda  : ${lambdaName}`);
  console.log(`Audio   : ${STORAGE_PATH}`);
  console.log(`Speakers: ${Object.entries(s0).map(([id,n]) => `${id} (${n} utts)`).join(', ')}`);
  console.log();

  const t0 = Date.now();
  let result;
  try {
    result = await classifySpeakersML(STORAGE_PATH, UTTERANCES, 'test-session');
  } catch (err) {
    console.error(`❌ Lambda threw: ${err.message}`);
    process.exit(1);
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

  if (!result) {
    console.error('❌ Lambda returned null (unconfigured or silent failure)');
    process.exit(1);
  }

  console.log(`── ML Results (${elapsed}s) ──────────────────────────────`);
  for (const [spk, info] of Object.entries(result)) {
    const bar = '█'.repeat(Math.round(info.confidence * 20));
    console.log(`  ${spk}: ${info.role.toUpperCase().padEnd(6)}  conf=${info.confidence.toFixed(2)}  ${bar}`);
  }

  console.log();
  console.log('── Expected vs Actual ───────────────────────────────────');
  let allPass = true;
  for (const [spk, exp] of Object.entries(EXPECTED)) {
    const got  = result[spk]?.role;
    const pass = got === exp;
    if (!pass) allPass = false;
    console.log(`  ${pass ? '✅' : '❌'} ${spk}: expected=${exp}  got=${got ?? 'missing'}`);
  }

  console.log();
  console.log(allPass ? '✅ All checks passed' : '❌ Some checks FAILED');
  process.exit(allPass ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
