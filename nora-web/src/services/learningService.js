// Learning progress service for API calls
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class LearningService {
  // Get user's learning progress
  async getProgress() {
    const accessToken = localStorage.getItem('accessToken');

    // If no token (mock user), use localStorage fallback
    if (!accessToken) {
      const savedDeck = localStorage.getItem('pcit_current_deck');
      const savedUnlockedDecks = localStorage.getItem('pcit_unlocked_decks');
      return {
        currentDeck: savedDeck ? parseInt(savedDeck) : 1,
        unlockedDecks: savedUnlockedDecks ? parseInt(savedUnlockedDecks) : 1,
        updatedAt: new Date().toISOString()
      };
    }

    const response = await fetch(`${API_URL}/api/learning/progress`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch learning progress');
    }

    return await response.json();
  }

  // Update user's learning progress
  async updateProgress(currentDeck, unlockedDecks) {
    const accessToken = localStorage.getItem('accessToken');

    // If no token (mock user), use localStorage fallback
    if (!accessToken) {
      localStorage.setItem('pcit_current_deck', currentDeck.toString());
      localStorage.setItem('pcit_unlocked_decks', unlockedDecks.toString());
      return {
        currentDeck,
        unlockedDecks,
        updatedAt: new Date().toISOString()
      };
    }

    const response = await fetch(`${API_URL}/api/learning/progress`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ currentDeck, unlockedDecks }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update learning progress');
    }

    return await response.json();
  }
}

export default new LearningService();
