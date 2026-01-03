import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import crashlytics from '@react-native-firebase/crashlytics';

export type ConnectionStatus = 'online' | 'offline';

/**
 * API Error class to preserve HTTP status codes and error codes
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly code?: string;

  constructor(message: string, status: number, statusText: string = '', code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.code = code;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

/**
 * Network connectivity monitor
 * Tracks online/offline state, server health, and provides utilities for handling network errors
 */
class NetworkMonitor {
  private isConnected: boolean = true;
  private listeners: Set<(connected: boolean) => void> = new Set();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    // Fetch initial state
    try {
      const state = await NetInfo.fetch();
      // Consider connected if isConnected is true
      // Ignore isInternetReachable being null (common in simulator)
      this.isConnected = state.isConnected ?? false;
      console.log(`[NetworkMonitor] Initial state: ${this.isConnected ? 'ONLINE' : 'OFFLINE'}`, {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });
    } catch (error) {
      console.error('[NetworkMonitor] Failed to fetch initial state:', error);
    }

    // Listen for changes
    this.unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasConnected = this.isConnected;
      // Consider connected if isConnected is true
      // Ignore isInternetReachable being null (common in simulator)
      this.isConnected = state.isConnected ?? false;

      console.log(`[NetworkMonitor] State update:`, {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });

      // Notify listeners only if state changed
      if (wasConnected !== this.isConnected) {
        console.log(`[NetworkMonitor] Connection state changed: ${this.isConnected ? 'ONLINE' : 'OFFLINE'}`);
        this.listeners.forEach(listener => listener(this.isConnected));

        // Also notify status listeners (for NetworkStatusBar)
        const currentStatus = this.getConnectionStatus();
        this.statusListeners.forEach(listener => listener(currentStatus));
      }
    });
  }

  /**
   * Get current connection status
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get current connection status (network only)
   */
  getConnectionStatus(): ConnectionStatus {
    return this.isConnected ? 'online' : 'offline';
  }

  /**
   * Add listener for connection state changes
   * @returns Unsubscribe function
   */
  addListener(callback: (connected: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Add listener for connection status changes
   * @returns Unsubscribe function
   */
  addStatusListener(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  /**
   * Get current network state details
   */
  async getNetworkState(): Promise<NetInfoState> {
    return await NetInfo.fetch();
  }

  /**
   * Clean up listeners
   */
  destroy() {
    this.unsubscribe?.();
    this.listeners.clear();
    this.statusListeners.clear();
  }
}

export const networkMonitor = new NetworkMonitor();

/**
 * Helper function to handle API errors with network awareness
 */
export function handleApiError(error: any): string {
  console.log('[handleApiError] Processing error:', {
    code: error.code,
    message: error.message,
    status: error.status,
    isConnected: networkMonitor.getIsConnected()
  });

  // Track API errors to Crashlytics (non-fatal)
  try {
    // Convert to Error if it's not already one
    const errorToTrack = error instanceof Error
      ? error
      : new Error(error.message || error.error || 'Unknown API error');

    // Add error details as attributes
    if (error.code) {
      crashlytics().setAttribute('error_code', error.code);
    }
    if (error.status) {
      crashlytics().setAttribute('http_status', String(error.status));
    }

    crashlytics().recordError(errorToTrack, 'API Error');
    crashlytics().log(`API Error: ${error.message || error.error} (status: ${error.status || 'N/A'}, code: ${error.code || 'N/A'})`);
  } catch (crashlyticsError) {
    console.error('[handleApiError] Failed to track error to Crashlytics:', crashlyticsError);
  }

  // Check network connectivity first
  if (!networkMonitor.getIsConnected()) {
    console.log('[handleApiError] Network is offline');
    return 'No internet connection. Please check your network and try again.';
  }

  // Check for specific error types
  if (error.code === 'ECONNABORTED') {
    return 'Request timed out. Please check your connection and try again.';
  }

  if (error.name === 'TypeError') {
    return 'Unable to connect to server. Please check your connection and try again.';
  }

  // Check for specific HTTP status codes
  if (error.status) {
    if (error.status === 503) {
      return 'Service temporarily unavailable. Please try again later.';
    }
    if (error.status === 502 || error.status === 504) {
      return 'Server connection issue. Please try again.';
    }
    if (error.status >= 500) {
      return 'Server error. Please try again later.';
    }
  }

  // Return API error message if available
  if (error.userMessage) {
    return error.userMessage;
  }

  // Check for specific error codes from backend
  if (error.code) {
    switch (error.code) {
      case 'VALIDATION_ERROR':
        return error.message || 'Please check your input and try again.';
      case 'UNAUTHORIZED':
        return 'Please log in to continue.';
      case 'FORBIDDEN':
        return 'You don\'t have permission to perform this action.';
      case 'NOT_FOUND':
        return error.message || 'The requested resource was not found.';
      case 'CONFLICT':
        return error.message || 'This action conflicts with existing data.';
      case 'SERVICE_UNAVAILABLE':
        return 'This service is temporarily unavailable. Please try again later.';
      case 'UPLOAD_ERROR':
        return error.message || 'Upload failed. Please try again.';
      case 'PROCESSING_ERROR':
        return error.message || 'Processing failed. Please try again.';
      default:
        return error.message || 'Something went wrong. Please try again.';
    }
  }

  // Fallback to generic error message
  return error.message || 'Something went wrong. Please try again.';
}

/**
 * Helper function to call when API requests succeed
 * No-op - kept for backward compatibility
 */
export function handleApiSuccess(): void {
  // No longer tracking server status - network connectivity is sufficient
}
