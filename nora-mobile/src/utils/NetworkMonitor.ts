import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export type ConnectionStatus = 'online' | 'offline' | 'server_down';

/**
 * Network connectivity monitor
 * Tracks online/offline state, server health, and provides utilities for handling network errors
 */
class NetworkMonitor {
  private isConnected: boolean = true;
  private serverStatus: 'up' | 'down' = 'up';
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
   * Get current connection status (network + server)
   */
  getConnectionStatus(): ConnectionStatus {
    if (!this.isConnected) {
      return 'offline';
    }
    if (this.serverStatus === 'down') {
      return 'server_down';
    }
    return 'online';
  }

  /**
   * Update server status (call this when API requests fail/succeed)
   */
  setServerStatus(status: 'up' | 'down') {
    const wasDown = this.serverStatus === 'down';
    this.serverStatus = status;

    // Notify status listeners if server status changed
    if ((status === 'down' && !wasDown) || (status === 'up' && wasDown)) {
      console.log(`[NetworkMonitor] Server status changed: ${status.toUpperCase()}`);
      const currentStatus = this.getConnectionStatus();
      this.statusListeners.forEach(listener => listener(currentStatus));
    }
  }

  /**
   * Add listener for connection state changes (legacy - network only)
   * @returns Unsubscribe function
   */
  addListener(callback: (connected: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Add listener for full connection status changes (network + server)
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
  // Check network connectivity first
  if (!networkMonitor.getIsConnected()) {
    return 'No internet connection. Please check your network and try again.';
  }

  // Check for server errors and update server status
  const isServerError =
    error.code === 'ECONNABORTED' ||
    error.code === 'ECONNREFUSED' ||
    error.code === 'SERVICE_UNAVAILABLE' ||
    error.message?.includes('timeout') ||
    error.message?.toLowerCase().includes('network') ||
    error.message?.toLowerCase().includes('server') ||
    (error.status && error.status >= 500);

  if (isServerError) {
    networkMonitor.setServerStatus('down');
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

/**
 * Helper function to call when API requests succeed
 * This marks the server as up and clears any server error status
 */
export function handleApiSuccess(): void {
  networkMonitor.setServerStatus('up');
}
