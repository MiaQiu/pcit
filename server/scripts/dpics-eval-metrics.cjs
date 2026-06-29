'use strict';

/**
 * Compute standard IRR/classification metrics from dpics-eval-run.cjs result
 * files: Cohen's Kappa (agreement vs. the human "master" coder, corrected for
 * chance), Exact Match rate, and per-code Precision/Recall/F1 (one-vs-rest).
 *
 * Each metric is reported twice — "exact" (raw code-for-code) and "category"
 * (codes collapsed via dpics-eval-codes.cjs's equivalence groups, e.g.
 * Q/DQ/IQ) — since several "disagreements" are just old/new-manual
 * granularity differences, not real coding errors. Missing predictions are
 * treated as a literal "(missing)" label so they correctly hurt agreement
 * instead of being silently dropped.
 *
 * Usage:
 *   node server/scripts/dpics-eval-metrics.cjs [--prompt <name>] [--model <key>] [--sessions <a,b,c>]
 *
 *   --prompt    Substring match against result filenames (e.g. "dpicsCoding-v7"). Default: all.
 *   --model     Substring match against result filenames (e.g. "gemini-default"). Default: all.
 *   --sessions  Comma-separated session labels to restrict to (e.g. "session-3,session-4,session-6"
 *               for a train-set slice). Default: all sessions found.
 *
 * Without --prompt, results are grouped the same way dpics-eval-score.cjs
 * groups its leaderboard (by model + prompt + content hash) and metrics are
 * printed per group.
 */

const fs   = require('fs');
const path = require('path');
const { categoryOf } = require('./dpics-eval-codes.cjs');

const RESULTS_DIR = path.resolve(__dirname, '../../eval-results/dpics');
const MISSING = '(missing)';

function parseArgs(argv) {
  const args = { prompt: null, model: null, sessions: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--prompt') args.prompt = argv[++i];
    else if (argv[i] === '--model') args.model = argv[++i];
    else if (argv[i] === '--sessions') args.sessions = new Set(argv[++i].split(',').map(s => s.trim()));
  }
  return args;
}

function loadResults() {
  const files = fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json') && f !== 'sessions.json');
  return files.map(f => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf-8')) }));
}

function groupKey(r) {
  const hashTag = r.promptHash ? ` (${r.promptHash})` : ' (no-hash)';
  return `${r.model} | ${r.prompt}${hashTag}`;
}

/** Cohen's Kappa for two raters over a categorical label set. pairs: [[gt, pred], ...] */
function cohensKappa(pairs) {
  const n = pairs.length;
  const rowCounts = {}, colCounts = {};
  const labels = new Set();
  let agree = 0;
  for (const [a, b] of pairs) {
    rowCounts[a] = (rowCounts[a] || 0) + 1;
    colCounts[b] = (colCounts[b] || 0) + 1;
    labels.add(a); labels.add(b);
    if (a === b) agree++;
  }
  const po = agree / n;
  let pe = 0;
  for (const l of labels) {
    pe += ((rowCounts[l] || 0) / n) * ((colCounts[l] || 0) / n);
  }
  const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);
  return { n, po, pe, kappa };
}

/** Per-code one-vs-rest Precision/Recall/F1, keyed by ground-truth code. */
function perCodeF1(pairs) {
  const codes = new Set(pairs.map(([gt]) => gt)); // score every code that appears in ground truth
  const out = {};
  for (const code of codes) {
    let tp = 0, fp = 0, fn = 0;
    for (const [gt, pred] of pairs) {
      if (gt === code && pred === code) tp++;
      else if (gt === code && pred !== code) fn++;
      else if (gt !== code && pred === code) fp++;
    }
    const precision = (tp + fp) > 0 ? tp / (tp + fp) : null;
    const recall    = (tp + fn) > 0 ? tp / (tp + fn) : null;
    const f1 = (precision !== null && recall !== null && (precision + recall) > 0)
      ? 2 * precision * recall / (precision + recall)
      : 0;
    out[code] = { support: tp + fn, tp, fp, fn, precision, recall, f1 };
  }
  return out;
}

function fmtPct(x) { return x === null ? 'n/a' : (x * 100).toFixed(1) + '%'; }
function fmt3(x)   { return x === null ? 'n/a' : x.toFixed(3); }

function report(label, pairs) {
  const categoryPairs = pairs.map(([gt, pred]) => [categoryOf(gt), pred === MISSING ? MISSING : categoryOf(pred)]);

  const categoryMatches = categoryPairs.filter(([gt, pred]) => gt === pred).length;

  const kCategory = cohensKappa(categoryPairs);

  console.log(`\n${'='.repeat(70)}`);
  console.log(label);
  console.log('='.repeat(70));
  console.log(`n = ${pairs.length}`);
  console.log();
  console.log('Category Match Rate: ' + fmtPct(categoryMatches / pairs.length) + `  (${categoryMatches}/${pairs.length})`);
  console.log();
  console.log("Cohen's Kappa (category): " + fmt3(kCategory.kappa) + `  (observed agreement ${fmtPct(kCategory.po)}, chance agreement ${fmtPct(kCategory.pe)})`);
  console.log('  (Landis & Koch rule of thumb: <0=poor, 0-.20=slight, .21-.40=fair, .41-.60=moderate, .61-.80=substantial, .81-1=almost perfect)');

  const pad = (s, w) => String(s).padEnd(w);

  console.log('\nPer-code F1 — category match (equivalence groups collapsed, sorted by support):');
  const f1cat = perCodeF1(categoryPairs);
  const rowsCat = Object.entries(f1cat).sort((a, b) => b[1].support - a[1].support);
  console.log('  ' + pad('code', 12) + pad('support', 9) + pad('precision', 11) + pad('recall', 9) + pad('F1', 7));
  for (const [code, m] of rowsCat) {
    console.log('  ' + pad(code, 12) + pad(m.support, 9) + pad(fmtPct(m.precision), 11) + pad(fmtPct(m.recall), 9) + pad(fmt3(m.f1), 7));
  }

  console.log('\nConfusion matrix (rows = ground truth, cols = predicted, exact codes):');
  const gtCodes = [...new Set(pairs.map(([gt]) => gt))].sort();
  const predCodes = [...new Set(pairs.map(([, pred]) => pred))].sort();
  console.log('  ' + pad('GT\\Pred', 8) + predCodes.map(c => pad(c, 7)).join(''));
  for (const gt of gtCodes) {
    let line = pad(gt, 8);
    for (const pc of predCodes) {
      const count = pairs.filter(([g, p]) => g === gt && p === pc).length;
      line += pad(count === 0 ? '.' : count, 7);
    }
    console.log('  ' + line);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const results = loadResults();

  const groups = {};
  for (const r of results) {
    if (args.prompt && !r.file.includes(args.prompt)) continue;
    if (args.model && !r.file.includes(args.model)) continue;
    if (args.sessions && !args.sessions.has(r.label)) continue;
    const key = groupKey(r);
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  if (Object.keys(groups).length === 0) {
    console.error('No matching result files found.');
    process.exit(1);
  }

  for (const [key, runs] of Object.entries(groups)) {
    const pairs = [];
    for (const r of runs) {
      for (const u of r.utterances) {
        if (u.groundTruth === null || u.groundTruth === 'TBD') continue;
        pairs.push([u.groundTruth, u.predicted === null ? MISSING : u.predicted]);
      }
    }
    if (pairs.length === 0) continue;
    const sessionList = [...new Set(runs.map(r => r.label))].join(', ');
    report(`${key}\nsessions: ${sessionList}`, pairs);
  }
}

main();
