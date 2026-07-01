'use strict';
/**
 * Find utterances where Gemini Flash (no-cache) and Gemini Pro (no-cache) disagree,
 * then send those cases to Gemini Pro with the full cached manual for arbitration.
 *
 * Usage:
 *   node server/scripts/dpics-disagree-arbitrate.cjs [--sessions session-1,session-2,...] [--prompt <name>]
 *
 * Reads:  eval-results/dpics/ (latest Flash & Pro no-cache results per session)
 * Writes: eval-results/dpics/disagree-arbitration__<timestamp>.json
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs   = require('fs');
const path = require('path');

const { llmCall }    = require('../llm/gateway.cjs');
const { sameCategory } = require('./dpics-eval-codes.cjs');

const RESULTS_DIR      = path.resolve(__dirname, '../../eval-results/dpics');
const DPICS_PDF_PATH   = process.env.DPICS_PDF_PATH      || path.join(__dirname, '../assets/Manual_for_the_Dyadic_Parent-Child_Interaction_Cod.pdf');
const DPICS_APPENDIX_PATH = process.env.DPICS_APPENDIX_PATH || path.join(__dirname, '../assets/appendix A - words_sufficiently_positive.json');
const PROMPT_NAME      = 'dpicsCoding-agentic-v10';
const ARBITER_MODEL    = 'gemini-3.1-pro-preview';

// ── helpers ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { sessions: null, prompt: PROMPT_NAME };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--sessions') args.sessions = argv[++i].split(',').map(s => s.trim());
    else if (argv[i] === '--prompt') args.prompt = argv[++i];
  }
  return args;
}

/** Return the latest result file path matching model + session + tag substrings. */
function latestFile(session, modelTag, tags = []) {
  const files = fs.readdirSync(RESULTS_DIR)
    .filter(f => f.startsWith(`${session}__${modelTag}__`) && tags.every(t => f.includes(t)))
    .sort();  // ISO timestamp suffix → lexicographic = chronological
  if (!files.length) return null;
  return path.join(RESULTS_DIR, files[files.length - 1]);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sessions = args.sessions || ['session-1', 'session-2', 'session-3', 'session-4', 'session-5', 'session-6'];

  // 1. Collect disagreements across all sessions
  const disagreements = [];  // { session, order, text, flashCode, proCode, groundTruth, context }

  for (const session of sessions) {
    const flashPath = latestFile(session, 'gemini-3_5-flash', ['nocache']);
    const proPath   = latestFile(session, 'gemini-3_1-pro-preview', ['nocache']);
    if (!flashPath || !proPath) {
      console.warn(`[${session}] missing result file — skipping (flash: ${!!flashPath}, pro: ${!!proPath})`);
      continue;
    }

    const flashData = JSON.parse(fs.readFileSync(flashPath, 'utf8'));
    const proData   = JSON.parse(fs.readFileSync(proPath, 'utf8'));

    // Index pro utterances by order
    const proByOrder = {};
    for (const u of proData.utterances) proByOrder[u.order] = u;

    // Also keep the full utterance list for context windows
    const allUtts = flashData.utterances;  // includes child utterances with text

    for (const fu of flashData.utterances) {
      if (!fu.groundTruth) continue;  // child utterance — skip
      const pu = proByOrder[fu.order];
      if (!pu) continue;
      if (fu.predicted === pu.predicted) continue;  // agree

      // Gather ±2 utterances as context
      const contextWindow = allUtts
        .filter(u => u.order >= fu.order - 2 && u.order <= fu.order + 2)
        .map(u => ({ order: u.order, role: u.groundTruth ? 'adult' : 'child', text: u.text }));

      disagreements.push({
        session,
        order:       fu.order,
        text:        fu.text,
        flashCode:   fu.predicted,
        proCode:     pu.predicted,
        groundTruth: fu.groundTruth,
        context:     contextWindow,
      });
    }
  }

  console.log(`Found ${disagreements.length} disagreements across ${sessions.length} sessions`);
  if (!disagreements.length) { console.log('Nothing to arbitrate.'); process.exit(0); }

  // 2. Build arbitration prompt
  const cases = disagreements.map((d, i) => {
    const ctxLines = d.context.map(c => `  [${c.order}][${c.role}] ${c.text}`).join('\n');
    return `### Case ${i + 1} — ${d.session}, utterance #${d.order}
Context (±2 utterances):
${ctxLines}

Target utterance (adult, #${d.order}): "${d.text}"
  Flash predicted: ${d.flashCode}
  Pro predicted:   ${d.proCode}`;
  }).join('\n\n---\n\n');

  const prompt = `You are adjudicating ${disagreements.length} DPICS coding disagreements between two models.
For each case, you are given the target adult utterance and ±2 surrounding utterances for context.
Two models disagreed on the DPICS code; their predictions are shown.

Apply the DPICS coding rules from the manual (in your context) and output ONE definitive code per case.

${cases}

---

Return a minified JSON array with one object per case in order:
[{"case": <int>, "utterance": "<text>", "code": "<DPICS code>", "reasoning": "<one sentence>"}, ...]
Return ONLY the JSON array. First character MUST be [, last character MUST be ].`;

  // 3. Call Gemini Pro with cached manual
  const cacheConfig = {
    key:          `dpics-arbitrate-filesonly-${path.basename(DPICS_PDF_PATH, '.pdf')}-${ARBITER_MODEL.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    primaryFile:  DPICS_PDF_PATH,
    systemPrompt: '',
    extraFiles:   [{ path: DPICS_APPENDIX_PATH, mimeType: 'application/json' }],
    filesOnly:    true,
  };

  const nonce = require('crypto').randomUUID();
  const fullPrompt = `[nonce:${nonce}]\n${prompt}`;

  console.log(`Sending ${disagreements.length} cases to ${ARBITER_MODEL} with cached manual...`);
  const result = await llmCall(fullPrompt, {
    model:    ARBITER_MODEL,
    label:    'dpics-arbitrate',
    profile:  'pcit-coding',
    cache:    cacheConfig,
    _geminiConfig: { seed: 42 },
  });

  if (!Array.isArray(result)) throw new Error('Expected JSON array from arbiter');

  // 4. Score and annotate
  let correctByFlash = 0, correctByPro = 0, correctByArbiter = 0;
  const annotated = disagreements.map((d, i) => {
    const r = result[i] || {};
    const arbCode = r.code || null;
    return {
      session:     d.session,
      order:       d.order,
      text:        d.text,
      groundTruth: d.groundTruth,
      flashCode:   d.flashCode,
      proCode:     d.proCode,
      arbiterCode: arbCode,
      arbiterReasoning: r.reasoning || null,
      flashCorrect:   sameCategory(d.flashCode, d.groundTruth),
      proCorrect:     sameCategory(d.proCode, d.groundTruth),
      arbiterCorrect: arbCode ? sameCategory(arbCode, d.groundTruth) : null,
    };
  });

  for (const a of annotated) {
    if (a.flashCorrect)   correctByFlash++;
    if (a.proCorrect)     correctByPro++;
    if (a.arbiterCorrect) correctByArbiter++;
  }

  const total = annotated.length;
  console.log(`\nAmong ${total} disagreements:`);
  console.log(`  Flash correct:   ${correctByFlash}/${total} = ${(100 * correctByFlash / total).toFixed(1)}%`);
  console.log(`  Pro correct:     ${correctByPro}/${total} = ${(100 * correctByPro / total).toFixed(1)}%`);
  console.log(`  Arbiter correct: ${correctByArbiter}/${total} = ${(100 * correctByArbiter / total).toFixed(1)}%`);

  // 5. Save
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(RESULTS_DIR, `disagree-arbitration__${ts}.json`);
  fs.writeFileSync(outPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    arbiterModel: ARBITER_MODEL,
    sessions,
    totalDisagreements: total,
    summary: {
      flashCorrect:   correctByFlash,
      proCorrect:     correctByPro,
      arbiterCorrect: correctByArbiter,
    },
    cases: annotated,
  }, null, 2));
  console.log(`\nResult written to ${outPath}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
