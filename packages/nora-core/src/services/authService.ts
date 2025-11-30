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

  constructor(storage: StorageAdapter, apiUrl: string) {
    this.storage = storage;
    this.apiUrl = apiUrl;
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
          },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await this.clearTokens();
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User> {
    const response = await fetch(`${this.apiUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Try to refresh token
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          return this.getCurrentUser();
        }
        throw new Error('Unauthorized');
      }
      throw new Error('Failed to get user');
    }

    const data = await response.json();
    return data.user;
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
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) {
        await this.clearTokens();
        return false;
      }

      const data = await response.json();
      this.accessToken = data.accessToken;
      await this.storage.setItem('accessToken', data.accessToken);
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      await this.clearTokens();
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
   */
  private async clearTokens(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    await this.storage.removeItem('accessToken');
    await this.storage.removeItem('refreshToken');
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
}

export default AuthService;
