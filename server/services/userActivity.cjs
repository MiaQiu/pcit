// Records that a user was active today. Called from requireAuth on every
// authenticated request; writes to the DB at most once per user per Singapore (UTC+8) day.
const prisma = require('./db.cjs');

// Singapore has no DST, so a fixed offset is exact.
const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;

// Users already recorded by this process for the current Singapore day.
let recordedDay = null;
let recordedUsers = new Set();

function markUserActive(userId) {
  if (!userId) return;

  const now = new Date();
  const dayKey = new Date(now.getTime() + SGT_OFFSET_MS).toISOString().slice(0, 10);
  if (dayKey !== recordedDay) {
    recordedDay = dayKey;
    recordedUsers = new Set();
  }
  if (recordedUsers.has(userId)) return;
  recordedUsers.add(userId);

  const startOfDay = new Date(`${dayKey}T00:00:00.000+08:00`);
  // Conditional update so multiple instances don't rewrite the same day.
  prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: startOfDay } }],
    },
    data: { lastActiveAt: now },
  }).catch((error) => {
    recordedUsers.delete(userId);
    console.error('[userActivity] Failed to update lastActiveAt:', error.message);
  });
}

module.exports = { markUserActive };
