// Session service for backend API calls
import authService from './authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class SessionService {
  // Upload a new session with audio and analysis results
  async uploadSession(sessionData) {
    const {
      audioBlob,
      mode,
      transcript,
      pcitCoding,
      tagCounts,
      durationSeconds,
      aiFeedback = {}
    } = sessionData;

    // Convert audio blob to base64
    let audioData = null;
    if (audioBlob) {
      audioData = await this.blobToBase64(audioBlob);
    }

    const response = await authService.authenticatedRequest(
      `${API_URL}/api/sessions/upload`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioData,
          mode,
          transcript: typeof transcript === 'string' ? transcript : JSON.stringify(transcript),
          pcitCoding,
          tagCounts,
          durationSeconds,
          aiFeedbackJSON: aiFeedback
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload session');
    }

    return await response.json();
  }

  // Get user's session list
  async getSessions(options = {}) {
    const { mode, limit = 20, offset = 0 } = options;

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (mode) {
      params.append('mode', mode);
    }

    const response = await authService.authenticatedRequest(
      `${API_URL}/api/sessions?${params.toString()}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch sessions');
    }

    return await response.json();
  }

  // Get detailed session information
  async getSessionById(sessionId) {
    const response = await authService.authenticatedRequest(
      `${API_URL}/api/sessions/${sessionId}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch session');
    }

    return await response.json();
  }

  // Delete a session
  async deleteSession(sessionId) {
    const response = await authService.authenticatedRequest(
      `${API_URL}/api/sessions/${sessionId}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete session');
    }

    return await response.json();
  }

  // Helper: Convert Blob to base64
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Helper: Format transcript for display
  formatTranscript(transcript) {
    if (typeof transcript === 'string') {
      try {
        return JSON.parse(transcript);
      } catch {
        return transcript;
      }
    }
    return transcript;
  }
}

// Export singleton instance
export default new SessionService();
