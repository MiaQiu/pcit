/**
 * ML-based child/adult speaker classification via AWS Lambda.
 * Returns null (silently) when the Lambda is not configured so the caller
 * can fall back to LLM-only voting without an error.
 */
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { SILENT_SPEAKER_ID } = require('../utils/utteranceUtils.cjs');

const FUNCTION_NAME = process.env.DIARIZATION_LAMBDA_NAME || 'nora-diarization';
const REGION = process.env.AWS_REGION || 'ap-southeast-1';

let _client = null;
function _getClient() {
  if (!_client) _client = new LambdaClient({ region: REGION });
  return _client;
}

/**
 * Classify each speaker as 'adult' or 'child' using the acoustic ML model.
 *
 * @param {string} storagePath  S3 key, e.g. "audio/userId/sessionId.m4a"
 * @param {Array}  utterances   Utterance records (with speaker, startTime, endTime)
 * @param {string} sessionId    For logging
 * @returns {Promise<Object|null>}
 *   { speaker_0: { role: 'adult', confidence: 0.88 }, ... }  or  null on skip/failure
 */
async function classifySpeakersML(storagePath, utterances, sessionId) {
  if (!process.env.DIARIZATION_LAMBDA_NAME) return null;

  const s3Bucket = process.env.AWS_S3_BUCKET;
  if (!s3Bucket || !storagePath || storagePath.startsWith('mock://')) return null;

  // Build per-speaker segment lists from utterances
  const segMap = {};
  for (const u of utterances) {
    if (u.speaker === SILENT_SPEAKER_ID) continue;
    if (!segMap[u.speaker]) segMap[u.speaker] = [];
    segMap[u.speaker].push({ start: u.startTime, end: u.endTime });
  }

  const speakers = Object.entries(segMap).map(([id, segments]) => ({ id, segments }));
  if (speakers.length === 0) return null;

  const payload = { s3_bucket: s3Bucket, s3_key: storagePath, speakers };

  console.log(`📊 [ML-DIARIZATION] Invoking Lambda (${FUNCTION_NAME}) for ${speakers.length} speakers...`);

  const response = await _getClient().send(new InvokeCommand({
    FunctionName: FUNCTION_NAME,
    InvocationType: 'RequestResponse',
    Payload: Buffer.from(JSON.stringify(payload))
  }));

  if (response.FunctionError) {
    throw new Error(`Lambda function error: ${response.FunctionError} — ${Buffer.from(response.Payload).toString().substring(0, 200)}`);
  }

  const result = JSON.parse(Buffer.from(response.Payload).toString());
  if (result.error) throw new Error(`Diarization Lambda: ${result.error}`);

  console.log(`✅ [ML-DIARIZATION] ${JSON.stringify(result)}`);
  return result;
}

module.exports = { classifySpeakersML };
