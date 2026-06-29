'use strict';

/**
 * Translate gold-standard DPICS fixture sessions from Chinese to English,
 * keeping role/code/order identical. Used to test whether the model's
 * accuracy ceiling is language-dependent (DPICS manual itself is in English).
 *
 * Usage:
 *   node server/scripts/dpics-eval-translate.cjs <srcDir> <outDir>
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs   = require('fs');
const path = require('path');
const { llmCall } = require('../llm/gateway.cjs');

function cleanText(raw) {
  let t = raw;
  let prev;
  do {
    prev = t;
    t = t.replace(/（[^（）]*）/g, '');
    t = t.replace(/\([^()]*\)/g, '');
    t = t.replace(/【[^【】]*】/g, '');
  } while (t !== prev);
  return t.replace(/\s+/g, ' ').trim().replace(/^[，,。.、…\s]+|[，,。.、…\s]+$/g, '');
}

const CHUNK_SIZE = 40;

async function translateChunk(texts) {
  const userPrompt = `Translate each of the following Mandarin Chinese parent-child interaction transcript lines into natural, idiomatic English. Preserve the conversational register (these are spoken, often short/informal utterances, sometimes sentence fragments or interjections) — do not formalize or polish them into written English. Preserve incompleteness (trailing "..." for cut-off sentences), filler words/interjections (translate to an equivalent English filler, e.g. "um", "huh", "oh"), and repeated/disfluent speech as-is.

Input (JSON array, one string per line, in order):
${JSON.stringify(texts, null, 2)}

Return ONLY a minified JSON array of exactly ${texts.length} elements, in the same order, each element the English translation of the corresponding input line. No markdown, no commentary, no numbering, no original Chinese text — just the translated strings.`;

  const result = await llmCall(userPrompt, {
    model: 'gemini',
    output: 'array',
    temperature: 0.2,
    maxTokens: 4096,
    timeout: 90_000,
    label: 'dpics-eval-translate',
    schema: { type: 'array', items: { type: 'string' } },
  });

  if (!Array.isArray(result) || result.length !== texts.length) {
    throw new Error(`Translation length mismatch: sent ${texts.length}, got ${Array.isArray(result) ? result.length : typeof result}`);
  }
  return result;
}

async function translateBatch(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
    const chunk = texts.slice(i, i + CHUNK_SIZE);
    const translated = await translateChunk(chunk);
    out.push(...translated);
  }
  return out;
}

async function main() {
  const [srcDir, outDir] = process.argv.slice(2);
  if (!srcDir || !outDir) {
    console.error('Usage: node server/scripts/dpics-eval-translate.cjs <srcDir> <outDir>');
    process.exit(1);
  }

  const dir = path.resolve(srcDir);
  const out = path.resolve(outDir);
  fs.mkdirSync(out, { recursive: true });

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  console.log(`Translating ${files.length} fixture file(s)...`);

  for (const f of files) {
    if (fs.existsSync(path.join(out, f))) {
      console.log(`  ${f}: already translated, skipping`);
      continue;
    }

    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    const utterances = data.sessions[0].utterances;

    const sourceTexts = utterances.map(u => {
      const usedFallback = u.verbalization === undefined;
      return usedFallback ? cleanText(u.text || '') : (u.verbalization || '').trim();
    });

    console.log(`  ${f}: translating ${sourceTexts.length} lines...`);
    const translations = await translateBatch(sourceTexts);

    const newUtterances = utterances.map((u, i) => ({
      role: u.role,
      speaker: u.speaker || (u.role === 'adult' ? 'parent' : 'child'),
      text: translations[i],
      verbalization: translations[i],
      code: u.code,
    }));

    const outData = { sessions: [{ label: data.sessions[0].label, utterances: newUtterances }] };
    fs.writeFileSync(path.join(out, f), JSON.stringify(outData, null, 2) + '\n', 'utf-8');
    console.log(`  ${f}: written to ${path.join(out, f)}`);
  }

  console.log('Done.');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
