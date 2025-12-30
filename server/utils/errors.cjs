/**
 * Custom error classes for consistent error handling across the application
 *
 * Usage:
 *   throw new ValidationError('Email is required');
 *   throw new UnauthorizedError('Invalid token', 'Please log in again');
 *   throw new ConflictError('Email exists', 'This email is already registered');
 */

class AppError extends Error {
  /**
   * Base application error class
   * @param {string} message - Internal error message (for logs)
   * @param {number} statusCode - HTTP status code
   * @param {string} code - Error code for client-side handling
   * @param {string} userMessage - User-friendly message (optional, defaults to message)
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', userMessage = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.userMessage = userMessage || message;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  /**
   * 400 - Validation error (bad request)
   * @param {string} message - Error message
   * @param {Array} details - Optional array of validation errors
   */
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', message);
    this.details = details;
  }
}

class UnauthorizedError extends AppError {
  /**
   * 401 - Unauthorized (authentication required)
   * @param {string} message - Internal message
   * @param {string} userMessage - User-facing message
   */
  constructor(message = 'Unauthorized', userMessage = 'Please log in to continue') {
    super(message, 401, 'UNAUTHORIZED', userMessage);
  }
}

class ForbiddenError extends AppError {
  /**
   * 403 - Forbidden (insufficient permissions)
   * @param {string} message - Internal message
   * @param {string} userMessage - User-facing message
   */
  constructor(message = 'Access denied', userMessage = 'You don\'t have permission to access this resource') {
    super(message, 403, 'FORBIDDEN', userMessage);
  }
}

class NotFoundError extends AppError {
  /**
   * 404 - Resource not found
   * @param {string} resource - Name of resource (e.g., 'Recording', 'User')
   * @param {string} userMessage - Optional custom user message
   */
  constructor(resource = 'Resource', userMessage = null) {
    super(
      `${resource} not found`,
      404,
      'NOT_FOUND',
      userMessage || `${resource} not found`
    );
  }
}

class ConflictError extends AppError {
  /**
   * 409 - Conflict (resource already exists)
   * @param {string} message - Internal message
   * @param {string} userMessage - Optional user-facing message
   */
  constructor(message, userMessage = null) {
    super(message, 409, 'CONFLICT', userMessage || message);
  }
}

class ServiceUnavailableError extends AppError {
  /**
   * 503 - Service unavailable
   * @param {string} service - Name of unavailable service
   * @param {string} userMessage - Optional user-facing message
   */
  constructor(service, userMessage = 'This service is temporarily unavailable') {
    super(`${service} service not available`, 503, 'SERVICE_UNAVAILABLE', userMessage);
  }
}

class UploadError extends AppError {
  /**
   * 400 - Upload error
   * @param {string} message - Internal message
   * @param {string} userMessage - User-facing message
   */
  constructor(message, userMessage = 'Failed to upload file. Please try again.') {
    super(message, 400, 'UPLOAD_ERROR', userMessage);
  }
}

class ProcessingError extends AppError {
  /**
   * 500 - Processing error (transcription, analysis, etc.)
   * @param {string} message - Internal message
   * @param {string} userMessage - User-facing message
   */
  constructor(message, userMessage = 'Processing failed. Please try again.') {
    super(message, 500, 'PROCESSING_ERROR', userMessage);
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ServiceUnavailableError,
  UploadError,
  ProcessingError
};
