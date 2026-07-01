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
 *   node server/scripts/dpics-eval-run.cjs --session <label|sessionId> --grounding <cache|embed|none>
 *     [--rules-location <user|cache>] [--model <key>] [--prompt <name>] [--manual <path>] [--few-shot <labels>]
 *
 *   --session        Label from eval-results/dpics/sessions.json (e.g. "session-1") or a raw session UUID.
 *   --grounding      Required. Where the DPICS manual lives, one of:
 *                       cache  — Gemini's native cachedContents mechanism (file upload + cache resource).
 *                                Only valid for models with supportsCache:true in llm/models.cjs (today: gemini).
 *                       embed  — manual (extracted .txt) + appendix JSON go into the system field as plain
 *                                text. Works for any model — required for models with no cache mechanism
 *                                (deepseek, qwen, openai, claude), but usable on any model to A/B test
 *                                cache vs. embed.
 *                       none   — no manual at all. Tests whether the coding prompt is self-contained.
 *   --rules-location Where the coding-rules prompt (--prompt) lives. Required if and only if
 *                     --grounding cache; errors if passed with --grounding embed|none.
 *                       user   — rules prepended to every user message; the cache holds only the
 *                                manual+appendix, reusable across every prompt variant tested.
 *                       cache  — rules baked into the Gemini cache alongside the manual (cache is
 *                                specific to that prompt revision).
 *                     For --grounding embed, the rules always join the manual in the system field.
 *                     For --grounding none, the rules are the entire system field.
 *   --model    LLM model key/id, e.g. "gemini", "claude", "gemini-3.1-pro-preview". Default: "gemini".
 *   --prompt   Prompt file name under server/prompts/ (without .txt). Default: "dpicsCoding".
 *   --manual   Path to the DPICS manual PDF. Default: the current production manual
 *              (Manual_for_the_Dyadic_Parent-Child_Interaction_Cod.pdf). Ignored when --grounding none.
 *   --few-shot Comma-separated session labels to prepend to the user message as fully-coded
 *              reference examples, e.g. --few-shot session-3,session-6.
 *
 * The session utterances themselves always go in the user message, for both the primary
 * coding call and the supplemental pass — this is a fixed invariant, not a flag.
 *
 * Writes: eval-results/dpics/<session-label>__<model>__<prompt>-<hash>__<grounding-tag>__<timestamp>.json
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const prisma = require('../services/db.cjs');
const { llmCall } = require('../llm/gateway.cjs');
const { resolveModel } = require('../llm/models.cjs');
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

const GROUNDING_MODES  = ['cache', 'embed', 'none'];
const RULES_LOCATIONS  = ['user', 'cache'];

const CODE_ALL_LEADIN = 'Code every utterance where role is "adult". Skip all "child" entries.';
const MISSED_LEADIN   = 'These adult utterances were missed in the prior pass. Code each one.';

function parseArgs(argv) {
  const args = { model: null, prompt: 'dpicsCoding', session: null, manual: null, grounding: null, rulesLocation: null, fewShot: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--session') args.session = argv[++i];
    else if (argv[i] === '--model') args.model = argv[++i];
    else if (argv[i] === '--prompt') args.prompt = argv[++i];
    else if (argv[i] === '--manual') args.manual = argv[++i];
    else if (argv[i] === '--grounding') args.grounding = argv[++i];
    else if (argv[i] === '--rules-location') args.rulesLocation = argv[++i];
    // Prepend fully-coded reference sessions to the user message as few-shot examples.
    // Accepts comma-separated labels: --few-shot session-3,session-6
    else if (argv[i] === '--few-shot') args.fewShot = argv[++i].split(',').map(s => s.trim());
  }
  return args;
}

const USAGE = 'Usage: node server/scripts/dpics-eval-run.cjs --session <label|sessionId> --grounding <cache|embed|none> [--rules-location <user|cache>] [--model <key>] [--prompt <name>] [--manual <path>] [--few-shot <labels>]';

function validateArgs(args) {
  if (!args.session) throw new Error('--session is required');
  if (!args.grounding) throw new Error('--grounding is required: cache | embed | none');
  if (!GROUNDING_MODES.includes(args.grounding)) {
    throw new Error(`--grounding must be one of ${GROUNDING_MODES.join(', ')}, got "${args.grounding}"`);
  }
  if (args.grounding === 'cache') {
    if (!args.rulesLocation) throw new Error('--rules-location is required when --grounding cache: user | cache');
    if (!RULES_LOCATIONS.includes(args.rulesLocation)) {
      throw new Error(`--rules-location must be one of ${RULES_LOCATIONS.join(', ')}, got "${args.rulesLocation}"`);
    }
  } else if (args.rulesLocation) {
    throw new Error(`--rules-location only applies to --grounding cache (got --grounding ${args.grounding})`);
  }

  const modelKey = args.model || 'gemini';
  const modelDef = resolveModel(modelKey);
  if (args.grounding === 'cache' && !modelDef.supportsCache) {
    throw new Error(`Model "${modelKey}" does not support --grounding cache (no cache mechanism wired up in llm/models.cjs). Use --grounding embed or --grounding none instead.`);
  }
}

function resolveSessionId(sessionArg) {
  const mapPath = path.join(RESULTS_DIR, 'sessions.json');
  if (!fs.existsSync(mapPath)) return { id: sessionArg, label: sessionArg };
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
  if (map[sessionArg]) return { id: map[sessionArg], label: sessionArg };
  const label = Object.keys(map).find(k => map[k] === sessionArg);
  if (label) return { id: sessionArg, label };
  return { id: sessionArg, label: sessionArg };
}

// Builds the single grounding descriptor consumed identically by the primary and
// supplemental coding calls, so neither pass can independently drift from the other
// on where the manual/rules actually end up.
function buildGroundingStrategy({ grounding, rulesLocation, rulesText, manualPath, appendixPath, modelKeyTag }) {
  const manualLabel = path.basename(manualPath, '.pdf');

  if (grounding === 'none') {
    return { mode: 'none', systemPrompt: rulesText, userPrefix: '', cache: null, manualLabel: null };
  }

  if (grounding === 'embed') {
    const manualTxtPath = manualPath.replace(/\.pdf$/i, '.txt');
    if (!fs.existsSync(manualTxtPath)) {
      throw new Error(`Extracted manual text not found at ${manualTxtPath}. Run: pdftotext "${manualPath}" "${manualTxtPath}"`);
    }
    const manualText  = fs.readFileSync(manualTxtPath, 'utf8');
    const appendixRaw = fs.readFileSync(appendixPath, 'utf8');
    const systemPrompt = `${rulesText}\n\n---\n\n## DPICS Manual (Reference)\n\n${manualText}\n\n---\n\n## Appendix A — Sufficiently Positive Words\n\n${appendixRaw}`;
    return { mode: 'embed', systemPrompt, userPrefix: '', cache: null, manualLabel };
  }

  // grounding === 'cache'
  // Gemini rejects combining cachedContent with a systemInstruction field, but not with
  // plain prompt text — so rulesLocation:'user' keeps the cache files-only (reusable
  // across every prompt variant tested against this manual) and prepends the rules text
  // to the per-call user message instead. rulesLocation:'cache' bakes the rules into the
  // cache itself, so the cache key must include a hash of them (a rules edit invalidates it).
  const cache = {
    key:          `dpics-eval-${manualLabel}-${modelKeyTag}${rulesLocation === 'cache' ? `-rules-${contentHash(rulesText)}` : ''}`,
    primaryFile:  manualPath,
    extraFiles:   [{ path: appendixPath, mimeType: 'application/json' }],
    systemPrompt: rulesLocation === 'cache' ? rulesText : null,
    filesOnly:    rulesLocation !== 'cache',
  };
  return {
    mode: 'cache',
    systemPrompt: null,
    userPrefix: rulesLocation === 'user' ? rulesText : '',
    cache,
    manualLabel,
  };
}

function buildCallOptions(strategy, base) {
  const opts = { ...base };
  if (strategy.systemPrompt) opts.systemPrompt = strategy.systemPrompt;
  if (strategy.cache) opts.cache = strategy.cache;
  return opts;
}

// The output schema instructions, shared verbatim by the primary and supplemental
// passes — this used to live only in the primary prompt, which meant a supplemental
// pass could return results with no "code" field and get silently dropped.
function buildInstructionBlock() {
  return `Return a JSON array for adult utterances only:
[
  {
    "id": <int>,
    "text": "家長口語表達字面文字",
    "difficulty": "Easy / Medium / Hard",
    "clinical_reasoning": "根据 difficulty 级别決定是否留空，或寫入對應長度的臨床思維推導。",
    "subject_cot": "兒童 / 物品/玩具 / 家長自身 / 遊戲角色 / 第三方 / 不明",
    "code": "FINAL_CODE"
  }
]
- "difficulty": Easy = unambiguous by surface form alone; Medium = requires subject or context inference; Hard = genuine boundary case requiring full priority-rule reasoning
- "clinical_reasoning": if easy 1 sentence; if Medium 5-10 sentences; if Hard 20 sentences walking through the priority rules
- "subject_cot": who or what the utterance is primarily about
- "code": the single DPICS code (must be one of: NTA DC IC LP UP IQ DQ RF BD TA NC)
- Return ONLY the JSON array — no markdown, no code fences
- First character MUST be [, last character MUST be ]
- Every adult entry MUST have all six fields`;
}

function buildFewShotBlock(fewShotUtterances) {
  if (!fewShotUtterances || fewShotUtterances.length === 0) return '';
  const blocks = fewShotUtterances.map(({ label: fsLabel, utterances: fsUtts }, i) => {
    const fewShotData = fsUtts.map(u => {
      const entry = { role: u.role, text: u.text };
      if (u.role === 'adult' && u.adminComment && u.adminComment !== 'TBD') entry.code = u.adminComment;
      return entry;
    });
    return `## Reference Example ${i + 1} (${fsLabel})\n\n${JSON.stringify(fewShotData, null, 2)}`;
  });
  return `The following ${fewShotUtterances.length > 1 ? 'sessions are' : 'session is'} fully coded with ground-truth DPICS codes. Use them to calibrate your coding before tackling the next session.\n\n${blocks.join('\n\n---\n\n')}\n\n---\n\n`;
}

function buildUserMessage(strategy, { leadIn, utterances, fewShotBlock = '' }) {
  const nonce = crypto.randomUUID();
  const rulesBlock = strategy.userPrefix ? `${strategy.userPrefix}\n\n---\n\n` : '';
  return `[nonce:${nonce}]\n${rulesBlock}${fewShotBlock}${leadIn}

${JSON.stringify(utterances, null, 2)}

${buildInstructionBlock()}`;
}

async function codeSession(session, sessionLabel, utterances, { promptName, model, grounding, rulesLocation, manualPath, fewShotUtterances }) {
  const rulesText  = loadPrompt(promptName);
  const promptHash = contentHash(rulesText);
  const resolvedManualPath = manualPath || DPICS_PDF_PATH;
  const modelDef = resolveModel(model || 'gemini');

  // Gemini's cachedContents are model-specific — a cache built for gemini-3.5-flash
  // cannot be reused by gemini-3.1-pro-preview. Key on the resolved primary model id
  // (not the possibly-generic key like "gemini") so each concrete model gets its own cache.
  const modelKeyTag = modelDef.primary.replace(/[^a-zA-Z0-9_-]/g, '_');

  const strategy = buildGroundingStrategy({
    grounding, rulesLocation, rulesText,
    manualPath: resolvedManualPath,
    appendixPath: DPICS_APPENDIX_PATH,
    modelKeyTag,
  });

  if (grounding === 'embed') {
    console.log(`  [embed] system prompt: ${(strategy.systemPrompt.length / 1000).toFixed(0)}K chars`);
  }

  const utterancesData = utterances.map((utt, idx) => ({ id: idx, role: utt.role, text: utt.text }));
  const idxToUttId = utterances.map(utt => utt.id);
  const fewShotBlock = buildFewShotBlock(fewShotUtterances);

  const baseCallOptions = { profile: 'pcit-coding', label: 'dpics-eval', sessionId: session.id, _geminiConfig: { seed: 42 } };
  if (model) baseCallOptions.model = model;
  const callOptions = buildCallOptions(strategy, baseCallOptions);

  const primaryPrompt = buildUserMessage(strategy, { leadIn: CODE_ALL_LEADIN, utterances: utterancesData, fewShotBlock });
  const primaryResult = await llmCall(primaryPrompt, callOptions);
  let codingResults = Array.isArray(primaryResult) ? primaryResult : [primaryResult];
  if (!codingResults.every(r => r && typeof r === 'object')) {
    throw new Error('Expected array of coding results from the primary call');
  }

  // Supplemental pass for missed adult utterances (mirrors production behavior).
  // Reuses the exact same grounding strategy and instruction schema as the primary
  // call, so it can no longer silently lose the manual/rules/schema the way ad hoc
  // per-branch options used to.
  const codedIdSet = new Set(codingResults.map(r => r.id));
  const missedAdultUtts = utterancesData.filter(u => u.role === 'adult' && !codedIdSet.has(u.id));
  if (missedAdultUtts.length > 0) {
    console.warn(`  ${missedAdultUtts.length} adult utterances missed — running supplemental pass...`);
    try {
      const supplementalBaseOptions = { profile: 'pcit-coding-supplemental', label: 'dpics-eval-supplemental', sessionId: session.id, _geminiConfig: { seed: 42 } };
      if (model) supplementalBaseOptions.model = model;
      const supplementalOptions = buildCallOptions(strategy, supplementalBaseOptions);
      const supplementalPrompt = buildUserMessage(strategy, { leadIn: MISSED_LEADIN, utterances: missedAdultUtts });
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
      if (actualUttId) predictedById[actualUttId] = result;
    }
  }
  return { predictedById, promptHash, strategy };
}

function scoreResults(utterances, predictedById) {
  const rows = [];
  for (const u of utterances) {
    if (u.role !== 'adult') continue;
    const groundTruth = u.adminComment || null;
    const result = predictedById[u.id] || null;
    const predicted = result?.code || null;
    rows.push({
      order: u.order,
      text: u.text,
      groundTruth,
      subject: result?.subject_cot || result?.subject || null,
      reasoning: result?.clinical_reasoning || result?.reasoning || null,
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
  try {
    validateArgs(args);
  } catch (err) {
    console.error(`Error: ${err.message}\n`);
    console.error(USAGE);
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

  console.log(`\nSession:   ${label} (${sessionId})`);
  console.log(`Model:     ${args.model || '(profile default — gemini)'}`);
  console.log(`Prompt:    ${args.prompt}`);
  console.log(`Grounding: ${args.grounding}${args.grounding === 'cache' ? ` (rules-location: ${args.rulesLocation})` : ''}`);
  if (args.grounding !== 'none') {
    console.log(`Manual:    ${args.manual || DPICS_PDF_PATH}${args.manual ? '' : ' (default)'}`);
  } else if (args.manual) {
    console.warn(`  --manual ignored: --grounding none uses no manual`);
  }
  console.log(`Utterances: ${utterances.length} (${utterances.filter(u => u.role === 'adult').length} adult)\n`);

  const t0 = Date.now();
  const { predictedById, promptHash, strategy } = await codeSession(session, label, utterances, {
    promptName: args.prompt,
    model: args.model,
    grounding: args.grounding,
    rulesLocation: args.rulesLocation,
    manualPath: args.manual,
    fewShotUtterances,
  });
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
  const groundingTag = strategy.mode === 'cache'
    ? `__cache-${args.rulesLocation}-${strategy.manualLabel}`
    : strategy.mode === 'embed'
      ? `__embed-${strategy.manualLabel}`
      : '__none';
  const fewShotTag = args.fewShot ? `__fewshot-${args.fewShot.map(s => s.replace(/[^a-zA-Z0-9_-]/g, '_')).join('_')}` : '';
  const outPath = path.join(RESULTS_DIR, `${label}__${modelTag}__${args.prompt}-${promptHash}${groundingTag}${fewShotTag}__${timestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify({
    sessionId,
    label,
    model: args.model || 'gemini-default',
    prompt: args.prompt,
    promptHash,
    grounding: { mode: strategy.mode, rulesLocation: args.rulesLocation || null, manual: strategy.manualLabel },
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
