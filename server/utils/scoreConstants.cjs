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
  'LP': 'Labeled Praise',    // Labeled Praise (legacy — sub-classified as LP1–LP4 in new sessions)
  'LP1': 'Labeled Praise',   // Product Praise
  'LP2': 'Labeled Praise',   // Action Praise
  'LP3': 'Labeled Praise',   // Effort/Growth Praise
  'LP4': 'Labeled Praise',   // Regulatory Praise
  'UP': 'Unlabeled Praise',  // Unlabeled Praise
  'BD': 'Narration',         // Behavioral Description
  'DC': 'Command',           // Direct Command
  'IC': 'Command',           // Indirect Command
  'Q': 'Question',           // Question
  'NTA': 'Criticism',        // Negative Talk
  'ID': 'Neutral',           // Informational Description
  'AK': 'Neutral',           // Acknowledgement
  'TA': 'Neutral',           // Neutral Talk (new manual)
  'DQ': 'Question',          // Descriptive/Reflective Question (new manual)
  'IQ': 'Question',          // Information Question (new manual)
  'AN': 'Neutral',           // Answer — parent responds to child's question (new manual)
  'NC': 'Not Coded',         // No Code — non-verbal or uncodeable (new manual)
  'Uncoded': 'Not Coded',    // Model fallback when utterance cannot be classified
};

/**
 * Calculate Nora Score for CDI mode
 * Base 70 + 1 per PEN skill use - 3 per negative
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

  const A_eff = Math.min(A, 10);
  const B_eff = Math.min(B, 10);
  const C_eff = Math.min(C, 10);
  const D_eff = Math.min(D, 15);
  const E_eff = Math.min(E, 15);
  const F_eff = Math.min(F, 15);

  const rawScore = (50 + A_eff + B_eff + C_eff - D_eff - E_eff - F_eff) * 1.3;
  const finalScore = Math.min(100, Math.max(0, rawScore));

  const totalNegs = D + E + F; // uncapped for pass/fail gate
  const passed = (A >= CDI_SCORE_CONFIG.SKILL_TARGET) &&
                 (B >= CDI_SCORE_CONFIG.SKILL_TARGET) &&
                 (C >= CDI_SCORE_CONFIG.SKILL_TARGET) &&
                 (totalNegs <= CDI_SCORE_CONFIG.MAX_DONTS);

  return {
    score: Math.round(finalScore),
    passed
  };
}

/**
 * Calculate Nora Score based on session mode
 * Both CDI and PDI use the same shield-based CDI scoring system.
 * @param {Object} tagCounts - Object containing skill/command counts
 * @param {string} mode - 'CDI' or 'PDI'
 * @returns {{score: number, passed: boolean}} Score and pass/fail status
 */
function calculateNoraScore(tagCounts, mode) {
  return calculateCDIScore(tagCounts);
}

module.exports = {
  CDI_SCORE_CONFIG,
  DPICS_TO_TAG_MAP,
  calculateCDIScore,
  calculateNoraScore
};
