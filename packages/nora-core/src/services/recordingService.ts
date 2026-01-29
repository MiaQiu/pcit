import type AuthService from './authService';

/**
 * Recording analysis response from API
 */
export interface StructuredTips {
  observation: string;
  why: string;
  example: string;
  actionableTip: string;
}

export interface CoachInsightAnalysis {
  observation: string;
  impact: string;
  result: string;
}

export interface CoachInsightExample {
  child: string;
  parent: string;
}

export interface CoachInsight {
  id: number;
  suggested_change: string;
  analysis: CoachInsightAnalysis;
  example_scenario: CoachInsightExample;
}

// ChildPortfolioInsights is now an array of CoachInsight
export type ChildPortfolioInsights = CoachInsight[];

export interface AboutChildItem {
  id: number;
  Title: string;
  Description: string;
  Details: string;
}

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
  topMoment: string | {
    quote: string;
    celebration?: string | null;  // Celebration of the top moment
    audioUrl: string;
    duration: string;
  };
  topMomentUtteranceNumber?: number | null;  // Utterance index for top moment
  summary?: string | null;  // Session summary
  tip?: string | null;  // Simplified single tip
  exampleIndex?: number | null;  // Utterance index for example
  transition?: string | null;  // Transition text between tip and example (deprecated)
  feedback?: string | null;  // Constructive feedback with example reference
  childReaction?: string | null;  // What we learned about the child
  tips?: string | StructuredTips;  // KEEP for backward compatibility
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
    topMomentUtteranceNumber?: number | null;
    feedback?: string | null;
    childReaction?: string | null;
    example?: number | null;
    tips?: string | null;
    reminder?: string | null;
    analyzedAt: string;
    mode: string;
  } | null;
  childPortfolioInsights?: ChildPortfolioInsights | null;
  aboutChild?: AboutChildItem[] | null;
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
   * Get list of recordings
   * @param options Optional filters
   * @param options.from ISO date string for start of date range
   * @param options.to ISO date string for end of date range
   */
  async getRecordings(options?: { from?: string; to?: string }): Promise<{ recordings: any[] }> {
    let url = `${this.apiUrl}/api/recordings`;

    // Add query parameters if provided
    if (options?.from || options?.to) {
      const params = new URLSearchParams();
      if (options.from) params.append('from', options.from);
      if (options.to) params.append('to', options.to);
      url += `?${params.toString()}`;
    }

    const response = await this.authService.authenticatedRequest(url);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch recordings');
    }

    return await response.json();
  }

  /**
   * Get dashboard data (optimized single call)
   * Returns today's recordings, this week's recordings, and latest completed report
   */
  async getDashboard(): Promise<{
    todayRecordings: any[];
    thisWeekRecordings: any[];
    latestWithReport: any | null;
  }> {
    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/recordings/dashboard`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch dashboard data');
    }

    return await response.json();
  }

  /**
   * Delete a recording
   */
  async deleteRecording(recordingId: string): Promise<void> {
    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/recordings/${recordingId}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete recording');
    }
  }
}

export default RecordingService;
