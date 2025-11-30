import type AuthService from './authService';
import type { Session, SessionMode } from '../types';

/**
 * Session upload data
 */
export interface SessionUploadData {
  audioBlob: Blob | null;
  mode: SessionMode;
  transcript: string | any;
  pcitCoding: any;
  tagCounts: any;
  durationSeconds: number;
  aiFeedback?: any;
}

/**
 * Session list options
 */
export interface SessionListOptions {
  mode?: SessionMode;
  limit?: number;
  offset?: number;
}

/**
 * Session Service
 * Handles session upload, retrieval, and management
 */
class SessionService {
  private authService: AuthService;
  private apiUrl: string;

  constructor(authService: AuthService, apiUrl: string) {
    this.authService = authService;
    this.apiUrl = apiUrl;
  }

  /**
   * Upload a new session with audio and analysis results
   */
  async uploadSession(sessionData: SessionUploadData): Promise<any> {
    const {
      audioBlob,
      mode,
      transcript,
      pcitCoding,
      tagCounts,
      durationSeconds,
      aiFeedback = {},
    } = sessionData;

    // Convert audio blob to base64
    let audioData: string | null = null;
    if (audioBlob) {
      audioData = await this.blobToBase64(audioBlob);
    }

    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/sessions/upload`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioData,
          mode,
          transcript:
            typeof transcript === 'string' ? transcript : JSON.stringify(transcript),
          pcitCoding,
          tagCounts,
          durationSeconds,
          aiFeedbackJSON: aiFeedback,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload session');
    }

    return await response.json();
  }

  /**
   * Get user's session list
   */
  async getSessions(options: SessionListOptions = {}): Promise<{ sessions: Session[] }> {
    const { mode, limit = 20, offset = 0 } = options;

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (mode) {
      params.append('mode', mode);
    }

    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/sessions?${params.toString()}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch sessions');
    }

    return await response.json();
  }

  /**
   * Get detailed session information
   */
  async getSessionById(sessionId: string): Promise<{ session: Session }> {
    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/sessions/${sessionId}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch session');
    }

    return await response.json();
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<any> {
    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/sessions/${sessionId}`,
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

  /**
   * Helper: Convert Blob to base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Helper: Format transcript for display
   */
  formatTranscript(transcript: string | any): any {
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

export default SessionService;
