'use strict';

/**
 * Run the DPICS coding step (only) against a seeded eval session, for a given
 * model + prompt version, and score the output against the ground-truth codes
 * stored in Utterance.adminComment by dpics-eval-seed.cjs.
 *
 * Deliberately bypasses the rest of the production pipeline (role ID, quality
 * gate, feedback, profiling) — roles are already pre-seeded, so coding accuracy
 * is the only variable under test. Does NOT write predictions back to
 * Utterance.pcitTag/noraTag — those columns get clobbered on every run, so the
 * result JSON file is the durable record. Read-only against the DB.
 *
 * Usage:
 *   node server/scripts/dpics-eval-run.cjs --session <label|sessionId> [--model <key>] [--prompt <name>] [--manual <path>]
 *
 *   --session  Label from eval-results/dpics/sessions.json (e.g. "session-1") or a raw session UUID.
 *   --model    LLM model key/id, e.g. "gemini", "claude", "gemini-3.1-pro-preview". Default: profile
 *              default ("gemini").
 *   --prompt   Prompt file name under server/prompts/ (without .txt). Default: "dpicsCoding".
 *   --manual   Path to the DPICS manual PDF attached to the Gemini context cache. Default: the
 *              current production manual (Manual_for_the_Dyadic_Parent-Child_Interaction_Cod.pdf).
 *              Pass a different PDF (e.g. the older DPICS-Manual.2.18.pdf) to test a prompt against
 *              a different manual revision's grounding context.
 *   --no-cache Skip the Gemini context cache entirely — no manual PDF or appendix attached, no
 *              file upload, no cachedContents creation. The model sees only the system prompt
 *              (plain-text prepended) and the utterance data. Use this to test a self-contained
 *              prompt (one with no "see manual" references) purely on its own merit.
 *
 * Writes: eval-results/dpics/<session-label>__<model>__<prompt>__<timestamp>.json
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const prisma = require('../services/db.cjs');
const { llmCall } = require('../llm/gateway.cjs');
const { loadPrompt } = require('../prompts/index.cjs');
const { getUtterances } = require('../utils/utteranceUtils.cjs');
const { sameCategory } = require('./dpics-eval-codes.cjs');

// Short content hash of the prompt file's text, included in output filenames
// and stored metadata. Prompt files get edited in place over time (e.g.
// dpicsCoding-v4.txt today vs. last week), so the prompt NAME alone doesn't
// uniquely identify what was actually run. The hash makes every distinct
// revision its own permanent, comparable record — never overwritten or
// deleted, so old and new revisions of the "same" prompt name can still be
// diffed against each other later.
function contentHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 8);
}

const DPICS_PDF_PATH      = process.env.DPICS_PDF_PATH      || path.join(__dirname, '../assets/Manual_for_the_Dyadic_Parent-Child_Interaction_Cod.pdf');
const DPICS_APPENDIX_PATH = process.env.DPICS_APPENDIX_PATH || path.join(__dirname, '../assets/appendix A - words_sufficiently_positive.json');

const RESULTS_DIR = path.resolve(__dirname, '../../eval-results/dpics');

function parseArgs(argv) {
  const args = { model: null, prompt: 'dpicsCoding', session: null, manual: null, noCache: false, legacyCache: false, fewShot: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--session') args.session = argv[++i];
    else if (argv[i] === '--model') args.model = argv[++i];
    else if (argv[i] === '--prompt') args.prompt = argv[++i];
    else if (argv[i] === '--manual') args.manual = argv[++i];
    else if (argv[i] === '--no-cache') args.noCache = true;
    else if (argv[i] === '--legacy-cache') args.legacyCache = true;
    // Prepend fully-coded reference sessions to the user message as few-shot examples.
    // Accepts comma-separated labels: --few-shot session-3,session-6
    else if (argv[i] === '--few-shot') args.fewShot = argv[++i].split(',').map(s => s.trim());
  }
  return args;
}

function resolveSessionId(sessionArg) {
  const mapPath = path.join(RESULTS_DIR, 'sessions.json');
  if (fs.existsSync(mapPath)) {
    const map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
    if (map[sessionArg]) return { id: map[sessionArg], label: sessionArg };
  }
  // Fall back to treating the arg as a raw session ID; find its label if any
  if (fs.existsSync(mapPath)) {
    const map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
    const label = Object.keys(map).find(k => map[k] === sessionArg);
    if (label) return { id: sessionArg, label };
  }
  return { id: sessionArg, label: sessionArg };
}

async function codeSession(session, utterances, promptName, modelOverride, manualPath, noCache, legacyCache, fewShotUtterances = null) {
  const dpicsSystemPrompt = loadPrompt(promptName);
  const promptHash = contentHash(dpicsSystemPrompt);
  const pdfPath = manualPath || DPICS_PDF_PATH;

  const utterancesData = utterances.map((utt, idx) => ({
    id: idx,
    role: utt.role,
    text: utt.text,
  }));
  const idxToUttId = utterances.map(utt => utt.id);

  let fewShotBlock = '';
  if (fewShotUtterances && fewShotUtterances.length > 0) {
    const blocks = fewShotUtterances.map(({ label: fsLabel, utterances: fsUtts }, i) => {
      const fewShotData = fsUtts.map(u => {
        const entry = { role: u.role, text: u.text };
        if (u.role === 'adult' && u.adminComment && u.adminComment !== 'TBD') entry.code = u.adminComment;
        return entry;
      });
      return `## Reference Example ${i + 1} (${fsLabel})\n\n${JSON.stringify(fewShotData, null, 2)}`;
    });
    fewShotBlock = `The following ${fewShotUtterances.length > 1 ? 'sessions are' : 'session is'} fully coded with ground-truth DPICS codes. Use them to calibrate your coding before tackling the next session.\n\n${blocks.join('\n\n---\n\n')}\n\n---\n\n`;
  }

  function buildChunkPrompt(chunk) {
    const nonce = require('crypto').randomUUID();
    return `[nonce:${nonce}]\n${fewShotBlock}Code every utterance where role is "adult". Skip all "child" entries.

${JSON.stringify(chunk, null, 2)}

Return a minified JSON array for adult utterances only:
[{"id": <int>, "subject": <string>, "code": <string>}, ...]
- "subject": who or what the utterance is primarily about — choose the most specific applicable label:
  "兒童" (the child), "物品/玩具" (an object or toy), "家長自身" (the parent themselves), "遊戲角色" (a pretend/play character), "第三方" (another person not the child), "不明" (unclear)
- "code": the single DPICS code
- Return ONLY the JSON array — no text, no markdown, no code fences
- First character MUST be [, last character MUST be ]
- Every adult entry MUST have "id", "subject", and "code"`;
  }

  const chunks = [utterancesData];

  // Files-only cache: keyed purely by manual filename (NOT prompt content), so the same
  // cache is reused across every prompt variant tested against the same manual. The prompt
  // text itself is prepended to the per-call message instead of baked into the cache (see
  // gateway.cjs cacheFilesOnly handling) — Gemini rejects a separate systemInstruction field
  // alongside cachedContent, but plain prompt text alongside cachedContent works fine.
  // Gemini's cachedContents are model-specific — a cache built for gemini-3.5-flash
  // cannot be reused by gemini-3.1-pro-preview ("Model used by GenerateContent request
  // ... and CachedContent ... has to be the same."). Include the model in the cache key
  // so each distinct Gemini model gets its own cache; the underlying file upload itself
  // is still shared across all of them.
  const modelKeyTag = (modelOverride || 'gemini-3.5-flash').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dpicsCacheConfig = noCache ? null : (legacyCache ? {
    key:         `dpics-eval-cdi-${promptName}-${promptHash}-${path.basename(pdfPath, '.pdf')}-${modelKeyTag}`,
    primaryFile: pdfPath,
    systemPrompt: dpicsSystemPrompt,
    extraFiles:  [{ path: DPICS_APPENDIX_PATH, mimeType: 'application/json' }],
  } : {
    key:         `dpics-eval-cdi-filesonly-${path.basename(pdfPath, '.pdf')}-${modelKeyTag}`,
    primaryFile: pdfPath,
    systemPrompt: dpicsSystemPrompt,
    extraFiles:  [{ path: DPICS_APPENDIX_PATH, mimeType: 'application/json' }],
    filesOnly:   true,
  });

  const callOptions = {
    profile: 'pcit-coding',
    label:   'dpics-eval',
    sessionId: session.id,
    _geminiConfig: { seed: 42 },
  };
  if (noCache) {
    callOptions.systemPrompt = dpicsSystemPrompt;
  } else {
    callOptions.cache = dpicsCacheConfig;
  }
  if (modelOverride) callOptions.model = modelOverride;

  const chunkResults = await Promise.all(
    chunks.map(chunk => llmCall(buildChunkPrompt(chunk), callOptions))
  );
  let codingResults = chunkResults.flat();
  if (!codingResults.every(r => r && typeof r === 'object')) {
    throw new Error('Expected array of coding results from all chunks');
  }

  // Supplemental pass for missed adult utterances (mirrors production behavior)
  const codedIdSet = new Set(codingResults.map(r => r.id));
  const missedAdultUtts = utterancesData.filter(u => u.role === 'adult' && !codedIdSet.has(u.id));
  if (missedAdultUtts.length > 0) {
    console.warn(`  ${missedAdultUtts.length} adult utterances missed — running supplemental pass...`);
    try {
      const supplementalPrompt = `These adult utterances were missed in the prior pass. Code each one and return ONLY a valid JSON array:

${JSON.stringify(missedAdultUtts, null, 2)}`;
      const supplementalOptions = {
        profile: 'pcit-coding-supplemental',
        label:   'dpics-eval-supplemental',
        sessionId: session.id,
        _geminiConfig: { seed: 42 },
      };
      if (noCache) {
        supplementalOptions.systemPrompt = dpicsSystemPrompt;
      } else {
        supplementalOptions.cache = dpicsCacheConfig;
      }
      if (modelOverride) supplementalOptions.model = modelOverride;
      const supplementalResults = await llmCall(supplementalPrompt, supplementalOptions);
      if (Array.isArray(supplementalResults) && supplementalResults.length > 0) {
        codingResults = [...codingResults, ...supplementalResults];
      }
    } catch (suppErr) {
      console.warn(`  Supplemental coding failed (non-blocking): ${suppErr.message}`);
    }
  }

  const predictedById = {};
  for (const result of codingResults) {
    if (result.id !== undefined && result.code) {
      const actualUttId = idxToUttId[result.id];
      if (actualUttId) predictedById[actualUttId] = result.code;
    }
  }
  return { predictedById, promptHash };
}

function scoreResults(utterances, predictedById) {
  const rows = [];
  for (const u of utterances) {
    if (u.role !== 'adult') continue;
    const groundTruth = u.adminComment || null;
    const predicted = predictedById[u.id] || null;
    rows.push({
      order: u.order,
      text: u.text,
      groundTruth,
      predicted,
      match: groundTruth !== null && predicted !== null && groundTruth === predicted,
      categoryMatch: sameCategory(groundTruth, predicted),
    });
  }

  // TBD = codeable content excluded from the original human coding for an
  // unrelated procedural/timing reason, not because it's uncodeable — exclude
  // from accuracy the same way null (no ground truth at all) is excluded.
  const scored = rows.filter(r => r.groundTruth !== null && r.groundTruth !== 'TBD');
  const matches = scored.filter(r => r.match).length;
  const categoryMatches = scored.filter(r => r.categoryMatch).length;
  const missingPrediction = scored.filter(r => r.predicted === null).length;

  return {
    rows,
    summary: {
      totalAdultUtterances: rows.length,
      groundTruthCoded: scored.length,
      matches,
      categoryMatches,
      missingPrediction,
      accuracy: scored.length > 0 ? +(matches / scored.length * 100).toFixed(2) : null,
      categoryAccuracy: scored.length > 0 ? +(categoryMatches / scored.length * 100).toFixed(2) : null,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.session) {
    console.error('Usage: node server/scripts/dpics-eval-run.cjs --session <label|sessionId> [--model <key>] [--prompt <name>]');
    process.exit(1);
  }

  const { id: sessionId, label } = resolveSessionId(args.session);

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    console.error(`Session ${sessionId} not found`);
    process.exit(1);
  }

  const utterances = await getUtterances(sessionId);
  if (utterances.length === 0) {
    console.error(`No utterances found for session ${sessionId}`);
    process.exit(1);
  }

  let fewShotUtterances = null;
  if (args.fewShot) {
    fewShotUtterances = [];
    for (const fsArg of args.fewShot) {
      const { id: fsId, label: fsLabel } = resolveSessionId(fsArg);
      const fsUtts = await getUtterances(fsId);
      if (fsUtts.length === 0) {
        console.error(`No utterances found for few-shot session ${fsArg}`);
        process.exit(1);
      }
      console.log(`Few-shot: ${fsLabel} (${fsUtts.length} utterances)`);
      fewShotUtterances.push({ label: fsLabel, utterances: fsUtts });
    }
  }

  console.log(`\nSession: ${label} (${sessionId})`);
  console.log(`Model:   ${args.model || '(profile default — gemini)'}`);
  console.log(`Prompt:  ${args.prompt}`);
  console.log(`Manual:  ${args.noCache ? '(none — --no-cache)' : (args.manual || DPICS_PDF_PATH)}`);
  console.log(`Utterances: ${utterances.length} (${utterances.filter(u => u.role === 'adult').length} adult)\n`);

  const t0 = Date.now();
  const { predictedById, promptHash } = await codeSession(session, utterances, args.prompt, args.model, args.manual, args.noCache, args.legacyCache, fewShotUtterances);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Prompt content hash: ${promptHash} (distinguishes in-place edits to the same prompt file)`);

  const { rows, summary } = scoreResults(utterances, predictedById);

  console.log(`\nDone in ${elapsed}s`);
  console.log(`Exact accuracy:    ${summary.matches}/${summary.groundTruthCoded} = ${summary.accuracy}%`);
  console.log(`Category accuracy: ${summary.categoryMatches}/${summary.groundTruthCoded} = ${summary.categoryAccuracy}%  (treats known old/new-manual code splits as equivalent — see dpics-eval-codes.cjs)`);
  if (summary.missingPrediction > 0) {
    console.log(`Missing predictions: ${summary.missingPrediction}`);
  }

  const mismatches = rows.filter(r => r.groundTruth !== null && !r.match);
  if (mismatches.length > 0) {
    console.log(`\nMismatches (${mismatches.length}, * = same category):`);
    for (const m of mismatches.slice(0, 20)) {
      console.log(`  ${m.categoryMatch ? '*' : ' '} [${m.groundTruth} -> ${m.predicted || 'MISSING'}] ${m.text}`);
    }
    if (mismatches.length > 20) console.log(`  ... and ${mismatches.length - 20} more`);
  }

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const modelTag = (args.model || 'gemini-default').replace(/[^a-zA-Z0-9_-]/g, '_');
  const manualName = path.basename(args.manual || DPICS_PDF_PATH, '.pdf');
  const manualLabel = manualName.startsWith('DPICS-Manual') ? 'old' : 'new';
  const manualTag = args.noCache ? '__nocache' : (args.legacyCache ? `__legacycache-${manualLabel}` : (args.manual ? `__${manualName.replace(/[^a-zA-Z0-9_-]/g, '_')}` : `__${manualLabel}`));
  const fewShotTag = args.fewShot ? `__fewshot-${args.fewShot.map(s => s.replace(/[^a-zA-Z0-9_-]/g, '_')).join('_')}` : '';
  const outPath = path.join(RESULTS_DIR, `${label}__${modelTag}__${args.prompt}-${promptHash}${manualTag}${fewShotTag}__${timestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify({
    sessionId,
    label,
    model: args.model || 'gemini-default',
    prompt: args.prompt,
    promptHash,
    manual: args.noCache ? null : manualName,
    noCache: !!args.noCache,
    timestamp,
    summary,
    utterances: rows,
  }, null, 2));
  console.log(`\nResult written to ${outPath}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal error:', err.message);
  console.error(err.stack);
  await prisma.$disconnect();
  process.exit(1);
});
