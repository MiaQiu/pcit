'use strict';

/**
 * Ground-truth cache for DPICS sessions — pulls Utterance.adminComment from the DB once
 * per session label and persists it to eval-results/dpics/ground-truth/<label>.json, so
 * later scoring runs don't need a DB connection (or the SSH tunnel) at all.
 */

const fs   = require('fs');
const path = require('path');

const RESULTS_DIR      = path.resolve(__dirname, '../../eval-results/dpics');
const SESSIONS_MAP_PATH = path.join(RESULTS_DIR, 'sessions.json');
const GROUND_TRUTH_DIR  = path.join(RESULTS_DIR, 'ground-truth');

let _prisma = null; // lazy — only required if a cache miss actually needs the DB

function cachePath(label) {
  return path.join(GROUND_TRUTH_DIR, `${label}.json`);
}

function loadCached(label) {
  const p = cachePath(label);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function resolveSessionId(label) {
  const map = JSON.parse(fs.readFileSync(SESSIONS_MAP_PATH, 'utf-8'));
  const id = map[label];
  if (!id) throw new Error(`No session id mapping for label "${label}" in ${SESSIONS_MAP_PATH}`);
  return id;
}

async function fetchFromDb(label) {
  if (!_prisma) _prisma = require('../services/db.cjs');
  const sessionId = resolveSessionId(label);
  const utterances = await _prisma.utterance.findMany({
    where:   { sessionId },
    orderBy: { order: 'asc' },
  });
  if (utterances.length === 0) throw new Error(`No utterances found in DB for session ${label} (${sessionId})`);

  const rows = utterances.map(u => ({
    order: u.order,
    role: u.role,
    text: u.text,
    adminComment: u.adminComment,
  }));

  fs.mkdirSync(GROUND_TRUTH_DIR, { recursive: true });
  fs.writeFileSync(cachePath(label), JSON.stringify(rows, null, 2));
  console.log(`  [ground-truth] fetched ${label} from DB and cached to ${cachePath(label)}`);
  return rows;
}

/**
 * @param {string} label - e.g. "session-1"
 * @returns {Promise<Array<{order:number, role:string, text:string, adminComment:string|null}>>}
 */
async function getGroundTruth(label) {
  const cached = loadCached(label);
  if (cached) return cached;
  return fetchFromDb(label);
}

async function disconnect() {
  if (_prisma) await _prisma.$disconnect();
}

module.exports = { getGroundTruth, disconnect };
