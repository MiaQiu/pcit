'use strict';

/**
 * Compare pcit-coding call across models.
 * Usage: node scripts/compare-pcit-coding.cjs --session <id>
 */

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { llmCall }      = require('../server/llm/gateway.cjs');
const { loadPrompt }   = require('../server/prompts/index.cjs');
const { getUtterances } = require('../server/utils/utteranceUtils.cjs');

const prisma = new PrismaClient();

const MODELS = [
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
];

// Pricing per million tokens [input, output]
const PRICING = {
  'claude-sonnet-4-6':         [3.00, 15.00],
  'claude-haiku-4-5-20251001': [0.80,  4.00],
  'gemini-1.5-pro':            [1.25,  5.00],
};

// Intercept gateway log lines to capture token counts
let capturedLog = null;
const _origLog = console.log.bind(console);
console.log = (...args) => {
  if (args.length === 1 && typeof args[0] === 'string') {
    try {
      const parsed = JSON.parse(args[0]);
      if (parsed.event === 'llm_call') { capturedLog = parsed; return; }
    } catch {}
  }
  _origLog(...args);
};

async function run() {
  const sessionId = process.argv[process.argv.indexOf('--session') + 1];
  if (!sessionId) { console.error('Usage: --session <id>'); process.exit(1); }

  const session = await prisma.session.findFirstOrThrow({
    where: { id: { startsWith: sessionId.substring(0, 8) } },
    select: { id: true, mode: true },
  });

  const isCDI = session.mode === 'CDI';
  const utterances = await getUtterances(session.id);
  _origLog(`Session: ${session.id} | Mode: ${session.mode} | Utterances: ${utterances.length}\n`);

  const systemPrompt = loadPrompt('dpicsCoding') + (!isCDI ? '\n\n**PDI SESSION:** DC is a TARGET SKILL. Do not suggest replacing it with PRIDE skills.' : '');
  const utterancesData = utterances.map((u, i) => ({ id: i, role: u.role, text: u.text }));
  const userPrompt = `**Input Format:**\n\nYou will receive a chronological JSON list of dialogue turns with ${utterances.length} conversations:\n\n${JSON.stringify(utterancesData, null, 2)}\n\nEach item has:\n- role: Identify if the speaker is "parent" or "child"\n- text: The content to analyze\n\n**Output Specification:**\n\nOutput only a valid JSON array of objects for the Parent segments.\n\nFormat: [{"id": <int>, "code": <string>, "feedback": <string>}, ...]\n\nDo not include child segments in the output.\n\n**CRITICAL INSTRUCTIONS:**\n- Return ONLY the JSON array, nothing else\n- Do NOT use markdown code blocks\n- First character MUST be [ and last MUST be ]\n- Every parent segment MUST have both "code" and "feedback" fields`;

  const summary = [];

  for (const model of MODELS) {
    _origLog(`${'─'.repeat(60)}`);
    _origLog(`▶  ${model}`);

    capturedLog = null;
    let result, ok = true, error = null;
    const start = Date.now();

    try {
      result = await llmCall(userPrompt, {
        model,
        maxTokens:    8192,
        temperature:  0,
        systemPrompt,
        output:       'array',
        label:        'pcit-coding',
        timeout:      120_000,
      });
    } catch (e) {
      ok = false;
      error = e.message;
    }

    const latencyMs = Date.now() - start;
    const log = capturedLog || {};
    const inputTokens  = log.inputTokens  ?? null;
    const outputTokens = log.outputTokens ?? null;

    let cost = null;
    if (inputTokens !== null && outputTokens !== null && PRICING[model]) {
      const [inPrice, outPrice] = PRICING[model];
      cost = (inputTokens / 1e6 * inPrice) + (outputTokens / 1e6 * outPrice);
    }

    summary.push({ model, ok, latencyMs, inputTokens, outputTokens, cost, error, codedCount: Array.isArray(result) ? result.length : null });

    _origLog(`   Status:   ${ok ? '✅ OK' : '❌ ' + error}`);
    _origLog(`   Latency:  ${(latencyMs / 1000).toFixed(1)}s`);
    _origLog(`   Tokens:   ${inputTokens ?? '?'} in / ${outputTokens ?? '?'} out`);
    _origLog(`   Cost:     ${cost !== null ? '$' + cost.toFixed(5) : 'n/a'}`);
    _origLog(`   Coded:    ${summary.at(-1).codedCount ?? '—'} utterances`);

    summary.at(-1).result = result;
  }

  _origLog(`\n${'═'.repeat(60)}`);
  _origLog('COMPARISON SUMMARY\n');
  _origLog(`${'Model'.padEnd(32)} ${'In tok'.padStart(7)} ${'Out tok'.padStart(8)} ${'Latency'.padStart(9)} ${'Cost'.padStart(9)} ${'Coded'.padStart(6)}`);
  _origLog('─'.repeat(75));
  for (const r of summary) {
    const inTok   = r.inputTokens  !== null ? String(r.inputTokens)  : '?';
    const outTok  = r.outputTokens !== null ? String(r.outputTokens) : '?';
    const latency = `${(r.latencyMs / 1000).toFixed(1)}s`;
    const cost    = r.cost !== null ? `$${r.cost.toFixed(5)}` : 'n/a';
    const coded   = r.codedCount !== null ? String(r.codedCount) : '—';
    _origLog(`${r.model.padEnd(32)} ${inTok.padStart(7)} ${outTok.padStart(8)} ${latency.padStart(9)} ${cost.padStart(9)} ${coded.padStart(6)}`);
  }

  // Full code diff
  const resultSets = summary.filter(r => r.ok && Array.isArray(r.result));
  if (resultSets.length < 2) { await prisma.$disconnect(); return; }

  // Build a map of id -> code per model
  const codeMaps = resultSets.map(r => {
    const map = {};
    r.result.forEach(u => { map[u.id] = u.code; });
    return map;
  });

  const allIds = [...new Set(resultSets.flatMap(r => r.result.map(u => u.id)))].sort((a, b) => a - b);

  // Build id -> utterance text map
  const uttTextMap = {};
  utterances.forEach((u, i) => { uttTextMap[i] = u.text; });

  _origLog(`\n${'═'.repeat(60)}`);
  _origLog('FULL CODE DIFF\n');

  _origLog(`${'ID'.padStart(4)}  ${'Sonnet 4.6'.padEnd(8)}  ${'Haiku 4.5'.padEnd(8)}  Utterance`);
  _origLog('─'.repeat(80));

  let diffCount = 0;
  for (const id of allIds) {
    const codes = codeMaps.map(m => m[id] ?? '—');
    const allSame = codes.every(c => c === codes[0]);
    if (!allSame) {
      diffCount++;
      const text = uttTextMap[id] ?? '';
      _origLog(`${String(id).padStart(4)}  ${codes[0].padEnd(8)}  ${codes[1].padEnd(8)}  "${text}"`);
    }
  }

  if (diffCount === 0) {
    _origLog('All codes match. ✅');
  } else {
    _origLog(`\n${diffCount} divergence(s) out of ${allIds.length} coded utterances.`);
  }

  await prisma.$disconnect();
}

run().catch(e => { _origLog(e); process.exit(1); });
