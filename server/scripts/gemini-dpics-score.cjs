'use strict';

/**
 * Score gemini-dpics-call.cjs output files against ground-truth DPICS codes.
 *
 * Ground truth is pulled via dpics-ground-truth.cjs, which caches Utterance.adminComment
 * to eval-results/dpics/ground-truth/<label>.json on first use — later runs never touch
 * the DB unless a session hasn't been cached yet.
 *
 * The model's predicted "id" in gemini-dpics-call.cjs output is the utterance's raw DB
 * `order` value (both scripts number utterances 0..n over the full adult+child sequence,
 * matching how session-only/ was exported and how dpics-eval-run.cjs assigns ids) — so
 * predicted[i].id maps directly to groundTruth[i].order, no extra lookup table needed.
 *
 * Usage:
 *   node server/scripts/gemini-dpics-score.cjs [--dir <path>]
 *
 *   --dir  Directory of gemini-dpics-call.cjs output (default: eval-results/dpics/gemini-calls)
 *
 * Writes a <basename>.score.json companion next to each scored call file (leaves the
 * original call output untouched), and prints a per-file report plus a leaderboard
 * grouped by (model, prompt, cache) across every file in the directory.
 *
 * Also (re)writes result.dm in --dir: one section per (prompt, model, cache) batch with
 * a per-session score + cost table. Regenerated from scratch from every *.score.json
 * present each run, so it's always a full up-to-date history — old batches stay in the
 * file as long as their score files aren't deleted, new batches (including future runs
 * with new prompts/models) just add a new section.
 */

const fs   = require('fs');
const path = require('path');

const { parseJSON }      = require('../llm/repair.cjs');
const { sameCategory }   = require('./dpics-eval-codes.cjs');
const { getGroundTruth, disconnect } = require('./dpics-ground-truth.cjs');

const DEFAULT_DIR = path.resolve(__dirname, '../../eval-results/dpics/gemini-calls');

function parseArgs(argv) {
  const args = { dir: DEFAULT_DIR };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') args.dir = path.resolve(argv[++i]);
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function scoreCall(call, groundTruth) {
  const { value: predictions } = parseJSON(call.text, 'array');
  const predictedByOrder = {};
  for (const p of predictions) {
    if (p && p.id !== undefined && p.code) predictedByOrder[p.id] = p;
  }

  const rows = [];
  for (const u of groundTruth) {
    if (u.role !== 'adult') continue;
    const pred = predictedByOrder[u.order] || null;
    const groundTruthCode = u.adminComment || null;
    const predictedCode = pred?.code || null;
    rows.push({
      order: u.order,
      text: u.text,
      groundTruth: groundTruthCode,
      predicted: predictedCode,
      subject: pred?.subject || pred?.subject_cot || null,
      match: groundTruthCode !== null && predictedCode !== null && groundTruthCode === predictedCode,
      categoryMatch: sameCategory(groundTruthCode, predictedCode),
    });
  }

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

function writeResultDm(dir, leaderboardRows, leaderboard) {
  const groups = {};
  for (const r of leaderboardRows) {
    const key = `${r.prompt}, ${r.model}, ${r.cache ? 'cache' : 'no-cache'}`;
    (groups[key] ||= []).push(r);
  }

  const leaderboardByKey = {};
  for (const row of leaderboard) leaderboardByKey[row.key] = row;

  const sections = Object.entries(groups)
    .sort(([, a], [, b]) => {
      const aggA = leaderboardByKey[`${a[0].model} | ${a[0].prompt} | ${a[0].cache ? 'cache' : 'nocache'}`];
      const aggB = leaderboardByKey[`${b[0].model} | ${b[0].prompt} | ${b[0].cache ? 'cache' : 'nocache'}`];
      return (aggB?.accuracy || 0) - (aggA?.accuracy || 0);
    })
    .map(([header, runs]) => {
      const sorted = [...runs].sort((a, b) => a.session.localeCompare(b.session, undefined, { numeric: true }));
      const totalMatches = runs.reduce((s, r) => s + r.matches, 0);
      const totalCategoryMatches = runs.reduce((s, r) => s + r.categoryMatches, 0);
      const totalScored = runs.reduce((s, r) => s + r.groundTruthCoded, 0);
      const totalCost = runs.reduce((s, r) => s + (r.cost || 0), 0);
      const accuracy = totalScored > 0 ? +(totalMatches / totalScored * 100).toFixed(2) : null;
      const categoryAccuracy = totalScored > 0 ? +(totalCategoryMatches / totalScored * 100).toFixed(2) : null;

      // cacheCreationCost is a one-time per-invocation (per cache-creation event) fee, repeated
      // identically on every session file written by that invocation — dedupe by the cache's
      // actual createTimeMs (a real distinct identity per event), NOT by dollar value, since two
      // separate creation events can coincidentally cost the same amount (same token count).
      const creationEventsByTime = new Map();
      for (const r of runs) {
        if (r.cacheCreationCost > 0 && r.cacheCreateTimeMs) creationEventsByTime.set(r.cacheCreateTimeMs, r.cacheCreationCost);
      }
      const totalCreationCost = [...creationEventsByTime.values()].reduce((s, c) => s + c, 0);
      const creationEventCount = creationEventsByTime.size;
      const grandTotal = totalCost + totalCreationCost;

      const rows = sorted.map(r =>
        `| ${r.session} | ${r.matches}/${r.groundTruthCoded} (${r.accuracy}%) | ${r.categoryMatches}/${r.groundTruthCoded} (${r.categoryAccuracy}%) | $${(r.cost || 0).toFixed(5)} |`
      );
      const totalRow = `| **total** | ${totalMatches}/${totalScored} (${accuracy}%) | ${totalCategoryMatches}/${totalScored} (${categoryAccuracy}%) | $${totalCost.toFixed(5)} |`;
      const creationRow = totalCreationCost > 0
        ? [`| cache write (one-time, ${creationEventCount}x) | | | $${totalCreationCost.toFixed(5)} |`,
           `| **grand total (incl. cache write)** | | | $${grandTotal.toFixed(5)} |`]
        : [];

      return [
        `## ${header}`,
        '',
        '| session | exact | category | cost |',
        '|---|---|---|---|',
        ...rows,
        totalRow,
        ...creationRow,
      ].join('\n');
    });

  const content = `# DPICS Gemini call results\n\n${sections.join('\n\n')}\n`;
  const outPath = path.join(dir, 'result.dm');
  fs.writeFileSync(outPath, content);
  console.log(`\nWrote ${outPath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.dir)) throw new Error(`Directory not found: ${args.dir}`);

  const files = fs.readdirSync(args.dir).filter(f => f.endsWith('.json') && !f.endsWith('.score.json'));
  if (files.length === 0) throw new Error(`No call output files found in ${args.dir}`);

  const leaderboardRows = [];

  for (const file of files) {
    const call = JSON.parse(fs.readFileSync(path.join(args.dir, file), 'utf-8'));
    console.log(`\n▶ ${file}`);

    let groundTruth;
    try {
      groundTruth = await getGroundTruth(call.session);
    } catch (err) {
      console.warn(`  skipped: ${err.message}`);
      continue;
    }

    let scoring;
    try {
      scoring = scoreCall(call, groundTruth);
    } catch (err) {
      console.warn(`  skipped (parse error): ${err.message}`);
      continue;
    }

    const { summary } = scoring;
    console.log(
      `  exact=${summary.matches}/${summary.groundTruthCoded} (${summary.accuracy}%)  ` +
      `category=${summary.categoryMatches}/${summary.groundTruthCoded} (${summary.categoryAccuracy}%)` +
      (summary.missingPrediction > 0 ? `  missing=${summary.missingPrediction}` : '')
    );

    const scoreFile = path.join(args.dir, file.replace(/\.json$/, '.score.json'));
    fs.writeFileSync(scoreFile, JSON.stringify({
      session: call.session, model: call.model, cache: call.cache, prompt: call.prompt,
      usage: call.usage, ...scoring,
    }, null, 2));

    leaderboardRows.push({
      file, model: call.model, prompt: call.prompt, cache: call.cache, session: call.session,
      cost: call.usage?.cost ?? null,
      cacheCreationCost: call.cacheCreationCost || 0,
      cacheCreateTimeMs: call.cacheCreateTimeMs || null,
      ...summary,
    });
  }

  await disconnect();

  if (leaderboardRows.length === 0) {
    console.log('\nNo files scored.');
    return;
  }

  // Same (model, prompt, cache, session) combo can accumulate multiple call files across
  // reruns over time (e.g. re-running after a prompt tweak or a nonce fix) — keep only the
  // most recent one per combo for aggregation, so the leaderboard/result.dm reflect the
  // current state of each session rather than double-counting old + new runs together.
  const latestBySessionKey = {};
  for (const r of leaderboardRows) {
    const sessionKey = `${r.model}|${r.prompt}|${r.cache}|${r.session}`;
    const ts = parseInt(r.file.match(/__(\d+)\.json$/)?.[1] ?? '0', 10);
    if (!latestBySessionKey[sessionKey] || ts > latestBySessionKey[sessionKey].ts) {
      latestBySessionKey[sessionKey] = { ts, row: r };
    }
  }
  const dedupedRows = Object.values(latestBySessionKey).map(x => x.row);

  const groups = {};
  for (const r of dedupedRows) {
    const key = `${r.model} | ${r.prompt} | ${r.cache ? 'cache' : 'nocache'}`;
    (groups[key] ||= []).push(r);
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('LEADERBOARD (by model + prompt + cache)');
  console.log('='.repeat(70));

  const leaderboard = Object.entries(groups).map(([key, runs]) => {
    const totalMatches = runs.reduce((s, r) => s + r.matches, 0);
    const totalCategoryMatches = runs.reduce((s, r) => s + r.categoryMatches, 0);
    const totalScored = runs.reduce((s, r) => s + r.groundTruthCoded, 0);
    const totalMissing = runs.reduce((s, r) => s + r.missingPrediction, 0);
    const accuracy = totalScored > 0 ? +(totalMatches / totalScored * 100).toFixed(2) : null;
    const categoryAccuracy = totalScored > 0 ? +(totalCategoryMatches / totalScored * 100).toFixed(2) : null;
    return { key, runs: runs.length, sessions: [...new Set(runs.map(r => r.session))], totalMatches, totalCategoryMatches, totalScored, totalMissing, accuracy, categoryAccuracy };
  }).sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0));

  for (const row of leaderboard) {
    console.log(`\n${row.key}`);
    console.log(`  runs: ${row.runs} (sessions: ${row.sessions.join(', ')})`);
    console.log(`  exact accuracy:    ${row.totalMatches}/${row.totalScored} = ${row.accuracy}%${row.totalMissing > 0 ? `  (${row.totalMissing} missing predictions)` : ''}`);
    console.log(`  category accuracy: ${row.totalCategoryMatches}/${row.totalScored} = ${row.categoryAccuracy}%`);
  }

  writeResultDm(args.dir, dedupedRows, leaderboard);
}

main().catch(async err => {
  console.error('❌', err.message);
  await disconnect();
  process.exit(1);
});
