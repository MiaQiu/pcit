// Streak calculation and update utilities
const prisma = require('../services/db.cjs');

/**
 * Update user's streak after a new session is created
 * @param {string} userId - The user's ID
 * @returns {Promise<{currentStreak: number, longestStreak: number}>}
 */
async function updateUserStreak(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastSessionDate = user.lastSessionDate ? new Date(user.lastSessionDate) : null;
    if (lastSessionDate) {
      lastSessionDate.setHours(0, 0, 0, 0);
    }

    let newStreak = user.currentStreak;
    let newLongestStreak = user.longestStreak;

    // If there's no last session date, this is the first session
    if (!lastSessionDate) {
      newStreak = 1;
    } else {
      const daysSinceLastSession = Math.floor((today - lastSessionDate) / (1000 * 60 * 60 * 24));

      if (daysSinceLastSession === 0) {
        // Same day - don't change streak
        newStreak = user.currentStreak;
      } else if (daysSinceLastSession === 1) {
        // Consecutive day - increment streak
        newStreak = user.currentStreak + 1;
      } else {
        // Streak broken - reset to 1
        newStreak = 1;
      }
    }

    // Update longest streak if current streak is higher
    if (newStreak > newLongestStreak) {
      newLongestStreak = newStreak;
    }

    // Update user with new streak values
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        lastSessionDate: new Date()
      }
    });

    return {
      currentStreak: updatedUser.currentStreak,
      longestStreak: updatedUser.longestStreak,
      lastSessionDate: updatedUser.lastSessionDate
    };
  } catch (error) {
    console.error('Error updating streak:', error);
    throw error;
  }
}

/**
 * Get user's current streak information
 * @param {string} userId - The user's ID
 * @returns {Promise<{currentStreak: number, longestStreak: number, lastSessionDate: Date|null}>}
 */
async function getUserStreak(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        currentStreak: true,
        longestStreak: true,
        lastSessionDate: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if streak should be reset (more than 1 day since last session)
    if (user.lastSessionDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastSessionDate = new Date(user.lastSessionDate);
      lastSessionDate.setHours(0, 0, 0, 0);

      const daysSinceLastSession = Math.floor((today - lastSessionDate) / (1000 * 60 * 60 * 24));

      // If more than 1 day has passed, reset streak to 0
      if (daysSinceLastSession > 1 && user.currentStreak > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { currentStreak: 0 }
        });

        return {
          currentStreak: 0,
          longestStreak: user.longestStreak,
          lastSessionDate: user.lastSessionDate
        };
      }
    }

    return {
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      lastSessionDate: user.lastSessionDate
    };
  } catch (error) {
    console.error('Error getting streak:', error);
    throw error;
  }
}

module.exports = {
  updateUserStreak,
  getUserStreak
};
