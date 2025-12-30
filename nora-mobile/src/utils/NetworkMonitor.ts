import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

/**
 * Network connectivity monitor
 * Tracks online/offline state and provides utilities for handling network errors
 */
class NetworkMonitor {
  private isConnected: boolean = true;
  private listeners: Set<(connected: boolean) => void> = new Set();
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.init();
  }

  private init() {
    this.unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasConnected = this.isConnected;
      this.isConnected = state.isConnected ?? false;

      // Notify listeners only if state changed
      if (wasConnected !== this.isConnected) {
        console.log(`[NetworkMonitor] Connection state changed: ${this.isConnected ? 'ONLINE' : 'OFFLINE'}`);
        this.listeners.forEach(listener => listener(this.isConnected));
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
   * Add listener for connection state changes
   * @returns Unsubscribe function
   */
  addListener(callback: (connected: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
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
  }
}

export const networkMonitor = new NetworkMonitor();

/**
 * Helper function to handle API errors with network awareness
 */
export function handleApiError(error: any): string {
  // Check network connectivity first
  if (!networkMonitor.getIsConnected()) {
    return 'No internet connection. Please check your network and try again.';
  }

  // Check for timeout errors
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return 'Request timed out. Please check your connection and try again.';
  }

  // Check for network errors
  if (error.code === 'NETWORK_ERROR' || error.message?.toLowerCase().includes('network')) {
    return 'Network error. Please check your connection and try again.';
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
