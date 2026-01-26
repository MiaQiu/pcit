/**
 * Utterance Database Operations
 * Handles CRUD operations for utterances in the database
 */
const prisma = require('../services/db.cjs');

/**
 * @typedef {Object} UtteranceData
 * @property {string} speaker - Speaker ID (e.g., 'speaker_0')
 * @property {string} text - Utterance text
 * @property {number} start - Start time in seconds
 * @property {number} end - End time in seconds
 * @property {string} [role] - 'adult' or 'child' (added after role identification)
 * @property {string} [tag] - PCIT coding tag (e.g., 'DO: Praise') (added after PCIT coding)
 */

/**
 * Create utterances in database from parsed transcript data
 * @param {string} sessionId - Session ID
 * @param {Array<UtteranceData>} utterancesData - Array of utterance data
 * @returns {Promise<void>}
 */
async function createUtterances(sessionId, utterancesData) {
  const utteranceRecords = utterancesData.map((utt, index) => ({
    sessionId,
    speaker: utt.speaker,
    text: utt.text,
    startTime: utt.start,
    endTime: utt.end,
    role: utt.role || null,
    pcitTag: utt.tag || null,
    order: index
  }));

  await prisma.utterance.createMany({
    data: utteranceRecords
  });
}

/**
 * Get utterances for a session from database
 * @param {string} sessionId - Session ID
 * @returns {Promise<Array>} Array of utterance records ordered by order field
 */
async function getUtterances(sessionId) {
  return await prisma.utterance.findMany({
    where: { sessionId },
    orderBy: { order: 'asc' }
  });
}

/**
 * Update utterances with role information (optimized batch update)
 * @param {string} sessionId - Session ID
 * @param {Object} roleMap - Map of speaker ID to role (e.g., { 'speaker_0': 'child', 'speaker_1': 'adult' })
 * @returns {Promise<void>}
 */
async function updateUtteranceRoles(sessionId, roleMap) {
  // Use updateMany for each speaker (batched by speaker ID)
  const updatePromises = Object.entries(roleMap).map(([speakerId, role]) => {
    return prisma.utterance.updateMany({
      where: {
        sessionId,
        speaker: speakerId
      },
      data: { role }
    });
  });

  await Promise.all(updatePromises);
}

// Silent slot constants
const SILENT_SPEAKER_ID = '__SILENT__';
const DEFAULT_SILENCE_THRESHOLD_SECONDS = 3.0;

/**
 * Extract silent slots (gaps) from utterances array
 * @param {Array<UtteranceData>} utterances - Array of utterances sorted by start time
 * @param {Object} options - Configuration options
 * @param {number} [options.threshold=3.0] - Minimum gap duration in seconds to be considered a silent slot
 * @param {number} [options.recordingDuration] - Total recording duration (to detect trailing silence)
 * @returns {Array<Object>} Array of silent slot objects with start, end, duration, and position info
 */
function extractSilentSlots(utterances, options = {}) {
  const threshold = options.threshold || DEFAULT_SILENCE_THRESHOLD_SECONDS;
  const recordingDuration = options.recordingDuration || null;
  const silentSlots = [];

  if (utterances.length === 0) {
    return silentSlots;
  }

  // Check for leading silence (before first utterance)
  const firstUtterance = utterances[0];
  if (firstUtterance.start > threshold) {
    silentSlots.push({
      start: 0,
      end: firstUtterance.start,
      duration: firstUtterance.start,
      afterUtteranceIndex: -1 // Before first utterance
    });
  }

  // Check for gaps between consecutive utterances
  for (let i = 0; i < utterances.length - 1; i++) {
    const currentEnd = utterances[i].end;
    const nextStart = utterances[i + 1].start;
    const gap = nextStart - currentEnd;

    if (gap >= threshold) {
      silentSlots.push({
        start: currentEnd,
        end: nextStart,
        duration: gap,
        afterUtteranceIndex: i
      });
    }
  }

  // Check for trailing silence (after last utterance)
  if (recordingDuration) {
    const lastUtterance = utterances[utterances.length - 1];
    const trailingGap = recordingDuration - lastUtterance.end;
    if (trailingGap >= threshold) {
      silentSlots.push({
        start: lastUtterance.end,
        end: recordingDuration,
        duration: trailingGap,
        afterUtteranceIndex: utterances.length - 1
      });
    }
  }

  console.log(`🔇 [SILENT-SLOTS] Found ${silentSlots.length} silent slots (threshold: ${threshold}s)`);
  return silentSlots;
}

/**
 * Generate feedback message for a silent slot based on duration
 * @param {number} duration - Duration of silence in seconds
 * @returns {string} Coaching feedback message
 */
function generateSilentSlotFeedback(duration) {
  if (duration >= 10) {
    return "This was a long quiet moment. Try narrating what your child is doing or give a labeled praise!";
  } else if (duration >= 5) {
    return "Nice pause here! You could describe what your child is doing during quiet moments.";
  } else {
    return "A brief pause - great opportunity to add a narration or reflection.";
  }
}

/**
 * Insert silent slots into the database
 * @param {string} sessionId - Session ID
 * @param {Array<Object>} silentSlots - Array of silent slot objects from extractSilentSlots()
 * @returns {Promise<number>} Number of silent slots inserted
 */
async function insertSilentSlots(sessionId, silentSlots) {
  if (silentSlots.length === 0) {
    return 0;
  }

  const silentSlotRecords = silentSlots.map((slot, index) => ({
    sessionId,
    speaker: SILENT_SPEAKER_ID,
    text: '',
    startTime: slot.start,
    endTime: slot.end,
    role: null,
    pcitTag: 'SILENT',
    noraTag: 'Silent Slot',
    feedback: generateSilentSlotFeedback(slot.duration),
    // Temporary order, will be fixed by reorderUtterancesByTime
    order: 10000 + index
  }));

  await prisma.utterance.createMany({
    data: silentSlotRecords
  });

  console.log(`🔇 [SILENT-SLOTS] Inserted ${silentSlots.length} silent slots into database`);
  return silentSlots.length;
}

/**
 * Reorder all utterances in a session by startTime
 * Updates the order field to be sequential (0, 1, 2, ...) based on chronological order
 * @param {string} sessionId - Session ID
 * @returns {Promise<number>} Number of utterances reordered
 */
async function reorderUtterancesByTime(sessionId) {
  // Get all utterances sorted by startTime
  const utterances = await prisma.utterance.findMany({
    where: { sessionId },
    orderBy: { startTime: 'asc' },
    select: { id: true, startTime: true, order: true }
  });

  if (utterances.length === 0) {
    return 0;
  }

  // Update each utterance with its new order
  const updatePromises = utterances.map((u, index) => {
    if (u.order === index) {
      // Skip if order is already correct
      return Promise.resolve();
    }
    return prisma.utterance.update({
      where: { id: u.id },
      data: { order: index }
    });
  });

  await Promise.all(updatePromises);
  console.log(`🔄 [REORDER] Reordered ${utterances.length} utterances by startTime`);
  return utterances.length;
}

/**
 * Extract and insert silent slots for a session
 * Combines extraction, insertion, and reordering in one call
 * @param {string} sessionId - Session ID
 * @param {Array<UtteranceData>} utterances - Array of utterances sorted by start time
 * @param {Object} options - Configuration options
 * @param {number} [options.threshold=3.0] - Minimum gap duration in seconds
 * @param {number} [options.recordingDuration] - Total recording duration
 * @returns {Promise<{count: number, slots: Array}>} Number of slots inserted and slot details
 */
async function extractAndInsertSilentSlots(sessionId, utterances, options = {}) {
  const silentSlots = extractSilentSlots(utterances, options);

  if (silentSlots.length > 0) {
    await insertSilentSlots(sessionId, silentSlots);
    // Reorder all utterances by startTime so silent slots have correct order
    await reorderUtterancesByTime(sessionId);
  }

  return {
    count: silentSlots.length,
    slots: silentSlots
  };
}

/**
 * Update utterances with PCIT tags and feedback (optimized batch update with ID-based matching)
 * @param {string} sessionId - Session ID
 * @param {Object} pcitTagMap - Map of utterance ID to DPICS code (RF, LP, etc.)
 * @param {Object} noraTagMap - Map of utterance ID to display name (Echo, Labeled Praise, etc.)
 * @param {Object} feedbackMap - Map of utterance ID to feedback string (optional)
 * @returns {Promise<void>}
 */
async function updateUtteranceTags(sessionId, pcitTagMap, noraTagMap, feedbackMap = {}) {
  // Build array of updates to perform in parallel
  const updatePromises = [];

  for (const [utteranceId, pcitTag] of Object.entries(pcitTagMap)) {
    const noraTag = noraTagMap[utteranceId];
    const feedback = feedbackMap[utteranceId] || null;
    updatePromises.push(
      prisma.utterance.update({
        where: { id: utteranceId },
        data: {
          pcitTag: pcitTag,  // DPICS code (RF, LP, etc.)
          noraTag: noraTag,   // Display name (Echo, Labeled Praise, etc.)
          feedback: feedback  // Feedback string
        }
      })
    );
  }

  // Execute all updates in parallel
  await Promise.all(updatePromises);
}

/**
 * Update utterances with revised feedback from Call 4
 * @param {string} sessionId - Session ID
 * @param {Array} revisedFeedback - Array of {id: orderIndex, feedback: string, additional_tip: string|null}
 * @returns {Promise<number>} Number of utterances updated
 */
async function updateRevisedFeedback(sessionId, revisedFeedback) {
  if (!revisedFeedback || revisedFeedback.length === 0) {
    return 0;
  }

  // Get all utterances to map order -> database ID
  const utterances = await prisma.utterance.findMany({
    where: { sessionId },
    select: { id: true, order: true }
  });

  // Create order to ID map
  const orderToId = {};
  for (const u of utterances) {
    orderToId[u.order] = u.id;
  }

  // Build update promises
  const updatePromises = [];
  for (const item of revisedFeedback) {
    const utteranceId = orderToId[item.id];
    if (!utteranceId) {
      console.warn(`⚠️ [REVISED-FEEDBACK] No utterance found for order ${item.id}`);
      continue;
    }

    updatePromises.push(
      prisma.utterance.update({
        where: { id: utteranceId },
        data: {
          revisedFeedback: item.feedback || null,
          additionalTip: item.additional_tip || null
        }
      })
    );
  }

  await Promise.all(updatePromises);
  console.log(`✅ [REVISED-FEEDBACK] Updated ${updatePromises.length} utterances with revised feedback`);
  return updatePromises.length;
}

module.exports = {
  createUtterances,
  getUtterances,
  updateUtteranceRoles,
  updateUtteranceTags,
  updateRevisedFeedback,
  extractSilentSlots,
  insertSilentSlots,
  extractAndInsertSilentSlots,
  reorderUtterancesByTime,
  SILENT_SPEAKER_ID,
  DEFAULT_SILENCE_THRESHOLD_SECONDS
};
