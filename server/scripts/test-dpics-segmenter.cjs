'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { randomUUID }              = require('crypto');
const prisma                      = require('../services/db.cjs');
const { recoverTimestamps }       = require('../utils/dpicsSegmenter.cjs');
const { llmCall }                 = require('../llm/gateway.cjs');
const { loadPromptWithVariables } = require('../prompts/index.cjs');

const SOURCE_ID = process.argv[2] || '84a3ee68-4b44-4797-ad78-2d070b5b1ae9';
const NEW_ID    = process.argv[3] || randomUUID();
const SILENT_ID = '__SILENT__';

// ─── Model runner ─────────────────────────────────────────────────────────────

async function runModel(modelKey, label, speechUtterances) {
  const transcriptJson = speechUtterances.map((u, idx) => ({
    id: idx, speaker: u.speaker, text: u.text
  }));
  const prompt = loadPromptWithVariables('DPICS-Behavioral-Segmenter', {
    TRANSCRIPT_JSON: JSON.stringify(transcriptJson, null, 2)
  });
  console.log(`  📝 [${label}] Calling ${modelKey}...`);
  const results = await llmCall(prompt, {
    model:       modelKey,
    output:      'array',
    temperature: 0,
    maxTokens:   8192,
    label:       `dpics-test-${modelKey}`
  });
  const splitMap = new Map();
  for (const item of (Array.isArray(results) ? results : [])) {
    if (typeof item.id === 'number' && Array.isArray(item.segments) && item.segments.length > 1) {
      splitMap.set(item.id, item.segments);
    }
  }
  console.log(`  ✅ [${label}] ${splitMap.size} utterances split`);
  return splitMap;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Source session : ${SOURCE_ID}`);
  console.log(`New session ID : ${NEW_ID}`);
  console.log(`${'─'.repeat(70)}\n`);

  // 1. Fetch source session
  const original = await prisma.session.findUnique({ where: { id: SOURCE_ID } });
  if (!original) {
    console.error(`❌ Session ${SOURCE_ID} not found in dev DB`);
    process.exit(1);
  }
  console.log(`✅ Session: mode=${original.mode}  duration=${original.durationSeconds}s`);

  // 2. Copy session row (skip if already exists)
  const existingNew = await prisma.session.findUnique({ where: { id: NEW_ID } });
  if (existingNew) {
    console.log(`✅ Session ${NEW_ID} already exists — skipping creation`);
  } else {
    const {
      id: _id, createdAt: _ca, transcribedAt: _ta, analysisFailedAt: _afa,
      lastRetriedAt: _lra, coachAlertSentAt: _casa, codingReviewedAt: _cra,
      ...sessionData
    } = original;
    await prisma.session.create({ data: { id: NEW_ID, ...sessionData, createdAt: new Date() } });
    console.log(`✅ Session copied → ${NEW_ID}`);
  }

  // 3. Fetch source utterances
  const dbUtterances = await prisma.utterance.findMany({
    where: { sessionId: SOURCE_ID }, orderBy: { order: 'asc' }
  });
  console.log(`✅ ${dbUtterances.length} source utterances\n`);

  const speechUtterances = dbUtterances
    .filter(u => u.speaker !== SILENT_ID)
    .map(u => ({
      speaker:  u.speaker,
      text:     u.text,
      start:    u.startTime,
      end:      u.endTime,
      duration: parseFloat((u.endTime - u.startTime).toFixed(2))
    }));

  const words = original.elevenLabsJson?.words ?? [];
  if (words.length === 0) {
    console.warn('⚠️  elevenLabsJson.words is empty — timestamps will use proportional fallback');
  } else {
    console.log(`✅ ${words.length} ElevenLabs word tokens`);
  }

  // 4. Run both models in parallel
  console.log(`\n${'─'.repeat(70)}`);
  console.log('Running both models in parallel...');
  console.log(`${'─'.repeat(70)}`);

  const [flashMap, proMap] = await Promise.all([
    runModel('gemini-3.5-flash',       'Flash',  speechUtterances),
    runModel('gemini-3.1-pro-preview', 'Pro 3',  speechUtterances),
  ]);

  // 5. Apply Flash splits + recover timestamps, then write to DB
  const corrected = [];
  for (let i = 0; i < speechUtterances.length; i++) {
    if (flashMap.has(i)) {
      corrected.push(...recoverTimestamps(flashMap.get(i), speechUtterances[i], words));
    } else {
      corrected.push(speechUtterances[i]);
    }
  }

  await prisma.utterance.deleteMany({ where: { sessionId: NEW_ID } });
  await prisma.utterance.createMany({
    data: corrected.map((u, idx) => ({
      sessionId: NEW_ID,
      speaker:   u.speaker,
      text:      u.text,
      startTime: u.start,
      endTime:   u.end,
      order:     idx
    }))
  });
  console.log(`\n✅ Wrote ${corrected.length} utterances (Flash-segmented) → session ${NEW_ID}`);

  // 6. Side-by-side comparison
  const allIds = [...new Set([...flashMap.keys(), ...proMap.keys()])].sort((a, b) => a - b);

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`SPLIT COMPARISON  (Flash: ${flashMap.size} splits | Pro 3: ${proMap.size} splits)`);
  console.log(`${'─'.repeat(70)}`);

  for (const id of allIds) {
    const orig      = speechUtterances[id];
    const flashSegs = flashMap.get(id);
    const proSegs   = proMap.get(id);
    const inBoth    = flashSegs && proSegs;
    const tag       = inBoth ? '🟢 BOTH' : flashSegs ? '🔵 Flash only' : '🟣 Pro 3 only';

    console.log(`\n  ${tag}  [${id}] ${orig.speaker}: "${orig.text}"`);
    if (flashSegs) console.log(`    Flash → ${flashSegs.map((s, i) => `[${i + 1}] "${s}"`).join('  |  ')}`);
    if (proSegs)   console.log(`    Pro 3 → ${proSegs.map((s, i) => `[${i + 1}] "${s}"`).join('  |  ')}`);
    if (inBoth) {
      const agree = flashSegs.length === proSegs.length &&
        flashSegs.every((s, i) => s.trim() === proSegs[i]?.trim());
      console.log(`    Agreement: ${agree ? '✅ identical' : '⚠️  different segmentation'}`);
    }
  }

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`New session ID for inspection: ${NEW_ID}`);
  console.log(`${'─'.repeat(70)}\n`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
