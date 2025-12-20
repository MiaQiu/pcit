import type AuthService from './authService';

/**
 * Recording analysis response from API
 */
export interface RecordingAnalysis {
  id: string;
  mode: 'CDI' | 'PDI';
  durationSeconds: number;
  createdAt: string;
  status: 'completed' | 'processing';
  encouragement: string;
  noraScore: number;
  skills: Array<{
    label: string;
    progress: number;
  }>;
  areasToAvoid: Array<{
    label: string;
    count: number;
  }>;
  topMoment: {
    quote: string;
    audioUrl: string;
    duration: string;
  };
  tips: string;
  reminder?: string | null;
  tomorrowGoal: string;
  stats: {
    totalPlayTime: string;
    [key: string]: any;
  };
  transcript?: any[];
  pcitCoding?: any;
  competencyAnalysis?: {
    topMoment?: string | null;
    tips?: string | null;
    reminder?: string | null;
    analyzedAt: string;
    mode: string;
  } | null;
}

/**
 * Recording Service
 * Handles fetching recording analysis and reports
 */
class RecordingService {
  private authService: AuthService;
  private apiUrl: string;

  constructor(authService: AuthService, apiUrl: string) {
    this.authService = authService;
    this.apiUrl = apiUrl;
  }

  /**
   * Get analysis for a recording
   * Returns 202 if still processing, 200 when complete, 500 if failed
   */
  async getAnalysis(recordingId: string): Promise<RecordingAnalysis> {
    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/recordings/${recordingId}/analysis`
    );

    if (response.status === 202) {
      // Still processing
      const data = await response.json();
      throw new Error(data.message || 'Analysis still processing');
    }

    if (response.status === 500) {
      // Analysis failed
      const errorData = await response.json();
      const errorMessage = errorData.message || errorData.error || 'Report generation failed';

      // Create error with clear message that includes "Report generation failed" for detection
      const failedError: any = new Error(`Report generation failed: ${errorMessage}`);
      failedError.status = 'failed';
      failedError.userMessage = errorMessage;
      failedError.failedAt = errorData.failedAt;
      failedError.originalError = errorData.error;

      console.error('[RecordingService] Analysis failed:', {
        status: failedError.status,
        message: failedError.message,
        userMessage: failedError.userMessage
      });

      throw failedError;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch analysis');
    }

    return await response.json();
  }

  /**
   * Get recording details (without full analysis)
   */
  async getRecording(recordingId: string): Promise<any> {
    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/recordings/${recordingId}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch recording');
    }

    return await response.json();
  }

  /**
   * Get list of all recordings
   */
  async getRecordings(): Promise<{ recordings: any[] }> {
    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/recordings`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch recordings');
    }

    return await response.json();
  }
}

export default RecordingService;
