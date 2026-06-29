'use strict';

/**
 * Aggregate dpics-eval-run.cjs result files into an accuracy leaderboard,
 * grouped by (model, prompt) combo, plus a confusion matrix per combo.
 *
 * Usage:
 *   node server/scripts/dpics-eval-score.cjs [resultsDir]
 *
 * Default resultsDir: eval-results/dpics/
 */

const fs   = require('fs');
const path = require('path');

const RESULTS_DIR = path.resolve(__dirname, '../../eval-results/dpics');

function loadResults(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'sessions.json');
  return files.map(f => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) }));
}

function groupByModelPrompt(results) {
  const groups = {};
  for (const r of results) {
    // promptHash distinguishes in-place edits to the same-named prompt file —
    // older result files predate the hash and fall back to "no-hash" so they
    // still group together among themselves.
    const hashTag = r.promptHash ? ` (${r.promptHash})` : ' (no-hash)';
    const key = `${r.model} | ${r.prompt}${hashTag}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  return groups;
}

function buildConfusionMatrix(rows) {
  const matrix = {}; // matrix[groundTruth][predicted] = count
  for (const row of rows) {
    if (row.groundTruth === null || row.groundTruth === 'TBD') continue;
    const predicted = row.predicted || '(missing)';
    matrix[row.groundTruth] = matrix[row.groundTruth] || {};
    matrix[row.groundTruth][predicted] = (matrix[row.groundTruth][predicted] || 0) + 1;
  }
  return matrix;
}

function printConfusionMatrix(matrix) {
  const groundTruths = Object.keys(matrix).sort();
  const predictedSet = new Set();
  for (const gt of groundTruths) Object.keys(matrix[gt]).forEach(p => predictedSet.add(p));
  const predicted = [...predictedSet].sort();

  const colWidth = 7;
  const pad = (s, w) => String(s).padEnd(w);

  let header = pad('GT\\Pred', 10);
  for (const p of predicted) header += pad(p, colWidth);
  console.log('  ' + header);

  for (const gt of groundTruths) {
    let line = pad(gt, 10);
    for (const p of predicted) {
      const count = matrix[gt]?.[p] || 0;
      line += pad(count === 0 ? '.' : count, colWidth);
    }
    console.log('  ' + line);
  }
}

function main() {
  const dir = process.argv[2] ? path.resolve(process.argv[2]) : RESULTS_DIR;
  if (!fs.existsSync(dir)) {
    console.error(`Results directory not found: ${dir}`);
    process.exit(1);
  }

  const results = loadResults(dir);
  if (results.length === 0) {
    console.error(`No result files found in ${dir}. Run dpics-eval-run.cjs first.`);
    process.exit(1);
  }

  console.log(`Loaded ${results.length} run(s) from ${dir}\n`);

  const groups = groupByModelPrompt(results);

  console.log('='.repeat(70));
  console.log('LEADERBOARD (by model + prompt)');
  console.log('='.repeat(70));

  const leaderboard = Object.entries(groups).map(([key, runs]) => {
    let totalMatches = 0;
    let totalCategoryMatches = 0;
    let totalScored = 0;
    let totalMissing = 0;
    for (const r of runs) {
      totalMatches += r.summary.matches;
      totalCategoryMatches += r.summary.categoryMatches || 0;
      totalScored  += r.summary.groundTruthCoded;
      totalMissing += r.summary.missingPrediction;
    }
    const accuracy = totalScored > 0 ? +(totalMatches / totalScored * 100).toFixed(2) : null;
    const categoryAccuracy = totalScored > 0 ? +(totalCategoryMatches / totalScored * 100).toFixed(2) : null;
    return { key, runs: runs.length, sessions: runs.map(r => r.label), totalMatches, totalCategoryMatches, totalScored, totalMissing, accuracy, categoryAccuracy };
  }).sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0));

  for (const row of leaderboard) {
    console.log(`\n${row.key}`);
    console.log(`  runs: ${row.runs} (sessions: ${[...new Set(row.sessions)].join(', ')})`);
    console.log(`  exact accuracy:    ${row.totalMatches}/${row.totalScored} = ${row.accuracy}%${row.totalMissing > 0 ? `  (${row.totalMissing} missing predictions)` : ''}`);
    console.log(`  category accuracy: ${row.totalCategoryMatches}/${row.totalScored} = ${row.categoryAccuracy}%`);
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('CONFUSION MATRICES (rows = ground truth, cols = predicted)');
  console.log('='.repeat(70));

  for (const [key, runs] of Object.entries(groups)) {
    const allRows = runs.flatMap(r => r.utterances);
    const matrix = buildConfusionMatrix(allRows);
    console.log(`\n${key}`);
    printConfusionMatrix(matrix);
  }
}

main();
