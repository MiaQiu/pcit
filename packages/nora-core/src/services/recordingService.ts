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

export interface DevelopmentalObservationDetail {
  insight: string;
  evidence: string;
}

export interface DevelopmentalDomain {
  category: 'Language' | 'Cognitive' | 'Social' | 'Emotional' | 'Connection';
  framework: string;
  developmental_status: string;
  current_level: string;
  benchmark_for_age: string;
  detailed_observations: DevelopmentalObservationDetail[];
}

export interface DevelopmentalObservation {
  summary: string | null;
  domains: DevelopmentalDomain[];
}

export interface CoachingCardScenario {
  context: string;
  instead_of: string;
  try_this: string;
}

export interface CoachingCard {
  card_id: number;
  title: string;
  icon_suggestion: string;
  coaching_tip: string;
  apply_in_daily_life?: string | null;
  next_day_goal?: string | null;
  scenario: CoachingCardScenario | null;
}

export interface MilestoneCelebration {
  status: 'EMERGING' | 'ACHIEVED';
  category: string;
  title: string;
  actionTip: string | null;
}

export interface DevelopmentalDomainProgress {
  achieved: number;
  emerging: number;
  total: number;
  benchmark: number;
}

export interface DevelopmentalProgress {
  childAgeMonths: number;
  childName: string;
  domains: Record<'Language' | 'Cognitive' | 'Social' | 'Emotional' | 'Connection', DevelopmentalDomainProgress>;
}

export type DomainType = 'Language' | 'Cognitive' | 'Social' | 'Emotional' | 'Connection';

export interface DomainMilestone {
  id: string;
  displayTitle: string;
  groupingStage: string;
  status: 'ACHIEVED' | 'EMERGING' | 'NOT_YET';
  achievedAt: string | null;
  firstObservedAt: string | null;
  actionTip: string | null;
}

export interface DomainProfilingObservation {
  insight: string;
  evidence: string;
}

export interface DomainProfiling {
  category: string;
  framework: string;
  current_level: string;
  benchmark_for_age: string;
  developmental_status: string;
  detailed_observations: DomainProfilingObservation[];
}

export interface DomainMilestonesResponse {
  domain: DomainType;
  milestones: DomainMilestone[];
  profiling: DomainProfiling | null;
  childName: string;
}

export interface MilestoneHistoryEntry {
  date: string;
  achievedCount: number;
  emergingCount: number;
}

export interface MilestoneHistoryResponse {
  childAgeMonths: number;
  history: MilestoneHistoryEntry[];
  summary: {
    totalAchieved: number;
    totalEmerging: number;
  };
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
  topMomentStartTime?: number | null;  // Start time in seconds
  topMomentEndTime?: number | null;  // End time in seconds
  audioUrl?: string | null;  // Presigned URL for audio playback
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
  developmentalObservation?: DevelopmentalObservation | null;
  coachingSummary?: string | null;
  coachingCards?: CoachingCard[] | null;
  pdiSkills?: Array<{
    skill: string;
    performance: string;
    feedback: string;
    details: string;
  }> | null;
  pdiTomorrowGoal?: string | null;
  pdiEncouragement?: string | null;
  pdiSummary?: string | null;
  milestoneCelebrations?: MilestoneCelebration[] | null;
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

  /**
   * Get developmental progress by domain
   * Returns child's milestone progress across 5 domains with age-appropriate benchmarks
   */
  async getDevelopmentalProgress(): Promise<DevelopmentalProgress> {
    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/learning/developmental-progress`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch developmental progress');
    }

    return await response.json();
  }

  /**
   * Get detailed milestones for a specific domain
   * Returns all milestones with their status (ACHIEVED, EMERGING, NOT_YET)
   */
  async getDomainMilestones(domain: DomainType): Promise<DomainMilestonesResponse> {
    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/learning/domain-milestones/${domain}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch domain milestones');
    }

    return await response.json();
  }

  /**
   * Get milestone history over time
   * Returns monthly snapshots of achieved/emerging counts
   */
  async getMilestoneHistory(months: number = 6): Promise<MilestoneHistoryResponse> {
    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/learning/milestone-history?months=${months}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch milestone history');
    }

    return await response.json();
  }
  /**
   * Submit user feedback on a session report
   */
  async submitReportFeedback(recordingId: string, feedback: {
    sentiment: 'positive' | 'negative';
    reasons: string[];
    freeText?: string;
  }): Promise<{ success: boolean }> {
    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/recordings/${recordingId}/feedback`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit feedback');
    }

    return await response.json();
  }

  /**
   * Get report visibility settings from server config
   */
  async getReportVisibility(): Promise<{ daily: boolean; weekly: boolean; monthly: boolean }> {
    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/config/report-visibility`
    );

    if (!response.ok) {
      // Default to all hidden on error
      return { daily: false, weekly: false, monthly: false };
    }

    return await response.json();
  }

  /**
   * Get weekly reports that the admin has made visible for this user
   */
  async getVisibleWeeklyReports(): Promise<{ reports: Array<{
    id: string;
    weekStartDate: string;
    weekEndDate: string;
    headline: string | null;
    totalDeposits: number;
    sessionIds: string[];
  }> }> {
    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/config/weekly-reports`
    );

    if (!response.ok) {
      return { reports: [] };
    }

    return await response.json();
  }

  /**
   * Get a single full weekly report by ID
   */
  async getWeeklyReport(reportId: string): Promise<WeeklyReportData | null> {
    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/config/weekly-reports/${reportId}`
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  }

  /**
   * Save the user's check-in responses for a weekly report
   */
  async saveWeeklyCheckin(reportId: string, data: {
    moodSelection?: string | null;
    issueRatings?: Record<string, string> | null;
  }): Promise<void> {
    await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/config/weekly-reports/${reportId}/checkin`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );
  }
}

export interface WeeklyReportData {
  id: string;
  userId: string;
  childId: string | null;
  weekStartDate: string;
  weekEndDate: string;
  visibility: boolean;
  headline: string | null;
  totalDeposits: number;
  massageTimeMinutes: number;
  praiseCount: number;
  echoCount: number;
  narrateCount: number;
  skillCelebrationTitle: string | null;
  scenarioCards: Array<{ label: string; body: string; exampleScript: string }> | null;
  topMoments: Array<{
    date: string;
    dayLabel: string;
    dateLabel: string;
    tag: string;
    sessionTitle: string;
    quote: string;
    celebration: string;
    audioUrl?: string | null;
    startTime?: number | null;
    endTime?: number | null;
  }> | null;
  milestones: Array<{
    status: string;
    category: string;
    title: string;
    actionTip: string | null;
  }> | null;
  focusHeading: string | null;
  focusSubtext: string | null;
  whyExplanation: string | null;
  moodSelection: string | null;
  issueRatings: Record<string, string> | null;
  sessionIds: string[];
}

export default RecordingService;
