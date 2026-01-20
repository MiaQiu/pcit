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

module.exports = {
  createUtterances,
  getUtterances,
  updateUtteranceRoles,
  updateUtteranceTags
};
