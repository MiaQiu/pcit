'use strict';

/**
 * Build a per-session review table (markdown) comparing original human coding
 * against a model run: role, original_text (raw, with annotations),
 * verbalization (cleaned text actually sent to the model), original_coding
 * (ground truth), AI_coding_manual (raw predicted code), AI_coding_re-categorized
 * (predicted code's equivalence-group representative, per dpics-eval-codes.cjs),
 * and match (blank if category-match, "N" if not — blank also for child rows
 * and TBD ground truth, since those aren't scored).
 *
 * Mirrors dpics-eval-seed.cjs's normalizeUtterances() exactly (including the
 * empty-after-cleaning skip and text-fallback cleaning) so row order lines up
 * 1:1 with what's actually in the DB and in the run result's `order` field.
 *
 * Usage:
 *   node server/scripts/dpics-eval-table.cjs <fixturesDir> --prompt <name> [--model <key>] [--out <path>]
 */

const fs   = require('fs');
const path = require('path');
const { CODE_GROUPS } = require('./dpics-eval-codes.cjs');

const RESULTS_DIR = path.resolve(__dirname, '../../eval-results/dpics');

const CANONICAL_BY_CODE = {};
for (const group of CODE_GROUPS) {
  for (const code of group) CANONICAL_BY_CODE[code] = group[0];
}
function canonicalOf(code) {
  if (!code) return '';
  return CANONICAL_BY_CODE[code] || code;
}

// Mirrors dpics-eval-seed.cjs cleanText()
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

function parseArgs(argv) {
  const args = { fixturesDir: null, prompt: 'dpicsCoding-v4', model: 'gemini-default', out: null, resultsDir: null, runs: 1, labelPrefix: 'session' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--prompt') args.prompt = argv[++i];
    else if (argv[i] === '--model') args.model = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--results-dir') args.resultsDir = argv[++i];
    else if (argv[i] === '--runs') args.runs = parseInt(argv[++i], 10);
    else if (argv[i] === '--label-prefix') args.labelPrefix = argv[++i];
    else if (!args.fixturesDir) args.fixturesDir = argv[i];
  }
  return args;
}

function buildCanonicalRows(rawUtterances) {
  const rows = [];
  rawUtterances.forEach((u) => {
    const usedFallback = u.verbalization === undefined;
    const verbalization = usedFallback ? cleanText(u.text || '') : (u.verbalization || '').trim();
    const originalText = u.text || '';
    if (!verbalization) return; // mirrors seed script's empty-after-clean skip

    rows.push({
      role: u.role,
      speaker: u.speaker || (u.role === 'adult' ? 'parent' : 'child'),
      originalText,
      verbalization,
      code: u.role === 'adult' ? (u.code || null) : null,
    });
  });
  return rows;
}

function findResultFiles(label, model, prompt, resultsDir, n = 1) {
  const dir = resultsDir || RESULTS_DIR;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'sessions.json');
  // Result filenames are `${label}__${model}__${prompt}-${promptHash}${tags}__${timestamp}.json` —
  // the prompt name is followed by a hyphen + content hash, not necessarily `__` directly, so
  // match on the prefix up through the prompt name and require the very next char be `-` or `_`
  // (never a bare continuation, e.g. "agentic-v1" matching "agentic-v10").
  const prefix = `${label}__${model}__${prompt}`;
  const matches = files.filter(f => f.startsWith(prefix) && /^[-_]/.test(f.slice(prefix.length)));
  if (matches.length === 0) return [];
  matches.sort();
  return matches.slice(-n).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
}

function csvField(value) {
  const s = String(value === null || value === undefined ? '' : value);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.fixturesDir) {
    console.error('Usage: node server/scripts/dpics-eval-table.cjs <fixturesDir> --prompt <name> [--model <key>] [--out <path>] [--label-prefix <prefix>]');
    process.exit(1);
  }

  const dir = path.resolve(args.fixturesDir);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  const outPath = args.out || path.join(RESULTS_DIR, `${args.labelPrefix === 'session' ? '' : args.labelPrefix + '__'}${args.prompt}__review-tables.csv`);

  const n = args.runs;
  const runHeaders = n === 1
    ? ['AI_coding_manual', 'AI_coding_re-categorized', 'match']
    : Array.from({ length: n }, (_, i) => `run${i + 1}`).concat(['match']);
  const header = ['session', 'role', 'original_text', 'verbalization', 'original_coding', ...runHeaders];
  const lines = [header.map(csvField).join(',')];

  files.forEach((f, idx) => {
    const label = `${args.labelPrefix}-${idx + 1}`;
    const fixture = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    const canonicalRows = buildCanonicalRows(fixture.sessions[0].utterances);

    const results = findResultFiles(label, args.model, args.prompt, args.resultsDir, n);
    const predictedByOrderPerRun = results.map(result => {
      const map = {};
      for (const u of result.utterances) map[u.order] = u;
      return map;
    });

    canonicalRows.forEach((row, globalIndex) => {
      if (row.role === 'child') {
        const emptyCols = Array(runHeaders.length).fill('');
        lines.push([label, 'child', row.originalText, row.verbalization, '', ...emptyCols].map(csvField).join(','));
        return;
      }

      const groundTruth = row.code;

      if (n === 1) {
        const pred = predictedByOrderPerRun[0] ? predictedByOrderPerRun[0][globalIndex] : null;
        const predictedCode = pred ? (pred.predicted || '') : '';
        const recategorized = predictedCode ? canonicalOf(predictedCode) : '';
        let match = '';
        if (groundTruth !== null && groundTruth !== 'TBD' && pred) {
          match = pred.categoryMatch ? '' : 'N';
        }
        lines.push([label, 'parent', row.originalText, row.verbalization, groundTruth, predictedCode, recategorized, match].map(csvField).join(','));
      } else {
        const runCols = predictedByOrderPerRun.map(byOrder => {
          const pred = byOrder[globalIndex];
          const code = pred ? (pred.predicted || '') : '';
          if (!groundTruth || groundTruth === 'TBD' || !pred) return code;
          return pred.categoryMatch ? code : (code + '*');
        });
        const anyWrong = runCols.some(c => c.endsWith('*'));
        const match = groundTruth && groundTruth !== 'TBD' ? (anyWrong ? 'N' : '') : '';
        lines.push([label, 'parent', row.originalText, row.verbalization, groundTruth, ...runCols, match].map(csvField).join(','));
      }
    });
  });

  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8');
  console.log(`Written to ${outPath}`);
}

main();
