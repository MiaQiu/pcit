// Streak service for fetching streak information
import authService from './authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class StreakService {
  /**
   * Get user's current streak information
   * @returns {Promise<{currentStreak: number, longestStreak: number, lastSessionDate: string|null}>}
   */
  async getStreak() {
    const response = await authService.authenticatedRequest(
      `${API_URL}/api/sessions/streak`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch streak');
    }

    return await response.json();
  }
}

// Export singleton instance
export default new StreakService();
