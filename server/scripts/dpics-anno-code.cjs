'use strict';
/**
 * DPICS coding pass on pre-annotated (enriched) CDI session JSONs.
 * Reads 1_anno.json–6_anno.json, codes adult utterances using v10 + Gemini Pro,
 * saves results to eval-results/dpics/anno-s{N}__<model>__<prompt>__<ts>.json
 *
 * Usage: node server/scripts/dpics-anno-code.cjs
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { llmCall }    = require('../llm/gateway.cjs');
const { loadPrompt } = require('../prompts/index.cjs');
const { sameCategory } = require('./dpics-eval-codes.cjs');

const JSON_DIR   = path.join(__dirname, 'cdi sessions/json');
const RESULTS_DIR = path.resolve(__dirname, '../../eval-results/dpics');
const PDF_PATH   = process.env.DPICS_PDF_PATH || path.join(__dirname, '../assets/Manual_for_the_Dyadic_Parent-Child_Interaction_Cod.pdf');
const APPENDIX   = path.join(__dirname, '../assets/appendix A - words_sufficiently_positive.json');
const PROMPT     = 'dpicsCoding-agentic-v10';
const MODEL      = 'gemini-3.1-pro-preview';

function getVerbalization(u) {
  return u.enriched || u.verbalization || u.text || '';
}

async function codeSession(filename, sessionNum) {
  const filepath = path.join(JSON_DIR, filename);
  const data     = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const session  = data.sessions[0];

  const systemPrompt = loadPrompt(PROMPT);
  const promptHash   = crypto.createHash('sha256').update(systemPrompt).digest('hex').slice(0, 8);
  const modelTag     = MODEL.replace(/[^a-zA-Z0-9_-]/g, '_');

  // Build utterance list using enriched verbalization
  const utterancesData = session.utterances.map((u, i) => ({
    id:   i,
    role: u.role === 'adult' || u.speaker === 'parent' ? 'adult' : 'child',
    text: getVerbalization(u),
  }));

  const nonce      = crypto.randomUUID();
  const userPrompt = `[nonce:${nonce}]\nCode every utterance where role is "adult". Skip all "child" entries.

${JSON.stringify(utterancesData, null, 2)}

Return a minified JSON array for adult utterances only:
[{"id": <int>, "subject": <string>, "code": <string>}, ...]
- "subject": who or what the utterance is primarily about — choose the most specific applicable label:
  "兒童" (the child), "物品/玩具" (an object or toy), "家長自身" (the parent themselves), "遊戲角色" (a pretend/play character), "第三方" (another person not the child), "不明" (unclear)
- "code": the single DPICS code
- Return ONLY the JSON array — no text, no markdown, no code fences
- First character MUST be [, last character MUST be ]
- Every adult entry MUST have "id", "subject", and "code"`;

  console.log(`  [s${sessionNum}] Coding with Pro (${utterancesData.filter(u=>u.role==='adult').length} adult utts)...`);

  const results = await llmCall(userPrompt, {
    profile:       'pcit-coding',
    label:         'dpics-anno-code',
    model:         MODEL,
    _geminiConfig: { seed: 42 },
    cache: {
      key:         `dpics-anno-${PROMPT}-${promptHash}-new-${modelTag}`,
      primaryFile: PDF_PATH,
      systemPrompt,
      extraFiles:  [{ path: APPENDIX, mimeType: 'application/json' }],
    },
  });

  if (!Array.isArray(results)) throw new Error(`[s${sessionNum}] Non-array response`);

  const byId = Object.fromEntries(results.map(r => [r.id, r]));

  // Score against ground truth if codes are present
  const adultWithGT = session.utterances
    .map((u, i) => ({ ...u, idx: i }))
    .filter(u => (u.role === 'adult' || u.speaker === 'parent') && u.code);

  let catCorrect = 0;
  const scored = adultWithGT.map(u => {
    const pred = byId[u.idx];
    const catMatch = pred ? sameCategory(pred.code, u.code) : false;
    if (catMatch) catCorrect++;
    return {
      order:       u.idx,
      text:        getVerbalization(u),
      enriched:    u.enriched || null,
      groundTruth: u.code,
      predicted:   pred?.code ?? null,
      subject:     pred?.subject ?? null,
      categoryMatch: catMatch,
    };
  });

  const hasGT = adultWithGT.length > 0;
  const accuracy = hasGT ? (catCorrect / adultWithGT.length * 100).toFixed(1) + '%' : 'N/A (no GT)';
  console.log(`  ✅ [s${sessionNum}] ${accuracy} (${catCorrect}/${adultWithGT.length}) — ${results.length} coded`);

  const ts      = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = `anno-s${sessionNum}__${modelTag}__${PROMPT}-${promptHash}__${ts}.json`;
  fs.writeFileSync(path.join(RESULTS_DIR, outFile), JSON.stringify({
    session: session.label,
    model:   MODEL,
    prompt:  PROMPT,
    promptHash,
    enriched: true,
    summary: hasGT ? { total: adultWithGT.length, categoryMatches: catCorrect, categoryAccuracy: catCorrect / adultWithGT.length * 100 } : null,
    utterances: scored,
  }, null, 2));

  return { sessionNum, accuracy, catCorrect, total: adultWithGT.length };
}

async function main() {
  const sessions = [
    { file: '1_anno.json', num: 1 },
    { file: '2_anno.json', num: 2 },
    { file: '3_anno.json', num: 3 },
    { file: '4_anno.json', num: 4 },
    { file: '5_anno.json', num: 5 },
    { file: '6_anno.json', num: 6 },
  ];

  // Check anno files exist
  const missing = sessions.filter(s => !fs.existsSync(path.join(JSON_DIR, s.file)));
  if (missing.length) {
    console.error('Missing anno files:', missing.map(s=>s.file).join(', '));
    console.error('Run dpics-enrich.cjs first.');
    process.exit(1);
  }

  console.log(`Coding ${sessions.length} enriched sessions in parallel with ${MODEL}...`);
  const results = await Promise.all(sessions.map(s => codeSession(s.file, s.num)));

  const total = results.reduce((a, b) => ({ catCorrect: a.catCorrect + b.catCorrect, total: a.total + b.total }), { catCorrect: 0, total: 0 });
  console.log(`\nOverall: ${(total.catCorrect / total.total * 100).toFixed(2)}% (${total.catCorrect}/${total.total})`);
}

main().catch(e => { console.error(e); process.exit(1); });
