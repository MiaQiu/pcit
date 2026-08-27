/**
 * Parent Skill Level — 9-level parenting-skill ladder shown as the
 * "Personalized Learning Journey" in the app. See docs shared by product
 * for the full level ladder (name/skill/goal copy lives client-side).
 *
 * Levels 1-6 are flat, single-session, single-metric CDI levels defined
 * once in server/utils/parentLevelLadder.cjs and shared with
 * levelGoalEngine.cjs's goal-card generator, so a level's clearance
 * threshold and its goal-card target are always the same number.
 *
 * Levels 8 ("Calm Follow-Through") and 9 ("Confident Parent") have no
 * corresponding signal in our DPICS tag set (no timeout/warning/compliance
 * coding exists), so both use deterministic proxies built from existing
 * tags — a calm PDI instruction for level 8, an "everything clicking"
 * session for level 9 — gated the same way as level 7: 2 non-consecutive
 * qualifying sessions.
 */
const prisma = require('./db.cjs');
const {
  QUALIFYING_SESSIONS_REQUIRED,
  CDI_FLAT_LEVELS,
  tagCountsToMetrics,
  isFlatLevelCleared,
} = require('../utils/parentLevelLadder.cjs');

/**
 * Pure function: given the parent's current progress and one newly-completed
 * session's mode/tagCounts, decide what (if anything) should change.
 *
 * NOTE on field names: ParentSkillProgress.level5QualifyingCount /
 * level6QualifyingCount / level7QualifyingCount are legacy DB column names
 * from the old 7-level ladder (no schema migration was done when the ladder
 * was renumbered to 9 levels). They now track new levels 7 / 8 / 9
 * respectively — level5QualifyingCount == new level 7's qualifying count,
 * level6QualifyingCount == new level 8's, level7QualifyingCount == new
 * level 9's. See doc/goal.md.
 *
 * @param {{ currentLevel: number, level5QualifyingCount?: number, level6QualifyingCount?: number, level7QualifyingCount?: number }} progress
 * @param {{ mode: 'CDI'|'PDI', tagCounts: Object }} session
 * @returns {Object|null} Partial update for Prisma, or null if nothing changed
 */
function computeLevelUpdate(progress, session) {
  const { currentLevel } = progress;
  const flatDef = CDI_FLAT_LEVELS[currentLevel];

  if (flatDef && session.mode === 'CDI') {
    const metrics = tagCountsToMetrics(session.tagCounts || {});
    if (isFlatLevelCleared(flatDef, metrics)) return { currentLevel: currentLevel + 1 };
    return null;
  }

  const counts = tagCountsToMetrics(session.tagCounts || {});
  const directCommand = session.tagCounts?.direct_command || 0;

  if (currentLevel === 7 && session.mode === 'PDI') {
    if (directCommand >= 1) {
      const newCount = (progress.level5QualifyingCount || 0) + 1;
      if (newCount >= QUALIFYING_SESSIONS_REQUIRED) {
        return { currentLevel: 8, level5QualifyingCount: newCount };
      }
      return { level5QualifyingCount: newCount };
    }
  } else if (currentLevel === 8 && session.mode === 'PDI') {
    // No compliance/timeout/warning coding exists to measure "calm
    // follow-through" directly — proxy: a PDI session with a clear
    // instruction and zero criticism.
    if (directCommand >= 1 && counts.criticisms === 0) {
      const newCount = (progress.level6QualifyingCount || 0) + 1;
      if (newCount >= QUALIFYING_SESSIONS_REQUIRED) {
        return { currentLevel: 9, level6QualifyingCount: newCount };
      }
      return { level6QualifyingCount: newCount };
    }
  } else if (currentLevel === 9) {
    // Integration proxy: either mode's "everything clicking" session.
    const cdiQualifies = session.mode === 'CDI' && counts.criticisms === 0
      && counts.praise >= 5 && counts.narration >= 5 && counts.reflection >= 5;
    const pdiQualifies = session.mode === 'PDI' && counts.criticisms === 0 && directCommand >= 1;
    if (cdiQualifies || pdiQualifies) {
      const newCount = Math.min((progress.level7QualifyingCount || 0) + 1, QUALIFYING_SESSIONS_REQUIRED);
      return { level7QualifyingCount: newCount };
    }
  }

  return null;
}

/**
 * Re-evaluate and persist the user's parent-skill-level progress after a
 * session finishes analysis. Non-blocking — callers should fire-and-forget.
 * @param {string} userId
 * @param {string} sessionId
 */
async function updateParentSkillLevel(userId, sessionId) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { mode: true, tagCounts: true },
  });
  if (!session) return;

  let progress = await prisma.parentSkillProgress.findUnique({ where: { userId } });
  if (!progress) {
    progress = await prisma.parentSkillProgress.create({ data: { userId } });
  }

  // Once level 9's own qualifying counter (level7QualifyingCount — see the
  // field-name note on computeLevelUpdate) has maxed out, there's nothing
  // left to ever evaluate again for this parent.
  if (progress.currentLevel === 9 && progress.level7QualifyingCount >= QUALIFYING_SESSIONS_REQUIRED) return;

  const update = computeLevelUpdate(progress, session);
  if (!update) return;

  // Progress only ever moves forward — a level once reached is never lost,
  // regardless of how later sessions perform. Guard here (not just in
  // computeLevelUpdate) so this invariant holds even if that logic changes.
  if (update.currentLevel != null && update.currentLevel <= progress.currentLevel) {
    return;
  }

  await prisma.parentSkillProgress.update({ where: { userId }, data: update });
  console.log(`[PARENT-SKILL-LEVEL] Updated progress for user ${userId.substring(0, 8)}:`, update);
}

module.exports = { updateParentSkillLevel, computeLevelUpdate };
