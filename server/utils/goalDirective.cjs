/**
 * Deterministic goal directive engine for CDI coaching.
 * Replaces LLM-based goal-setting with a rule-based progression through 5 phases:
 *   1. Detox       — eliminate criticism and leading
 *   2. Spark       — establish baseline praise and echo
 *   3. Cleanup     — remove residual leading, build narration volume
 *   4. Master Class — upgrade praise quality and unlock advanced skills
 *   5. Mastery Mode — maintain all targets
 */

/**
 * @typedef {Object} SessionCounts
 * @property {number} criticism
 * @property {number} direct_command
 * @property {number} indirect_command
 * @property {number} question
 * @property {number} echo
 * @property {number} narration
 * @property {number} product_praise
 * @property {number} action_praise
 * @property {number} growth_praise
 * @property {number} regulatory_praise
 *
 * @typedef {Object} SkillProfile
 * @property {boolean} masteredCorrections
 * @property {boolean} masteredLeading
 * @property {boolean} masteredPraise
 * @property {boolean} masteredEcho
 * @property {boolean} unlockedEffortPraise
 * @property {boolean} unlockedRegulatoryPraise
 *
 * @typedef {Object} GoalDirective
 * @property {string} focus_skill
 * @property {number|string} target_number
 * @property {string} strategy
 */

/**
 * Map tagCounts (DB shape) to the session counts shape the engine expects.
 * @param {Object} tagCounts
 * @returns {SessionCounts}
 */
function tagCountsToSession(tagCounts) {
  return {
    criticism:       tagCounts.criticism      || 0,
    direct_command:  tagCounts.direct_command  || 0,
    indirect_command: tagCounts.indirect_command || 0,
    question:        tagCounts.question        || 0,
    echo:            tagCounts.echo            || 0,
    narration:       tagCounts.narration       || 0,
    product_praise:  tagCounts.product_praise  || 0,
    action_praise:   tagCounts.action_praise   || 0,
    growth_praise:   tagCounts.growth_praise   || 0,
    regulatory_praise: tagCounts.regulatory_praise || 0,
  };
}

/**
 * Map a UserSkillProgress DB record to the SkillProfile shape the engine expects.
 * Accepts null (no record yet) and returns all-false defaults.
 * @param {Object|null} record
 * @returns {SkillProfile}
 */
function recordToProfile(record) {
  if (!record) {
    return {
      masteredCorrections: false,
      masteredLeading: false,
      masteredPraise: false,
      masteredEcho: false,
      unlockedEffortPraise: false,
      unlockedRegulatoryPraise: false,
    };
  }
  return {
    masteredCorrections:      record.masteredCorrections,
    masteredLeading:          record.masteredLeading,
    masteredPraise:           record.masteredPraise,
    masteredEcho:             record.masteredEcho,
    unlockedEffortPraise:     record.unlockedEffortPraise,
    unlockedRegulatoryPraise: record.unlockedRegulatoryPraise,
  };
}

/**
 * Core engine — pure function, no DB access.
 * @param {SessionCounts} session
 * @param {SkillProfile} profile
 * @returns {GoalDirective}
 */
function getGoalDirective(session, profile) {
  const {
    criticism, direct_command, indirect_command, question,
    echo, narration,
    product_praise, action_praise, growth_praise, regulatory_praise,
  } = session;

  const total_praise = product_praise + action_praise + growth_praise + regulatory_praise;

  // =========================================================
  // PHASE 1: Detox — stop the bleeding
  // =========================================================

  if (criticism > 0) {
    if (profile.masteredCorrections) {
      return {
        focus_skill: 'Gentle Reset: Corrections',
        target_number: 0,
        strategy: "The 'Grace' Reset. Remind them of their great permanent progress and ask for 0 criticism tomorrow.",
      };
    }
    return {
      focus_skill: 'Corrections',
      target_number: 0,
      strategy: "Self-awareness of the urge to correct (criticise), direct (command/question) their children. stay silent, only narrate when they talk",
    };
  }

  if (direct_command > 2 || question > 6 || (direct_command + indirect_command) > 8) {
    if (profile.masteredLeading) {
      return {
        focus_skill: 'Gentle Reset: Following the Lead',
        target_number: 0,
        strategy: "The 'Grace' Reset. Acknowledge a rough session with leading the play, ask them to try the Two-Tool Diet tomorrow.",
      };
    }
    return {
      focus_skill: 'Directing the Play',
      target_number: 0,
      strategy: "The 'Two-Tool Diet'. Their reflexes to direct the play are taking over. Tomorrow, they can only repeat words or praise actions. Otherwise, stay silent.",
    };
  }

  // =========================================================
  // PHASE 2: Spark — get child buy-in
  // =========================================================

  if (total_praise < 3) {
    if (profile.masteredPraise) {
      return {
        focus_skill: 'Gentle Reset: Praise',
        target_number: 3,
        strategy: "The 'Grace' Reset. They already have their Praise Badge, but today was quiet. Ask them to jump back into their normal rhythm tomorrow.",
      };
    }
    return {
      focus_skill: 'Specific Praise',
      target_number: 3,
      strategy: "The 'Praise Hunt'. Their mission is to hunt for 3 specific things the child does well and praise them out loud. Watch the child's face light up.",
    };
  }

  if (echo < 3) {
    if (profile.masteredEcho) {
      return {
        focus_skill: 'Gentle Reset: Echo',
        target_number: 3,
        strategy: "The 'Grace' Reset. They already have their Echo Badge! Remind them they know how to do this, and ask them to turn their listening ears back on tomorrow.",
      };
    }
    return {
      focus_skill: 'Repeating Words',
      target_number: 3,
      strategy: "'Parrot Mode'. Act like a parrot and repeat what the child says 3 times with enthusiasm.",
    };
  }

  // =========================================================
  // PHASE 3: Clinical Cleanup & Fluency
  // =========================================================

  if (direct_command > 0 || indirect_command > 2 || question > 3) {
    return {
      focus_skill: 'Letting the Child Lead',
      target_number: 0,
      strategy: "The 'Passenger Seat'. They are doing great with praise, but still making a few too many suggestions. Tell them to sit back and let the child drive the play 100%.",
    };
  }

  if (narration < 8) {
    return {
      focus_skill: 'Describing the Play',
      target_number: Math.min(narration + 3, 10),
      strategy: "The 'Broadcaster'. Fill the quiet moments by describing the child's actions like a sports commentator.",
    };
  }

  // =========================================================
  // PHASE 4: Master Class — opportunistic upgrades
  // =========================================================

  if (profile.masteredPraise) {
    const advanced_praises = action_praise + growth_praise + regulatory_praise;

    if (advanced_praises < 3) {
      return {
        focus_skill: 'Praising the Action',
        target_number: 3,
        strategy: "The 'Behavior Shift'. The parent is praising the toys perfectly, but we need them praising behavior. Ask them to shift from 'Great tower!' to 'I love how you are stacking those blocks!'",
      };
    }

    if (!profile.unlockedEffortPraise) {
      return {
        focus_skill: 'Praising the Effort (If the opportunity arises)',
        target_number: 1,
        strategy: "The 'Invisible Effort' Mission. Ask the parent to look for just 1 moment tomorrow where the child tries hard, focuses, or shows patience. Emphasize they shouldn't force it — just keep an eye out for it.",
      };
    }

    if (!profile.unlockedRegulatoryPraise) {
      return {
        focus_skill: 'Praising Emotional Control (If the opportunity arises)',
        target_number: 1,
        strategy: "The 'Calm Catch' Mission. Ask the parent to look for 1 moment where the child regulates themselves — like using a gentle voice or accepting a boundary. Tell them not to force it, just be ready to catch it.",
      };
    }
  }

  // =========================================================
  // PHASE 4 fallback: push volume high score on lagging skill
  // =========================================================

  if (total_praise < 10 || echo < 10) {
    const focus = total_praise <= echo ? 'Specific Praise' : 'Repeating Words';
    const current = total_praise <= echo ? total_praise : echo;
    return {
      focus_skill: focus,
      target_number: Math.min(current + 3, 10),
      strategy: "The 'High Score'. Time to maximize emotional deposits. Push this specific positive skill even higher.",
    };
  }

  // =========================================================
  // PHASE 5: Mastery Mode
  // =========================================================

  return {
    focus_skill: 'Maintaining the Magic',
    target_number: 'Maintain targets',
    strategy: 'Mastery Mode. They are hitting all targets and have unlocked all advanced skills! Maintain this balance and enjoy the play.',
  };
}

// =========================================================
// Mastery profile updater
// =========================================================

// Sessions with 0 criticism required to flip masteredCorrections
const MASTERY_CLEAN_SESSIONS_THRESHOLD = 3;

/**
 * Compute the updated fields for UserSkillProgress based on the current session.
 * Returns only the fields that changed (so callers can do a targeted DB update).
 * @param {Object} currentRecord  - Existing UserSkillProgress DB record (or null)
 * @param {SessionCounts} session - Current session counts
 * @returns {Object} Partial update object for Prisma
 */
function computeMasteryUpdates(currentRecord, session) {
  const record = currentRecord || {};
  const updates = {};

  const {
    criticism, direct_command, indirect_command, question,
    echo, narration,
    product_praise, action_praise, growth_praise, regulatory_praise,
  } = session;

  const total_praise = product_praise + action_praise + growth_praise + regulatory_praise;

  // --- masteredCorrections ---
  if (!record.masteredCorrections) {
    const streak = criticism === 0
      ? (record.cleanCorrectionsSessions || 0) + 1
      : 0;
    updates.cleanCorrectionsSessions = streak;
    if (streak >= MASTERY_CLEAN_SESSIONS_THRESHOLD) {
      updates.masteredCorrections = true;
    }
  }

  // --- masteredLeading ---
  if (!record.masteredLeading) {
    const isClean = direct_command <= 2 && question <= 6 && (direct_command + indirect_command) <= 8;
    const streak = isClean
      ? (record.cleanLeadingSessions || 0) + 1
      : 0;
    updates.cleanLeadingSessions = streak;
    if (streak >= MASTERY_CLEAN_SESSIONS_THRESHOLD) {
      updates.masteredLeading = true;
    }
  }

  // --- masteredPraise (total LP ≥ 10) ---
  if (!record.masteredPraise && total_praise >= 10) {
    updates.masteredPraise = true;
  }

  // --- masteredEcho (echo ≥ 10) ---
  if (!record.masteredEcho && echo >= 10) {
    updates.masteredEcho = true;
  }

  // --- unlockedEffortPraise (at least 1 LP3 in this session) ---
  if (!record.unlockedEffortPraise && growth_praise >= 1) {
    updates.unlockedEffortPraise = true;
  }

  // --- unlockedRegulatoryPraise (at least 1 LP4 in this session) ---
  if (!record.unlockedRegulatoryPraise && regulatory_praise >= 1) {
    updates.unlockedRegulatoryPraise = true;
  }

  return updates;
}

module.exports = { getGoalDirective, tagCountsToSession, recordToProfile, computeMasteryUpdates };
