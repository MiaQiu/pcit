/**
 * Parent Skill Level — 7-level parenting-skill ladder shown as the
 * "Personalized Learning Journey" in the app. See docs shared by product
 * for the full level ladder (name/skill/goal copy lives client-side).
 *
 * Levels 6 ("Calm Follow-Through") and 7 ("Confident Parent") have no
 * corresponding signal in our DPICS tag set (no timeout/warning/compliance
 * coding exists), so both use deterministic proxies built from existing
 * tags — a calm PDI instruction for level 6, an "everything clicking"
 * session for level 7 — gated the same way as level 5: 2 non-consecutive
 * qualifying sessions.
 */
const prisma = require('./db.cjs');
const { tagCountsToSession } = require('../utils/goalDirective.cjs');

// Levels 5->6, 6->7, and level 7's own completion counter all clear after
// this many non-consecutive qualifying sessions.
const LEVEL_QUALIFYING_SESSIONS_REQUIRED = 2;

/**
 * Pure function: given the parent's current progress and one newly-completed
 * session's mode/tagCounts, decide what (if anything) should change.
 * @param {{ currentLevel: number, level5QualifyingCount: number, level6QualifyingCount?: number, level7QualifyingCount?: number }} progress
 * @param {{ mode: 'CDI'|'PDI', tagCounts: Object }} session
 * @returns {Object|null} Partial update for Prisma, or null if nothing changed
 */
function computeLevelUpdate(progress, session) {
  const { currentLevel, level5QualifyingCount } = progress;
  const counts = tagCountsToSession(session.tagCounts || {});
  const totalPraise = counts.product_praise + counts.action_praise + counts.growth_praise + counts.regulatory_praise;
  const totalAvoid = counts.direct_command + counts.indirect_command + counts.criticism + counts.question;

  if (currentLevel === 1 && session.mode === 'CDI') {
    if (totalAvoid <= 6) return { currentLevel: 2 };
  } else if (currentLevel === 2 && session.mode === 'CDI') {
    if (totalPraise >= 5) return { currentLevel: 3 };
  } else if (currentLevel === 3 && session.mode === 'CDI') {
    if (counts.narration >= 5) return { currentLevel: 4 };
  } else if (currentLevel === 4 && session.mode === 'CDI') {
    if (counts.echo >= 5) return { currentLevel: 5 };
  } else if (currentLevel === 5 && session.mode === 'PDI') {
    if (counts.direct_command >= 1) {
      const newCount = level5QualifyingCount + 1;
      if (newCount >= LEVEL_QUALIFYING_SESSIONS_REQUIRED) {
        return { currentLevel: 6, level5QualifyingCount: newCount };
      }
      return { level5QualifyingCount: newCount };
    }
  } else if (currentLevel === 6 && session.mode === 'PDI') {
    // No compliance/timeout/warning coding exists to measure "calm
    // follow-through" directly — proxy: a PDI session with a clear
    // instruction and zero criticism.
    if (counts.direct_command >= 1 && counts.criticism === 0) {
      const newCount = (progress.level6QualifyingCount || 0) + 1;
      if (newCount >= LEVEL_QUALIFYING_SESSIONS_REQUIRED) {
        return { currentLevel: 7, level6QualifyingCount: newCount };
      }
      return { level6QualifyingCount: newCount };
    }
  } else if (currentLevel === 7) {
    // Integration proxy: either mode's "everything clicking" session.
    const cdiQualifies = session.mode === 'CDI' && counts.criticism === 0
      && totalPraise >= 5 && counts.narration >= 5 && counts.echo >= 5;
    const pdiQualifies = session.mode === 'PDI' && counts.criticism === 0 && counts.direct_command >= 1;
    if (cdiQualifies || pdiQualifies) {
      const newCount = Math.min((progress.level7QualifyingCount || 0) + 1, LEVEL_QUALIFYING_SESSIONS_REQUIRED);
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

  // Once level 7's own qualifying counter has maxed out, there's nothing
  // left to ever evaluate again for this parent.
  if (progress.currentLevel === 7 && progress.level7QualifyingCount >= LEVEL_QUALIFYING_SESSIONS_REQUIRED) return;

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
