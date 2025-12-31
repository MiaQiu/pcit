/**
 * API Error
 * Standard error class for HTTP API errors
 * Preserves HTTP status code for proper error handling
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly code?: string;

  constructor(
    message: string,
    status: number,
    statusText: string = '',
    code?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.code = code;

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Check if this is a client error (4xx)
   */
  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /**
   * Check if this is a server error (5xx)
   */
  isServerError(): boolean {
    return this.status >= 500;
  }

  /**
   * Check if this is a network error (no response)
   */
  static isNetworkError(error: any): boolean {
    return (
      error.name === 'TypeError' &&
      error.message?.toLowerCase().includes('failed to fetch')
    );
  }
}
