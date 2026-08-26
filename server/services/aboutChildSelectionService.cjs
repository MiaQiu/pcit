/**
 * About Child Selection Service
 * Picks which "About Child" insight card (from this session's freshly
 * generated aboutChild array) to actually show, and records that choice.
 *
 * Two goals, checked in order:
 *  1. Ratio — over the trailing window of shown cards, keep roughly a 5:1
 *     STRENGTH:GROWTH_AREA mix (deficit-based: if none of the last 6 shown
 *     were GROWTH_AREA, one is due today).
 *  2. Dedup — don't repeat a card whose (normalized) title was shown
 *     recently.
 *
 * Runs once per session, right after generateAboutChild resolves, so the
 * choice is made and persisted a single time — see the STEP 11 call site in
 * pcitAnalysisService.cjs.
 */
const prisma = require('./db.cjs');

const RATIO_WINDOW = 6;   // trailing shown-cards checked for the ratio deficit
const DEDUP_WINDOW = 10;  // trailing shown-cards checked for title repeats
const HISTORY_LOOKBACK = 30; // rows fetched once, covers both windows above

// Lowercase, strip punctuation/extra whitespace — good enough to catch the
// LLM re-generating the literal same title again; not semantic similarity.
function normalizeKey(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} childId
 * @param {string} sessionId
 * @param {Array<{id:number, Title:string, Description:string, Details:string, tags?:string[], valence?:string}>} items
 * @returns {Promise<Object|null>} the selected AboutChildItem, or null if nothing to select
 */
async function selectAboutChildCard(childId, sessionId, items) {
  if (!childId || !items?.length) {
    return null;
  }

  const recent = await prisma.childInsightHistory.findMany({
    where: { childId },
    orderBy: { shownAt: 'desc' },
    take: HISTORY_LOOKBACK,
  });

  // --- Ratio: deficit-based over the trailing window ---
  const ratioWindow = recent.slice(0, RATIO_WINDOW);
  const growthShown = ratioWindow.filter(r => r.valence === 'GROWTH_AREA').length;
  const targetValence =
    ratioWindow.length < RATIO_WINDOW ? 'STRENGTH' // cold start — lead positive
    : growthShown === 0 ? 'GROWTH_AREA'            // due
    : 'STRENGTH';

  // --- Dedup: exclude titles shown recently ---
  const recentKeys = new Set(recent.slice(0, DEDUP_WINDOW).map(r => r.insightKey));
  const notRecentlyShown = list => list.filter(i => !recentKeys.has(normalizeKey(i.Title)));

  // --- Fallback ladder: relax valence before relaxing dedup ---
  let candidates = notRecentlyShown(items.filter(i => (i.valence || 'STRENGTH') === targetValence));
  if (!candidates.length) candidates = notRecentlyShown(items);
  if (!candidates.length) candidates = items;

  const selected = candidates[0] || null;
  if (!selected) {
    return null;
  }

  await prisma.childInsightHistory.create({
    data: {
      childId,
      sessionId,
      insightKey: normalizeKey(selected.Title),
      title: selected.Title,
      valence: selected.valence || 'STRENGTH',
      shownAt: new Date(),
    },
  });

  console.log(`✅ [ABOUT-CHILD-SELECTION] Selected "${selected.Title}" (${selected.valence || 'STRENGTH'}) for child ${childId.substring(0, 8)} — target was ${targetValence}`);

  return selected;
}

module.exports = {
  selectAboutChildCard,
  normalizeKey,
};
