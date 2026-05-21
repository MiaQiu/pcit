/**
 * Test: DPICS coding via Gemini context cache (PDF + systemInstruction).
 * Steps:
 *   1. Upload DPICS-Manual.2.18.pdf to Files API
 *   2. Create context cache (PDF + dpicsCoding.txt systemInstruction)
 *   3. Run PCIT coding for a real session using cachedContent
 *   4. Parse + print results
 *
 * Does NOT write anything to the database.
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path   = require('path');
const fetch  = require('node-fetch');
const { PrismaClient } = require('@prisma/client');
const { getOrCreateCache } = require('../server/llm/providers/geminiCache.cjs');
const { loadPrompt } = require('../server/prompts/index.cjs');
const { parseJSON } = require('../server/llm/repair.cjs');

const prisma = new PrismaClient();

const SESSION_ID          = 'c52f3ecd-d418-4bc2-a834-29c941f3a772'; // most recent dev CDI with utterances
const SILENT_SPEAKER_ID   = '__SILENT__';
const MODEL               = process.env.GEMINI_STREAMING_MODEL || 'gemini-3-flash-preview';
const API_KEY             = process.env.GEMINI_API_KEY;
const PDF_PATH            = path.join(__dirname, '../server/assets/DPICS-Manual.2.18.pdf');

// ── Streaming helper (mirrors callGeminiStreaming in pcitAnalysisService) ─────

async function streamingCall(contents, cachedContent) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?key=${API_KEY}&alt=sse`;

  const body = {
    ...(cachedContent ? { cachedContent } : {}),
    contents,
    generationConfig: { temperature: 0, maxOutputTokens: 32768 }
  };

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${err.substring(0, 300)}`);
  }

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer   = '';

  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;
      try {
        const data = JSON.parse(jsonStr);
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) fullText += text;
      } catch (_) {}
    }
  }

  return fullText;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!API_KEY) { console.error('GEMINI_API_KEY not set'); process.exit(1); }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`DPICS CACHE TEST — Session ${SESSION_ID}`);
  console.log(`Model: ${MODEL}`);
  console.log(`${'='.repeat(80)}\n`);

  // ── Step 1: Upload PDF + create cache ──────────────────────────────────────
  console.log('── Step 1: Resolving context cache...');
  const systemInstruction = loadPrompt('dpicsCoding'); // CDI variant
  let cacheName;
  try {
    cacheName = await getOrCreateCache('dpics-cdi', PDF_PATH, systemInstruction, MODEL);
    console.log(`✅ Cache ready: ${cacheName}\n`);
  } catch (err) {
    console.error(`❌ Cache creation failed: ${err.message}`);
    console.log('Aborting — cannot test cache path.\n');
    process.exit(1);
  }

  // ── Step 2: Fetch utterances ───────────────────────────────────────────────
  console.log('── Step 2: Fetching utterances from DB...');
  const utterances = await prisma.utterance.findMany({
    where:   { sessionId: SESSION_ID },
    orderBy: { order: 'asc' },
  });

  if (utterances.length === 0) {
    console.error('No utterances found for this session.');
    process.exit(1);
  }

  const utterancesData = utterances
    .filter(u => u.speaker !== SILENT_SPEAKER_ID)
    .map((u, idx) => ({ id: idx, role: u.role, text: u.text }));

  console.log(`✅ ${utterancesData.length} utterances (${utterancesData.filter(u => u.role === 'adult').length} adult)\n`);

  // ── Step 3: Build per-call user message ───────────────────────────────────
  const userPrompt = `Code every utterance where role is "adult". Skip all "child" entries.

${JSON.stringify(utterancesData, null, 2)}

Return a minified JSON array for adult utterances only:
[{"id": <int>, "code": <string>, "feedback": <string>}, ...]
- Return ONLY the JSON array — no text, no markdown, no code fences
- First character MUST be [, last character MUST be ]
- Every adult entry MUST have both "code" and "feedback"`;

  console.log('── Step 3: Sending coding request with cachedContent...');
  console.log(`   cachedContent: ${cacheName}`);
  console.log(`   user message:  ${userPrompt.split('\n')[0]} ... (${userPrompt.length} chars)\n`);

  // ── Step 4: Call Gemini ───────────────────────────────────────────────────
  const t0  = Date.now();
  const raw = await streamingCall(
    [{ role: 'user', parts: [{ text: userPrompt }] }],
    cacheName
  );
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`✅ Response received in ${elapsed}s (${raw.length} chars)\n`);

  // ── Step 5: Parse + print ────────────────────────────────────────────────
  const { value: results, repaired } = parseJSON(raw, 'array');

  if (!Array.isArray(results)) {
    console.error('❌ Could not parse response as JSON array');
    console.log('RAW:', raw.substring(0, 500));
    process.exit(1);
  }

  console.log(`── Results: ${results.length} parent utterances coded${repaired ? ' (JSON repaired)' : ''}`);

  const counts = {};
  for (const r of results) counts[r.code] = (counts[r.code] || 0) + 1;

  console.log('\nCode counts:');
  for (const [code, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${code.padEnd(6)} ${n}`);
  }

  const missing = utterancesData
    .filter(u => u.role === 'adult')
    .filter(u => !results.find(r => r.id === u.id));

  if (missing.length > 0) {
    console.log(`\n⚠️  ${missing.length} adult utterances not coded:`);
    for (const u of missing) console.log(`  [${u.id}] ${u.text.substring(0, 60)}`);
  } else {
    console.log('\n✅ All adult utterances coded');
  }

  console.log('\nSample results (first 5):');
  for (const r of results.slice(0, 5)) {
    console.log(`  [${r.id}] ${r.code.padEnd(6)} "${r.feedback?.substring(0, 70)}"`);
  }

  await prisma.$disconnect();
  console.log(`\n${'='.repeat(80)}`);
  console.log('TEST COMPLETE — no database changes made');
  console.log(`${'='.repeat(80)}\n`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  prisma.$disconnect().catch(() => {});
  process.exit(1);
});
