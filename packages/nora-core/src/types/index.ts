/**
 * Shared type definitions for Nora platform
 */

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  childName: string;
  childBirthYear?: number;
  childConditions?: string;
  therapistId?: string | null;
  currentStreak?: number;
  lastSessionDate?: Date | null;
  longestStreak?: number;
  createdAt?: Date;
}

// Auth types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface SignupResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
  childName: string;
  childBirthYear?: number;
  childConditions?: string;
}

// Session types
export type SessionMode = 'CDI' | 'PDI';

export interface Session {
  id: string;
  userId: string;
  mode: SessionMode;
  storagePath: string;
  durationSeconds: number;
  transcript: string;
  aiFeedbackJSON: any;
  pcitCoding: any;
  tagCounts: any;
  masteryAchieved: boolean;
  riskScore: number;
  flaggedForReview: boolean;
  coachAlertSent: boolean;
  coachAlertSentAt?: Date | null;
  createdAt: Date;
  childMetrics?: any;
}

// PCIT Analysis types
export interface PCITCoding {
  totalUtterances: number;
  skillCounts: {
    [key: string]: number;
  };
  avoidCounts: {
    [key: string]: number;
  };
  ratios: {
    [key: string]: number;
  };
}

export interface CompetencyAnalysis {
  overall: string;
  specificFeedback: string[];
  strengths: string[];
  areasForGrowth: string[];
}

// CDI (Child-Directed Interaction) types
export interface CDICounts {
  praise: number;
  echo: number;
  narration: number;
  question: number;
  command: number;
  criticism: number;
  negative_phrases: number;
  neutral: number;
  totalPen?: number;
  totalAvoid?: number;
}

export interface CDIMastery {
  mastered: boolean;
  criteria: {
    praise: { target: number; met: boolean };
    echo: { target: number; met: boolean };
    narration: { target: number; met: boolean };
    totalAvoid: { target: number; met: boolean };
    negative_phrases: { target: number; met: boolean };
  };
}

// PDI (Parent-Directed Interaction) types
export interface PDICounts {
  direct_command: number;
  positive_command: number;
  specific_command: number;
  labeled_praise: number;
  correct_warning: number;
  correct_timeout: number;
  indirect_command: number;
  negative_command: number;
  vague_command: number;
  chained_command: number;
  harsh_tone: number;
  neutral: number;
  totalEffective?: number;
  totalIneffective?: number;
  totalCommands?: number;
  effectivePercent?: number;
}

export interface FlaggedItem {
  text: string;
  speaker: number | null;
  timestamp: number | null;
  reason: string;
}

export interface AnalysisResult {
  parentSpeaker: number;
  coding: string;
  fullResponse?: string;
}

// Transcription types
export interface TranscriptionSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

export interface TranscriptionResponse {
  segments: TranscriptionSegment[];
  fullText: string;
  parentSpeaker: string;
}

// API Error types
export interface APIError {
  error: string;
  message?: string;
  statusCode?: number;
}
