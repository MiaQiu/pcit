/**
 * Shared type definitions for Nora platform
 */

// Subscription types
export type SubscriptionPlan = 'TRIAL' | 'PREMIUM' | 'FREE';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
export type RelationshipToChild = 'MOTHER' | 'FATHER' | 'GRANDMOTHER' | 'GRANDFATHER' | 'GUARDIAN' | 'OTHER';

export interface SubscriptionInfo {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialStartDate?: Date;
  trialEndDate?: Date;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  daysRemaining?: number;
}

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  childName: string;
  childBirthYear?: number;
  childBirthday?: Date;
  childConditions?: string;
  issue?: string | string[];
  profileImageUrl?: string;
  relationshipToChild?: RelationshipToChild;
  therapistId?: string | null;
  currentStreak?: number;
  lastSessionDate?: Date | null;
  longestStreak?: number;
  createdAt?: Date;

  // Subscription fields
  subscriptionPlan?: SubscriptionPlan;
  subscriptionStatus?: SubscriptionStatus;
  trialStartDate?: Date;
  trialEndDate?: Date;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
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

// ============================================================================
// LEARNING SYSTEM TYPES
// Bite-size learning curriculum types
// ============================================================================

export type LessonPhase = 'CONNECT' | 'DISCIPLINE';
export type ContentType = 'TEXT' | 'EXAMPLE' | 'TIP' | 'SCRIPT' | 'CALLOUT';
export type ProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'LOCKED';

export interface Lesson {
  id: string;
  phase: LessonPhase;
  phaseNumber: number;
  dayNumber: number;
  title: string;
  subtitle?: string;
  shortDescription: string;
  objectives: string[];
  estimatedMinutes: number;
  isBooster: boolean;
  prerequisites: string[];
  teachesCategories: string[]; // Links to ModuleHistory categories (PRAISE, ECHO, etc.)

  // UI assets
  dragonImageUrl?: string;
  backgroundColor: string;
  ellipse77Color: string;
  ellipse78Color: string;

  // Content (populated in detail endpoint)
  segments?: LessonSegment[];
  quiz?: Quiz;

  createdAt: Date;
  updatedAt: Date;
}

export interface LessonSegment {
  id: string;
  lessonId: string;
  order: number;
  sectionTitle?: string;
  contentType: ContentType;
  bodyText: string;
  imageUrl?: string;
  iconType?: string;
}

export interface Quiz {
  id: string;
  lessonId: string;
  question: string;
  options: QuizOption[];
  correctAnswer: string; // The correct option ID
  explanation: string;
}

export interface QuizOption {
  id: string;
  optionLabel: string; // 'A', 'B', 'C', 'D'
  optionText: string;
  order: number;
}

export interface UserLessonProgress {
  id: string;
  userId: string;
  lessonId: string;
  status: ProgressStatus;
  currentSegment: number;
  totalSegments: number;
  completedAt?: Date;
  startedAt: Date;
  lastViewedAt: Date;
  timeSpentSeconds: number;
}

export interface QuizResponse {
  id: string;
  userId: string;
  quizId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  attemptNumber: number;
  respondedAt: Date;
}

// API Response types for lessons

export interface LessonCardData {
  id: string;
  phase: string;
  phaseName: string;
  title: string;
  subtitle?: string;
  description: string;
  dragonImageUrl?: string;
  backgroundColor: string;
  ellipse77Color: string;
  ellipse78Color: string;
  isLocked: boolean;
  progress?: UserLessonProgress;
}

export interface LessonListResponse {
  lessons: LessonCardData[];
  userProgress: Record<string, UserLessonProgress>;
  contentVersion: string; // Hash that changes when lessons are modified
}

export interface LessonDetailResponse {
  lesson: Lesson;
  userProgress?: UserLessonProgress;
}

export interface UpdateProgressRequest {
  currentSegment: number;
  timeSpentSeconds?: number;
  status?: ProgressStatus;
}

export interface SubmitQuizRequest {
  selectedAnswer: string;
}

export interface SubmitQuizResponse {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
  attemptNumber: number;
  quizResponse: QuizResponse;
  phaseAdvanced?: boolean; // True if user advanced to DISCIPLINE phase
}

export interface LearningStatsResponse {
  totalLessons: number;
  completedLessons: number;
  inProgressLessons: number;
  currentPhase: LessonPhase;
  currentDayNumber: number;
  totalTimeSpentMinutes: number;
  averageQuizScore: number;
  streak: number;
}
