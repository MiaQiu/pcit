/**
 * One-off script: run validateSessionQuality LLM check for a session.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const prisma = require('../server/services/db.cjs');
const { llmCall } = require('../server/llm/gateway.cjs');
const { loadPromptWithVariables } = require('../server/prompts/index.cjs');
const { getUtterances, SILENT_SPEAKER_ID } = require('../server/utils/utteranceUtils.cjs');

const SESSION_ID = 'cc33ca75-bf86-4442-99bb-94aba42b6173';

async function main() {
  const session = await prisma.session.findUnique({
    where: { id: SESSION_ID },
    select: { id: true, durationSeconds: true, roleIdentificationJson: true, analysisStatus: true }
  });

  if (!session) throw new Error(`Session ${SESSION_ID} not found`);
  console.log(`Session found. Status: ${session.analysisStatus}, Duration: ${session.durationSeconds}s`);

  const utterances = await getUtterances(SESSION_ID);
  console.log(`Loaded ${utterances.length} utterances`);

  const nonSilent = utterances.filter(u => u.speaker !== SILENT_SPEAKER_ID);
  const speakerIds = new Set(nonSilent.map(u => u.speaker));
  console.log(`Non-silent utterances: ${nonSilent.length}, Speakers: ${speakerIds.size}`);

  // Heuristic pre-filters
  if (nonSilent.length < 10) {
    console.log('❌ FAIL (heuristic): too few utterances (<10)');
    return;
  }
  if (session.durationSeconds < 60) {
    console.log('❌ FAIL (heuristic): duration too short (<60s)');
    return;
  }

  // LLM quality check
  const sample = nonSilent.slice(0, 60).map(u => ({
    speaker: u.speaker,
    text: u.text,
    start: u.startTime,
    end: u.endTime
  }));

  const prompt = loadPromptWithVariables('sessionQualityCheck', {
    DURATION_SECONDS: String(session.durationSeconds),
    UTTERANCE_COUNT: String(nonSilent.length),
    SPEAKER_COUNT: String(speakerIds.size),
    UTTERANCES_SAMPLE: JSON.stringify(sample, null, 2),
    ROLE_IDENTIFICATION: session.roleIdentificationJson
      ? JSON.stringify(session.roleIdentificationJson, null, 2)
      : 'Not available'
  });

  console.log('\nCalling LLM for quality check...');
  const result = await llmCall(prompt, {
    label: 'session-quality-check',
    output: 'json',
    temperature: 0,
    maxTokens: 512
  });

  console.log('\n=== LLM Result ===');
  console.log(JSON.stringify(result, null, 2));

  if (result.valid === false) {
    console.log(`\n❌ FAIL: ${result.userMessage || 'No user message'}`);
  } else {
    console.log('\n✅ PASS: Session quality check passed');
  }
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
