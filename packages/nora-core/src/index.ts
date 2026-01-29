/**
 * @nora/core
 * Shared business logic and services for Nora web and mobile apps
 */

// Export types
export * from './types';

// Export errors
export { ApiError } from './errors/ApiError';

// Export adapters
export { StorageAdapter, WebStorageAdapter } from './adapters/storage';

// Export services
export { default as AuthService } from './services/authService';
export { default as SocialAuthService, type SocialAuthProvider } from './services/socialAuthService';
export { default as SessionService } from './services/sessionService';
export { default as PCITService } from './services/pcitService';
export { default as TranscriptionService } from './services/transcriptionService';
export { default as LessonService, LessonNotFoundError } from './services/lessonService';
export { default as RecordingService } from './services/recordingService';
export {
  default as AmplitudeService,
  type IAmplitudeService,
  type AmplitudeConfig,
  type UserProperties,
  type EventProperties,
} from './services/amplitudeService';

// Export utilities
export { fetchWithTimeout } from './utils/fetchWithTimeout';

// Export session-related types
export type { SessionUploadData, SessionListOptions } from './services/sessionService';

// Export recording-related types
export type { RecordingAnalysis, StructuredTips, CoachInsight, CoachInsightAnalysis, CoachInsightExample, ChildPortfolioInsights, AboutChildItem } from './services/recordingService';
