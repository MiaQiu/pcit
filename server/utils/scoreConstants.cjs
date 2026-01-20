/**
 * PCIT Scoring Constants
 * Centralized configuration for scoring calculations
 */

/**
 * CDI (Child-Directed Interaction) Score Configuration
 * Uses Shield-based scoring system v5
 */
const CDI_SCORE_CONFIG = {
  // Shield configuration
  MAX_SHIELD_POINTS: 40,
  SKILL_POINTS_FOR_MAX_SHIELD: 30,

  // Base score configuration
  BASE_SCORE: 60,
  PASS_CAP: 100,
  FAIL_CAP: 89,

  // Mastery thresholds
  SKILL_TARGET: 10,  // 10+ for each PEN skill
  MAX_DONTS: 3       // 3 or fewer total negatives
};

/**
 * Map from DPICS codes to display-friendly tag names
 */
const DPICS_TO_TAG_MAP = {
  'RF': 'Echo',              // Reflection
  'RQ': 'Echo',              // Reflective Question
  'LP': 'Labeled Praise',    // Labeled Praise
  'UP': 'Unlabeled Praise',  // Unlabeled Praise
  'BD': 'Narration',         // Behavioral Description
  'DC': 'Command',           // Direct Command
  'IC': 'Command',           // Indirect Command
  'Q': 'Question',           // Question
  'NTA': 'Criticism',        // Negative Talk
  'ID': 'Neutral',           // Informational Description
  'AK': 'Neutral'            // Acknowledgement
};

/**
 * Calculate Nora Score for CDI mode
 * Shield-based scoring system v5
 * @param {Object} tagCounts - Object containing skill counts
 * @returns {{score: number, passed: boolean}} Score and pass/fail status
 */
function calculateCDIScore(tagCounts) {
  const A = tagCounts.praise || 0;
  const B = tagCounts.echo || 0;
  const C = tagCounts.narration || 0;
  const D = tagCounts.question || 0;
  const E = tagCounts.command || 0;
  const F = tagCounts.criticism || 0;

  // 1. Setup - cap effective skills at 10
  const A_eff = Math.min(A, CDI_SCORE_CONFIG.SKILL_TARGET);
  const B_eff = Math.min(B, CDI_SCORE_CONFIG.SKILL_TARGET);
  const C_eff = Math.min(C, CDI_SCORE_CONFIG.SKILL_TARGET);
  const totalNegs = D + E + F;

  // 2. Build the Shield (Max 40 points)
  // 30 skill points = 40 score points -> 1.333 multiplier
  const currentShield = (A_eff + B_eff + C_eff) *
    (CDI_SCORE_CONFIG.MAX_SHIELD_POINTS / CDI_SCORE_CONFIG.SKILL_POINTS_FOR_MAX_SHIELD);

  // 3. Apply Damage
  // High Impact Damage = 3.333 per negative
  const damagePerHit = CDI_SCORE_CONFIG.SKILL_TARGET / 3;

  // Calculate how many "hits" the shield can take before breaking
  const hitsToBreakShield = damagePerHit > 0 ? currentShield / damagePerHit : 0;

  let rawScore;
  if (totalNegs <= hitsToBreakShield) {
    // Case A: Shield holds. Deduct using high penalty.
    const penalty = totalNegs * damagePerHit;
    rawScore = CDI_SCORE_CONFIG.BASE_SCORE + currentShield - penalty;
  } else {
    // Case B: Shield broken.
    // User loses all shield points (Score resets to 60).
    // Remaining negatives subtract 1 point each from 60.
    const remainingNegs = totalNegs - hitsToBreakShield;
    rawScore = CDI_SCORE_CONFIG.BASE_SCORE - remainingNegs;
  }

  // 4. Gate Check (Pass/Fail)
  const passed = (A >= CDI_SCORE_CONFIG.SKILL_TARGET) &&
                 (B >= CDI_SCORE_CONFIG.SKILL_TARGET) &&
                 (C >= CDI_SCORE_CONFIG.SKILL_TARGET) &&
                 (totalNegs <= CDI_SCORE_CONFIG.MAX_DONTS);

  let finalScore = rawScore;
  if (passed) {
    if (finalScore > CDI_SCORE_CONFIG.PASS_CAP) finalScore = CDI_SCORE_CONFIG.PASS_CAP;
  } else {
    // Cap at 89 if failed
    if (finalScore > CDI_SCORE_CONFIG.FAIL_CAP) finalScore = CDI_SCORE_CONFIG.FAIL_CAP;
  }

  // Floor at 0
  if (finalScore < 0) finalScore = 0;

  return {
    score: Math.round(finalScore),
    passed
  };
}

/**
 * Calculate Nora Score for PDI mode
 * Command effectiveness percentage
 * @param {Object} tagCounts - Object containing command counts
 * @returns {{score: number, passed: boolean}} Score and pass/fail status
 */
function calculatePDIScore(tagCounts) {
  const totalCommands = (tagCounts.direct_command || 0) +
                        (tagCounts.indirect_command || 0) +
                        (tagCounts.vague_command || 0) +
                        (tagCounts.chained_command || 0);
  const effectiveCommands = tagCounts.direct_command || 0;

  const score = totalCommands > 0
    ? Math.round((effectiveCommands / totalCommands) * 100)
    : 0;

  // PDI passes at 75%+ effective commands
  const passed = score >= 75;

  return { score, passed };
}

/**
 * Calculate Nora Score based on session mode
 * @param {Object} tagCounts - Object containing skill/command counts
 * @param {string} mode - 'CDI' or 'PDI'
 * @returns {{score: number, passed: boolean}} Score and pass/fail status
 */
function calculateNoraScore(tagCounts, mode) {
  if (mode === 'CDI') {
    return calculateCDIScore(tagCounts);
  } else {
    return calculatePDIScore(tagCounts);
  }
}

module.exports = {
  CDI_SCORE_CONFIG,
  DPICS_TO_TAG_MAP,
  calculateCDIScore,
  calculatePDIScore,
  calculateNoraScore
};
