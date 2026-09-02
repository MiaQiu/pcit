'use strict';
/**
 * End-to-end smoke test for every LLM call in the PCIT analysis pipeline.
 *
 * Drives each LLM-calling stage of `server/services/pcitAnalysisService.cjs`
 * against a real session's data — loaded read-only from the DB — and prints a
 * per-call report (label, model, latency, tokens, schema/repair/retry/fallback
 * flags, ok/fail). Nothing is written back to the database.
 *
 * Use it to verify the whole pipeline still works after a model / profile /
 * prompt / schema change (e.g. swapping the default Gemini flash model).
 *
 * Usage:
 *   node scripts/e2e-llm-calls.cjs <sessionId> [--skip-coding] [--only=stage,stage]
 *
 *   --skip-coding      skip the pcit-coding stage (the slowest / most expensive call)
 *   --only=a,b         run only the named stages (see STAGE list printed at top)
 *
 * Example:
 *   node scripts/e2e-llm-calls.cjs ba468741-e26c-4c8d-b075-9ce1d149b4d8
 *   GEMINI_FLASH_MODEL=gemini-3.7-flash node scripts/e2e-llm-calls.cjs <id> --skip-coding
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const path = require('path');
const prisma = require('../server/services/db.cjs');
const { getUtterances } = require('../server/utils/utteranceUtils.cjs');
const { decryptSensitiveData } = require('../server/utils/encryption.cjs');
const { loadPrompt } = require('../server/prompts/index.cjs');
const { llmCall } = require('../server/llm/gateway.cjs');
const { resolveModel } = require('../server/llm/models.cjs');
const {
  validateSessionQuality,
  identifyRolesWithVoting,
  generateDevelopmentalProfiling,
  generateAboutChild,
  generateCdiCoaching,
  generateCDIFeedback,
  generateReportHighlights,
  generateCrisis,
  generatePDITwoChoicesAnalysis,
} = require('../server/services/pcitAnalysisService.cjs');

const DPICS_PDF_PATH = process.env.DPICS_PDF_PATH
  || path.join(__dirname, '../server/assets/DPICS-Manual.2.18.pdf');

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const SESSION_ID = args.find(a => !a.startsWith('--'));
const SKIP_CODING = args.includes('--skip-coding');
const ONLY = (args.find(a => a.startsWith('--only=')) || '').replace('--only=', '')
  .split(',').map(s => s.trim()).filter(Boolean);

const ALL_STAGES = [
  'quality-check', 'role-id', 'pcit-coding', 'dev-profiling', 'about-child',
  'cdi-coaching', 'cdi-feedback', 'report-highlights', 'crisis', 'pdi-two-choices',
];

if (!SESSION_ID) {
  console.error('Usage: node scripts/e2e-llm-calls.cjs <sessionId> [--skip-coding] [--only=stage,stage]');
  console.error(`Stages: ${ALL_STAGES.join(', ')}`);
  process.exit(1);
}

const wanted = (stage) => {
  if (stage === 'pcit-coding' && SKIP_CODING) return false;
  return ONLY.length === 0 || ONLY.includes(stage);
};

// ── capture the gateway's structured llm_call log lines ──────────────────────
const llmLog = [];
const origLog = console.log.bind(console);
console.log = (...a) => {
  if (a.length === 1 && typeof a[0] === 'string' && a[0].startsWith('{"event":"llm_call"')) {
    try { llmLog.push(JSON.parse(a[0])); } catch { /* ignore */ }
  }
  origLog(...a);
};

// ── helpers mirrored from analyzePCITCoding ──────────────────────────────────
function calcAgeMonths(birthday, birthYear) {
  const now = new Date();
  if (birthday) {
    const b = new Date(birthday);
    return (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  }
  return birthYear ? (now.getFullYear() - birthYear) * 12 : null;
}
const fmtGender = (g) => ({ BOY: 'boy', GIRL: 'girl', OTHER: 'child' }[g] || 'child');
function getChildSpeaker(rij) {
  for (const [id, info] of Object.entries(rij?.speaker_identification || {})) {
    if (info.role === 'CHILD') return id;
  }
  return null;
}
const ZERO_TAG_COUNTS = {
  echo: 0, labeled_praise: 0, unlabeled_praise: 0, praise: 0,
  product_praise: 0, action_praise: 0, growth_praise: 0, regulatory_praise: 0,
  narration: 0, direct_command: 0, indirect_command: 0, command: 0,
  question: 0, criticism: 0, neutral: 0,
};

// ── stage runner ─────────────────────────────────────────────────────────────
const results = [];
async function stage(name, fn) {
  if (!wanted(name)) { results.push({ name, status: 'SKIP', calls: [], ms: 0 }); return null; }
  const before = llmLog.length;
  const t0 = Date.now();
  origLog(`\n${'─'.repeat(78)}\n▶  ${name}\n${'─'.repeat(78)}`);
  let status = 'OK';
  let value = null;
  let note = '';
  try {
    value = await fn();
    if (value === null || value === undefined) { status = 'NULL'; note = 'returned null/undefined'; }
  } catch (err) {
    if (err && err.name === 'SessionQualityError') { status = 'GATE-INVALID'; note = err.userMessage || err.message; }
    else { status = 'FAIL'; note = err && err.message ? err.message : String(err); }
  }
  const calls = llmLog.slice(before);
  results.push({ name, status, note, calls, ms: Date.now() - t0, value });
  origLog(`   → ${name}: ${status}${note ? ` (${note})` : ''} — ${calls.length} llm call(s), ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return value;
}

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  const gem = resolveModel('gemini');
  origLog(`\n${'='.repeat(78)}`);
  origLog(`E2E LLM CALLS — session ${SESSION_ID}`);
  origLog(`gemini path: ${gem.primary} → ${gem.fallback}  (GEMINI_FLASH_MODEL=${process.env.GEMINI_FLASH_MODEL || 'unset'})`);
  origLog(`stages: ${ALL_STAGES.filter(wanted).join(', ')}`);
  origLog('='.repeat(78));

  const session = await prisma.session.findUnique({ where: { id: SESSION_ID } });
  if (!session) { console.error(`Session ${SESSION_ID} not found`); process.exit(1); }

  const isCDI = session.mode === 'CDI';
  const language = session.elevenLabsJson?.language_code && session.elevenLabsJson.language_code !== 'eng'
    ? session.elevenLabsJson.language_code : null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { childName: true, childGender: true, childBirthYear: true, childBirthday: true },
  });
  let childName = 'the child';
  try { childName = user?.childName ? decryptSensitiveData(user.childName) : 'the child'; } catch { /* keep default */ }
  const ageMonths = calcAgeMonths(user?.childBirthday, user?.childBirthYear);
  const gender = fmtGender(user?.childGender);

  const child = await prisma.child.findFirst({ where: { userId: session.userId } });
  let clinicalPriority = {};
  if (child) {
    const latest = await prisma.childIssuePriority.findFirst({
      where: { childId: child.id }, orderBy: { computedAt: 'desc' }, select: { computedAt: true },
    });
    const issuePriorities = latest
      ? await prisma.childIssuePriority.findMany({
          where: { childId: child.id, computedAt: latest.computedAt }, orderBy: { priorityRank: 'asc' },
        })
      : [];
    clinicalPriority = {
      primaryIssue: child.primaryIssue, primaryStrategy: child.primaryStrategy,
      secondaryIssue: child.secondaryIssue, secondaryStrategy: child.secondaryStrategy, issuePriorities,
    };
  }

  const priorCompleted = await prisma.session.count({
    where: { userId: session.userId, analysisStatus: 'COMPLETED' },
  });
  const isFirstSession = priorCompleted === 0;

  const utterances = await getUtterances(SESSION_ID);
  if (utterances.length === 0) { console.error('No utterances for session'); process.exit(1); }
  const rij = session.roleIdentificationJson || {};
  const childSpeaker = getChildSpeaker(rij);
  const tagCounts = session.tagCounts || { ...ZERO_TAG_COUNTS };
  const tagCountsFromDb = !!session.tagCounts;

  const childInfo = {
    name: childName, ageMonths, gender, clinicalPriority, isFirstSession,
    durationSeconds: session.durationSeconds || null, achievedMilestoneKeys: [],
    childId: child?.id || null, userId: session.userId,
  };

  origLog(`\nsession   : mode=${session.mode} status=${session.analysisStatus} duration=${session.durationSeconds}s`);
  origLog(`child     : ${childName}, ${ageMonths} months, ${gender}`);
  origLog(`utterances: ${utterances.length}  childSpeaker=${childSpeaker || '(none)'}`);
  origLog(`tagCounts : ${tagCountsFromDb ? 'from DB' : 'ZEROED (session not yet coded — downstream prompts see all-zero metrics)'}`);
  origLog(`language  : ${language || 'eng/none'}`);

  const utterancesForPrompt = utterances.map(u => ({
    speaker: u.speaker, text: u.text, start: u.startTime, end: u.endTime,
  }));

  // 1. quality-check
  await stage('quality-check', () =>
    validateSessionQuality(utterances, session.durationSeconds, rij, SESSION_ID).then(() => ({ valid: true })));

  // 2. role-id (Gemini vote; Claude tiebreaker only on disagreement; ML skipped unless DIARIZATION_LAMBDA_NAME set)
  await stage('role-id', () =>
    identifyRolesWithVoting(utterancesForPrompt, utterances, session.storagePath, SESSION_ID));

  // 3. pcit-coding — replicates analyzePCITCoding STEP 7-8 (no exported wrapper)
  await stage('pcit-coding', async () => {
    const pdiOverride = !isCDI ? `

**PDI SESSION — Feedback Override for Commands:**
This is a PDI (Parent-Directed Interaction) session. The rules above apply for coding, but the feedback generation strategy for commands is different:
- **DC (Direct Command)**: DC is a TARGET SKILL in PDI. Do NOT suggest replacing it with a PRIDE skill. Instead, briefly reinforce it or coach on quality (e.g. was it direct, specific, calm, positively phrased?).
- **IC (Indirect Command)**: Still undesirable. Coach toward a DC instead (e.g. "Try stating it directly: 'Please put the block down.'"). Do NOT suggest using BD or LP.
All other feedback rules remain the same.` : '';
    const dpicsSystemPrompt = loadPrompt('dpicsCoding-agentic-v10-4') + pdiOverride;
    const utterancesData = utterances.map((u, i) => ({ id: i, role: u.role, text: u.text }));
    const userPrompt = `Code every utterance where role is "adult". Skip all "child" entries.

${JSON.stringify(utterancesData, null, 2)}

Return a minified JSON array for adult utterances only:
[{"id": <int>, "code": <string>}, ...]
- Return ONLY the JSON array — no text, no markdown, no code fences
- First character MUST be [, last character MUST be ]
- Every adult entry MUST have "id" and "code"`;
    const coding = await llmCall(userPrompt, {
      profile: 'pcit-coding',
      cache: { key: isCDI ? 'dpics-cdi' : 'dpics-pdi', primaryFile: DPICS_PDF_PATH, systemPrompt: dpicsSystemPrompt },
      label: 'pcit-coding',
      sessionId: SESSION_ID,
    });
    if (!Array.isArray(coding) || coding.length === 0) throw new Error('empty coding result');
    return { coded: coding.length };
  });

  // 4. dev-profiling
  await stage('dev-profiling', () =>
    generateDevelopmentalProfiling(utterances, childInfo, tagCounts, childSpeaker, SESSION_ID, language));

  // 5. about-child (2 calls: narrative + extract)
  await stage('about-child', () =>
    generateAboutChild(utterances, childInfo, tagCounts, SESSION_ID, language));

  // 6. cdi-coaching (CDI only; 2-3 calls: narrative + format [+ escalation])
  let coaching = null;
  if (isCDI) {
    coaching = await stage('cdi-coaching', () =>
      generateCdiCoaching(utterances, childInfo, tagCounts, childSpeaker, SESSION_ID, language));
  } else {
    results.push({ name: 'cdi-coaching', status: 'SKIP', note: 'PDI session', calls: [], ms: 0 });
  }

  const coachingNarrative = coaching?.coachingSummary || null;
  const goalDirective = coaching?.goalDirective || null;

  // 7. cdi-feedback (3 calls: combined-feedback + review-feedback + crisis-coaching)
  const pdiResultForFeedback = null; // PDI two-choices runs as its own stage below
  await stage('cdi-feedback', () =>
    generateCDIFeedback(tagCounts, utterances, childName, isCDI, pdiResultForFeedback,
      SESSION_ID, language, coachingNarrative, goalDirective));

  // 8. report-highlights (not in the live pipeline, but exported & prompt lives in this file)
  await stage('report-highlights', () =>
    generateReportHighlights(coachingNarrative || 'Session went well; parent and child connected through play.',
      null, tagCounts, childName, SESSION_ID, language));

  // 9. crisis (standalone — also exercised inside cdi-feedback)
  await stage('crisis', () =>
    generateCrisis(utterances, coachingNarrative || 'Session went well; parent and child connected through play.',
      childName, goalDirective, SESSION_ID, language));

  // 10. pdi-two-choices (PDI only)
  if (!isCDI) {
    await stage('pdi-two-choices', () =>
      generatePDITwoChoicesAnalysis(utterances, childName, SESSION_ID, language));
  } else {
    results.push({ name: 'pdi-two-choices', status: 'SKIP', note: 'CDI session', calls: [], ms: 0 });
  }

  // ── report ────────────────────────────────────────────────────────────────
  console.log = origLog;
  const line = '─'.repeat(100);
  origLog(`\n${'='.repeat(100)}\nSUMMARY — session ${SESSION_ID}\n${'='.repeat(100)}`);
  origLog(line);
  origLog('STAGE'.padEnd(18) + 'STATUS'.padEnd(14) + 'CALLS'.padEnd(7) + 'TIME'.padEnd(9) + 'NOTE');
  origLog(line);
  for (const r of results) {
    origLog(
      r.name.padEnd(18) +
      r.status.padEnd(14) +
      String(r.calls.length).padEnd(7) +
      `${(r.ms / 1000).toFixed(1)}s`.padEnd(9) +
      (r.note ? r.note.slice(0, 60) : ''),
    );
  }
  origLog(line);

  origLog(`\n${'='.repeat(100)}\nPER-CALL DETAIL\n${'='.repeat(100)}`);
  origLog(line);
  origLog('LABEL'.padEnd(26) + 'MODEL'.padEnd(24) + 'LAT'.padEnd(8) + 'IN'.padEnd(8) + 'OUT'.padEnd(8) + 'THINK'.padEnd(8) + 'FLAGS');
  origLog(line);
  const allCalls = results.flatMap(r => r.calls);
  for (const c of allCalls) {
    const flags = [
      c.hasSchema && 'schema', c.usedFallback && 'FALLBACK', c.usedRepair && 'repair',
      c.usedRetry && 'retry', !c.ok && 'ERROR',
    ].filter(Boolean).join(',');
    origLog(
      String(c.label).padEnd(26) +
      String(c.model).padEnd(24) +
      `${(c.latencyMs / 1000).toFixed(1)}s`.padEnd(8) +
      String(c.inputTokens ?? '-').padEnd(8) +
      String(c.outputTokens ?? '-').padEnd(8) +
      String(c.thinkingTokens ?? '-').padEnd(8) +
      (flags || '-'),
    );
  }
  origLog(line);

  const nFail = results.filter(r => r.status === 'FAIL').length;
  const nNull = results.filter(r => r.status === 'NULL').length;
  const nFallback = allCalls.filter(c => c.usedFallback).length;
  const nErr = allCalls.filter(c => !c.ok).length;
  origLog(
    `\n${results.filter(r => r.status === 'OK').length} OK · ${nNull} NULL · ${nFail} FAIL · ` +
    `${results.filter(r => r.status === 'SKIP').length} SKIP  |  ` +
    `${allCalls.length} llm calls, ${nErr} errored, ${nFallback} used fallback\n`,
  );

  await prisma.$disconnect();
  process.exit(nFail > 0 || nErr > 0 ? 1 : 0);
})().catch(async (err) => {
  console.log = origLog;
  console.error('\nFATAL:', err);
  try { await prisma.$disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
