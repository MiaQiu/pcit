/**
 * Centralized user-facing error messages
 * Provides consistent, helpful error messages throughout the app
 */

export const ErrorMessages = {
  // Authentication
  AUTH: {
    LOGIN_FAILED: 'Incorrect email or password. Please try again.',
    SIGNUP_FAILED: 'Failed to create account. Please try again.',
    EMAIL_EXISTS: 'This email is already registered. Please log in or use a different email.',
    INVALID_EMAIL: 'Please enter a valid email address.',
    WEAK_PASSWORD: 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number.',
    PASSWORDS_DONT_MATCH: 'Passwords do not match. Please try again.',
    SESSION_EXPIRED: 'Your session has expired. Please log in again.',
    UNAUTHORIZED: 'Please log in to continue.',
  },

  // Network
  NETWORK: {
    NO_CONNECTION: 'No internet connection. Please check your network and try again.',
    TIMEOUT: 'Request timed out. Please check your connection and try again.',
    GENERIC: 'Network error. Please check your connection and try again.',
  },

  // Recording & Upload
  RECORDING: {
    START_FAILED: 'Failed to start recording. Please check microphone permissions and try again.',
    STOP_FAILED: 'Failed to stop recording. Please try again.',
    UPLOAD_FAILED: 'Upload failed. Please check your connection and try again.',
    FILE_TOO_LARGE: 'Recording is too large. Please try a shorter recording (max 50MB).',
    NO_PERMISSION: 'Microphone permission is required to record. Please enable it in Settings.',
  },

  // Processing
  PROCESSING: {
    FAILED: 'It looks like something went wrong. Please try recording again.',
    IN_PROGRESS: 'Your recording is being processed. This usually takes 1-2 minutes.',
    RETRY_IN_PROGRESS: 'We encountered a temporary issue. Automatically retrying...',
    TIMEOUT: 'Processing is taking longer than usual. Your recording will appear on your home screen when ready.',
  },

  // Generic
  GENERIC: {
    UNKNOWN: 'Something went wrong. Please try again.',
    SERVER_ERROR: 'We\'re experiencing technical difficulties. Please try again in a few moments.',
    NOT_FOUND: 'The requested resource was not found.',
    FORBIDDEN: 'You don\'t have permission to access this resource.',
  },

  // Lessons
  LESSONS: {
    LOAD_FAILED: 'Failed to load lessons. Please try again.',
    NOT_FOUND: 'This lesson is not available. It may have been updated.',
  },
};

/**
 * Get user-friendly error message from API error
 */
export function getErrorMessage(error: any, fallback?: string): string {
  if (!error) {
    return fallback || ErrorMessages.GENERIC.UNKNOWN;
  }

  // Use userMessage if available (from backend)
  if (error.userMessage) {
    return error.userMessage;
  }

  // Map error codes to messages
  if (error.code) {
    switch (error.code) {
      case 'UNAUTHORIZED':
        return ErrorMessages.AUTH.UNAUTHORIZED;
      case 'FORBIDDEN':
        return ErrorMessages.GENERIC.FORBIDDEN;
      case 'NOT_FOUND':
        return error.message || ErrorMessages.GENERIC.NOT_FOUND;
      case 'VALIDATION_ERROR':
        return error.message || 'Please check your input and try again.';
      case 'CONFLICT':
        return error.message || ErrorMessages.AUTH.EMAIL_EXISTS;
      case 'UPLOAD_ERROR':
        return error.message || ErrorMessages.RECORDING.UPLOAD_FAILED;
      case 'PROCESSING_ERROR':
        return error.message || ErrorMessages.PROCESSING.FAILED;
      case 'SERVICE_UNAVAILABLE':
        return 'This service is temporarily unavailable. Please try again later.';
      default:
        break;
    }
  }

  // Fallback to error message or default
  return error.message || fallback || ErrorMessages.GENERIC.UNKNOWN;
}
