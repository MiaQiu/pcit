import type { StorageAdapter } from '../adapters/storage';
import type { LoginResponse, User } from '../types';

export interface SocialAuthProvider {
  name: 'google' | 'facebook' | 'apple';
  idToken: string;
  accessToken?: string;
  email?: string;
  userName?: string;
}

/**
 * Social Authentication Service
 * Handles OAuth login with Google, Facebook, and Apple
 */
class SocialAuthService {
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
   * Authenticate with social provider
   */
  async authenticateWithProvider(
    provider: SocialAuthProvider
  ): Promise<LoginResponse> {
    const response = await fetch(`${this.apiUrl}/api/auth/social`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(provider),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Social authentication failed');
    }

    const data: LoginResponse = await response.json();
    await this.setTokens(data.accessToken, data.refreshToken);
    return data;
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
   * Get access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }
}

export default SocialAuthService;
