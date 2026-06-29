'use strict';

/**
 * Seed gold-standard CDI sessions for DPICS coding accuracy testing.
 *
 * Creates (or reuses) one dedicated eval User, then inserts a Session + Utterance
 * rows per fixture session. Ground-truth DPICS codes go in Utterance.adminComment
 * (never written by the production pipeline) so they survive repeated coding runs
 * against different models/prompts. Utterance.role is pre-seeded from the fixture
 * so dpics-eval-run.cjs can skip role identification entirely and isolate coding
 * accuracy as the only variable under test.
 *
 * Usage:
 *   node server/scripts/dpics-eval-seed.cjs <fixturesDir>
 *
 * Reads every *.json file in <fixturesDir>, each shaped like:
 * {
 *   "sessions": [
 *     {
 *       "label": "...",            (ignored — files are relabeled session-1..N by sorted filename)
 *       "utterances": [
 *         {
 *           "role": "adult" | "child",
 *           "speaker": "parent" | "child",
 *           "verbalization": "clean spoken text",   (preferred text source)
 *           "text": "raw text with annotations",     (fallback if verbalization missing — auto-stripped)
 *           "code": "LP1"                            (required for adult utterances; DPICS code)
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * Writes a label -> sessionId map to eval-results/dpics/sessions.json so
 * dpics-eval-run.cjs can be called by label instead of raw UUID.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const prisma = require('../services/db.cjs');
const { hashPassword } = require('../utils/password.cjs');
const { encryptUserData } = require('../utils/encryption.cjs');

const VALID_CODES = new Set([
  'RF', 'RQ', 'LP', 'LP1', 'LP2', 'LP3', 'LP4', 'UP', 'BD',
  'DC', 'IC', 'Q', 'NTA', 'ID', 'AK', 'TA', 'DQ', 'IQ', 'AN', 'NC',
]);

const EVAL_USER_EMAIL = 'dpics-eval@internal.test';
const RESULTS_DIR     = path.resolve(__dirname, '../../eval-results/dpics');

// Strip parenthetical coder annotations / bracketed suggestions from raw text.
// Fallback only — used for fixture files that don't already provide a clean
// "verbalization" field.
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

async function getOrCreateEvalUser() {
  const emailHash = crypto.createHash('sha256').update(EVAL_USER_EMAIL.toLowerCase()).digest('hex');

  const existing = await prisma.user.findUnique({ where: { emailHash } });
  if (existing) {
    console.log(`Using existing eval user: ${existing.id}`);
    return existing;
  }

  const passwordHash = await hashPassword(crypto.randomUUID());
  const encryptedData = encryptUserData({
    email: EVAL_USER_EMAIL,
    name: 'DPICS Eval Fixture',
    childName: 'Eval Child',
  });

  const user = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      email: encryptedData.email,
      emailHash,
      passwordHash,
      name: encryptedData.name,
      childName: encryptedData.childName,
      childBirthYear: 2020,
      childConditions: '[]',
      tag: 'eval',
    },
  });
  console.log(`Created eval user: ${user.id}`);
  return user;
}

function normalizeUtterances(rawUtterances, label) {
  const out = [];
  rawUtterances.forEach((u, i) => {
    if (!u.role || !['adult', 'child'].includes(u.role)) {
      throw new Error(`[${label}] utterance ${i}: invalid role ${JSON.stringify(u.role)}`);
    }

    const usedFallback = u.verbalization === undefined;
    const text = usedFallback ? cleanText(u.text || '') : (u.verbalization || '').trim();

    if (!text) {
      // Pure stage-direction / non-verbal row — not a real utterance, skip.
      return;
    }

    if (u.role === 'adult' && u.code) {
      // TBD is not a DPICS code — it marks codeable content that was excluded
      // from the original human coding for an unrelated procedural/timing
      // reason (e.g. before the timed window, merged into another utterance,
      // an unfollowed pretend-play bid), not because it's uncodeable. Skip
      // validation and let it flow through to adminComment; the run/score
      // scripts exclude TBD from accuracy the same way they exclude null.
      if (u.code !== 'TBD' && !VALID_CODES.has(u.code)) {
        throw new Error(`[${label}] utterance ${i}: unknown DPICS code "${u.code}"`);
      }
    }

    out.push({
      speaker: u.speaker || (u.role === 'adult' ? 'parent' : 'child'),
      role: u.role,
      text,
      code: u.role === 'adult' ? (u.code || null) : null,
      _fallbackCleaned: usedFallback,
    });
  });
  return out;
}

async function seedSession(userId, utterances, label) {
  const sessionId = crypto.randomUUID();
  const transcript = utterances.map(u => `[${u.speaker}] ${u.text}`).join('\n');
  // No real audio timing in these transcripts — synthesize sequential placeholders.
  // The DPICS coding step only uses role + text, never startTime/endTime.
  const durationSeconds = utterances.length * 3;

  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      mode: 'CDI',
      storagePath: 'eval-fixture',
      durationSeconds,
      transcript,
      aiFeedbackJSON: {},
      pcitCoding: {},
      tagCounts: {},
      masteryAchieved: false,
      riskScore: 0,
      flaggedForReview: false,
      analysisStatus: 'PENDING',
      roleIdDone: true,
      roleIdentificationJson: { source: 'ground-truth-fixture' },
      pcitCodingDone: false,
    },
  });

  await prisma.utterance.createMany({
    data: utterances.map((u, i) => ({
      sessionId,
      speaker: u.speaker,
      text: u.text,
      startTime: i * 3,
      endTime: i * 3 + 2,
      role: u.role,
      order: i,
      pcitTag: null,
      noraTag: null,
      adminComment: u.code,
    })),
  });

  const adultTotal = utterances.filter(u => u.role === 'adult').length;
  const adultCoded = utterances.filter(u => u.role === 'adult' && u.code).length;
  const fallbackCount = utterances.filter(u => u._fallbackCleaned).length;
  console.log(`  [${label}] -> session ${sessionId} (${utterances.length} utterances, ${adultTotal} adult, ${adultCoded} coded${fallbackCount ? `, ${fallbackCount} used text-fallback cleaning` : ''})`);
  return sessionId;
}

async function main() {
  const fixturesDir = process.argv[2];
  const prefixFlagIdx = process.argv.indexOf('--label-prefix');
  const labelPrefix = prefixFlagIdx !== -1 ? process.argv[prefixFlagIdx + 1] : 'session';
  if (!fixturesDir) {
    console.error('Usage: node server/scripts/dpics-eval-seed.cjs <fixturesDir> [--label-prefix <prefix>]');
    process.exit(1);
  }

  const dir = path.resolve(fixturesDir);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  if (files.length === 0) {
    throw new Error(`No .json files found in ${dir}`);
  }

  console.log(`Found ${files.length} fixture file(s): ${files.join(', ')}`);

  // Parse + validate everything before writing anything to the DB.
  const sessions = files.map((f, idx) => {
    const label = `${labelPrefix}-${idx + 1}`;
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    if (!Array.isArray(data.sessions) || data.sessions.length === 0) {
      throw new Error(`${f}: missing "sessions" array`);
    }
    if (data.sessions.length > 1) {
      throw new Error(`${f}: expected exactly one session per file, found ${data.sessions.length}`);
    }
    const utterances = normalizeUtterances(data.sessions[0].utterances, label);
    if (utterances.length === 0) {
      throw new Error(`${f}: no usable utterances after normalization`);
    }
    return { label, file: f, utterances };
  });

  const user = await getOrCreateEvalUser();

  console.log(`\nSeeding ${sessions.length} session(s)...`);
  const map = {};
  for (const s of sessions) {
    map[s.label] = await seedSession(user.id, s.utterances, s.label);
  }

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const mapPath = path.join(RESULTS_DIR, 'sessions.json');
  let existingMap = {};
  if (fs.existsSync(mapPath)) {
    existingMap = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
  }
  fs.writeFileSync(mapPath, JSON.stringify({ ...existingMap, ...map }, null, 2));
  console.log(`\nSession label -> id map written to ${mapPath}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal error:', err.message);
  await prisma.$disconnect();
  process.exit(1);
});
