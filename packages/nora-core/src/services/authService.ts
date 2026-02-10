import type { StorageAdapter } from '../adapters/storage';
import type {
  User,
  LoginResponse,
  SignupResponse,
  SignupRequest,
} from '../types';

/**
 * Authentication Service
 * Platform-agnostic authentication service that works with web and mobile
 */
class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private storage: StorageAdapter;
  private apiUrl: string;
  private onSessionExpired?: () => void;
  private onLogout?: () => void;

  constructor(storage: StorageAdapter, apiUrl: string) {
    this.storage = storage;
    this.apiUrl = apiUrl;
  }

  /**
   * Set callback for when session expires (refresh token fails)
   */
  setSessionExpiredCallback(callback: () => void): void {
    this.onSessionExpired = callback;
  }

  /**
   * Set callback for when user logs out
   */
  setLogoutCallback(callback: () => void): void {
    this.onLogout = callback;
  }

  /**
   * Initialize the service by loading tokens from storage
   */
  async initialize(): Promise<void> {
    this.accessToken = await this.storage.getItem('accessToken');
    this.refreshToken = await this.storage.getItem('refreshToken');
  }

  /**
   * Sign up a new user
   */
  async signup(request: SignupRequest): Promise<SignupResponse> {
    const response = await fetch(`${this.apiUrl}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true', // Skip ngrok warning page
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Signup failed');
    }

    const data: SignupResponse = await response.json();
    await this.setTokens(data.accessToken, data.refreshToken);
    return data;
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${this.apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true', // Skip ngrok warning page
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data: LoginResponse = await response.json();
    await this.setTokens(data.accessToken, data.refreshToken);
    return data;
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      if (this.refreshToken) {
        await fetch(`${this.apiUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true', // Skip ngrok warning page
          },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await this.clearTokens();
      await this.clearUserCache();
      // Notify listeners that logout occurred
      this.onLogout?.();
    }
  }

  /**
   * Delete user account permanently
   * This removes all user data from the system
   */
  async deleteAccount(): Promise<void> {
    const response = await fetch(`${this.apiUrl}/api/auth/delete-account`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Try to refresh token and retry
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          return this.deleteAccount();
        }
        throw new Error('Session expired. Please log in again.');
      }
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete account');
    }

    // Clear all local data after successful deletion
    await this.clearTokens();
    await this.clearUserCache();
  }

  /**
   * Request password reset email
   */
  async forgotPassword(email: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true', // Skip ngrok warning page
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send password reset email');
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true', // Skip ngrok warning page
      },
      body: JSON.stringify({ token, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reset password');
    }
  }

  /**
   * Get current user (with caching for better UX)
   * @param forceRefresh - If true, bypasses cache and fetches from API
   */
  async getCurrentUser(forceRefresh: boolean = false): Promise<User> {
    // Try to load from cache first (unless forced refresh)
    if (!forceRefresh) {
      const cachedUser = await this.getCachedUser();
      if (cachedUser) {
        console.log('[AuthService] Using cached user profile');
        // Refresh in background for next time
        this.refreshUserCache().catch(err =>
          console.log('[AuthService] Background user refresh failed:', err)
        );
        return cachedUser;
      }
    }

    // Fetch from API
    try {
      const response = await fetch(`${this.apiUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'ngrok-skip-browser-warning': 'true', // Skip ngrok warning page
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Try to refresh token
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            return this.getCurrentUser(forceRefresh);
          }
          throw new Error('Unauthorized');
        }
        throw new Error('Failed to get user');
      }

      const data = await response.json();
      const user = data.user;

      // Cache the user data
      await this.cacheUser(user);

      return user;
    } catch (error) {
      // If we hit a network error and have a cached user (even expired), use it
      const cachedUser = await this.storage.getItem('cachedUser');
      if (cachedUser) {
        console.log('[AuthService] Network error, using stale cache as fallback');
        try {
          const { user } = JSON.parse(cachedUser);
          return user;
        } catch (parseError) {
          // Cache corrupted, throw original error
          throw error;
        }
      }

      // No cache available, throw the error
      throw error;
    }
  }

  /**
   * Get cached user profile
   */
  private async getCachedUser(): Promise<User | null> {
    try {
      const cachedData = await this.storage.getItem('cachedUser');
      if (!cachedData) return null;

      const { user, cachedAt } = JSON.parse(cachedData);

      // Cache valid for 24 hours
      const cacheAge = Date.now() - cachedAt;
      const maxCacheAge = 24 * 60 * 60 * 1000; // 24 hours

      if (cacheAge > maxCacheAge) {
        console.log('[AuthService] Cache expired');
        return null;
      }

      return user;
    } catch (error) {
      console.error('[AuthService] Failed to load cached user:', error);
      return null;
    }
  }

  /**
   * Cache user profile
   */
  private async cacheUser(user: User): Promise<void> {
    try {
      const cacheData = {
        user,
        cachedAt: Date.now(),
      };
      await this.storage.setItem('cachedUser', JSON.stringify(cacheData));
      console.log('[AuthService] User profile cached');
    } catch (error) {
      console.error('[AuthService] Failed to cache user:', error);
    }
  }

  /**
   * Refresh user cache in background
   */
  private async refreshUserCache(): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'ngrok-skip-browser-warning': 'true', // Skip ngrok warning page
        },
      });

      if (response.ok) {
        const data = await response.json();
        await this.cacheUser(data.user);
        console.log('[AuthService] User cache refreshed in background');
      }
    } catch (error) {
      // Silently fail - this is a background operation
      console.log('[AuthService] Background cache refresh failed (ignored)');
    }
  }

  /**
   * Clear cached user data
   */
  async clearUserCache(): Promise<void> {
    try {
      await this.storage.removeItem('cachedUser');
    } catch (error) {
      console.error('[AuthService] Failed to clear user cache:', error);
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true', // Skip ngrok warning page
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) {
        // Only trigger session expired on actual auth failures (401/403)
        // Server errors (500+) might be temporary, don't logout
        const shouldExpireSession = response.status === 401 || response.status === 403;
        await this.clearTokens(shouldExpireSession);
        return false;
      }

      const data = await response.json();
      this.accessToken = data.accessToken;
      await this.storage.setItem('accessToken', data.accessToken);
      return true;
    } catch (error) {
      // Network errors don't mean the session is expired
      // The token might still be valid, just can't reach the server
      console.error('Token refresh error (network issue, keeping tokens):', error);
      // Don't clear tokens or trigger session expired on network errors
      return false;
    }
  }

  /**
   * Store tokens
   */
  private async setTokens(
    accessToken: string,
    refreshToken: string
  ): Promise<void> {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    await this.storage.setItem('accessToken', accessToken);
    await this.storage.setItem('refreshToken', refreshToken);
  }

  /**
   * Clear tokens
   * @param sessionExpired - If true, triggers session expired callback
   */
  private async clearTokens(sessionExpired: boolean = false): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    await this.storage.removeItem('accessToken');
    await this.storage.removeItem('refreshToken');

    // Also clear user cache when clearing tokens
    await this.clearUserCache();

    // Trigger session expired callback if this is due to token expiration
    if (sessionExpired && this.onSessionExpired) {
      this.onSessionExpired();
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  /**
   * Get access token for API calls
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Make authenticated API request with automatic token refresh
   */
  async authenticatedRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${this.accessToken}`,
      'ngrok-skip-browser-warning': 'true', // Skip ngrok warning page
    };

    let response = await fetch(url, { ...options, headers });

    // If unauthorized, try to refresh token and retry
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        headers.Authorization = `Bearer ${this.accessToken}`;
        response = await fetch(url, { ...options, headers });
      }
    }

    return response;
  }

  /**
   * Complete onboarding by updating user profile
   */
  async completeOnboarding(data: {
    name?: string;
    relationshipToChild?: 'MOTHER' | 'FATHER' | 'GRANDMOTHER' | 'GRANDFATHER' | 'GUARDIAN' | 'OTHER';
    childName?: string;
    childGender?: 'BOY' | 'GIRL' | 'OTHER';
    childBirthday?: Date;
    issue?: string | string[];
  }): Promise<User> {
    const response = await this.authenticatedRequest(
      `${this.apiUrl}/api/auth/complete-onboarding`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to complete onboarding');
    }

    const result = await response.json();
    return result.user;
  }
  async getChildIssues(): Promise<{ issues: Array<{ strategy: string; priorityRank: number; userIssues: string | null; clinicalLevel: string }> }> {
    const response = await this.authenticatedRequest(
      `${this.apiUrl}/api/auth/child-issues`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch child issues');
    }

    return await response.json();
  }
}

export default AuthService;
