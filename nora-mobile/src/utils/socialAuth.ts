/**
 * Social Authentication Utilities
 * Handles Google, Facebook, and Apple Sign-In for React Native
 */

import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as AuthSession from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import type { SocialAuthProvider } from '@nora/core';

// Google Sign-In
export const useGoogleAuth = () => {
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
  });

  const signIn = async (): Promise<SocialAuthProvider | null> => {
    try {
      const result = await promptAsync();

      if (result.type === 'success') {
        // Auto token exchange succeeded
        if (result.authentication?.idToken || result.authentication?.accessToken) {
          return {
            name: 'google',
            idToken: result.authentication.idToken || '',
            accessToken: result.authentication.accessToken,
          };
        }

        // Auto exchange failed — manually exchange the authorization code
        const params = (result as any).params || {};
        if (params.code && request?.codeVerifier) {
          const body = new URLSearchParams({
            code: params.code,
            client_id: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
            code_verifier: request.codeVerifier,
            redirect_uri: request.redirectUri,
            grant_type: 'authorization_code',
          });

          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
          });

          const tokens = await tokenRes.json();

          if (tokens.id_token || tokens.access_token) {
            return {
              name: 'google',
              idToken: tokens.id_token || '',
              accessToken: tokens.access_token,
            };
          }

          throw new Error(`Token exchange failed: ${tokens.error_description || tokens.error || JSON.stringify(tokens)}`);
        }

        throw new Error('Auth succeeded but missing code or codeVerifier');
      }

      if (result.type === 'error') {
        throw new Error(`Google auth error: ${(result as any).error?.message || JSON.stringify((result as any).error)}`);
      }

      return null;
    } catch (error) {
      console.error('Google sign in error:', error);
      throw error;
    }
  };

  return { signIn, request };
};

// Facebook Sign-In
export const useFacebookAuth = () => {
  // Facebook requires an HTTPS redirect URI — use Expo's auth proxy
  const redirectUri = 'https://auth.expo.io/@chromamind/nora-mobile';

  const [request, response, promptAsync] = Facebook.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || '',
    redirectUri,
  });

  const signIn = async (): Promise<SocialAuthProvider | null> => {
    try {
      console.log('[Facebook] App ID:', process.env.EXPO_PUBLIC_FACEBOOK_APP_ID);
      console.log('[Facebook] Redirect URI:', redirectUri);

      const result = await promptAsync();

      console.log('[Facebook] Auth result:', JSON.stringify(result, null, 2));

      if (result.type === 'success') {
        // Implicit flow puts the token in params; code flow puts it in authentication
        const accessToken =
          result.authentication?.accessToken ||
          (result as any).params?.access_token;

        console.log('[Facebook] Access token obtained:', !!accessToken);

        if (accessToken) {
          return {
            name: 'facebook',
            idToken: accessToken,
            accessToken,
          };
        }
      }
      return null;
    } catch (error) {
      console.error('[Facebook] Sign in error:', error);
      throw new Error('Failed to sign in with Facebook');
    }
  };

  return { signIn, request };
};

// Apple Sign-In
export const signInWithApple = async (): Promise<SocialAuthProvider | null> => {
  try {
    // Check if Apple Auth is available (iOS 13+)
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Apple Authentication is not available on this device');
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    // Build full name from Apple's separate fields
    let fullName: string | undefined;
    if (credential.fullName) {
      const parts = [
        credential.fullName.givenName,
        credential.fullName.familyName,
      ].filter(Boolean);
      if (parts.length > 0) {
        fullName = parts.join(' ');
      }
    }

    return {
      name: 'apple',
      idToken: credential.identityToken || '',
      email: credential.email || undefined,
      userName: fullName,
    };
  } catch (error: any) {
    if (error.code === 'ERR_CANCELED') {
      // User cancelled, don't show error
      return null;
    }
    console.error('Apple sign in error:', error);
    throw new Error('Failed to sign in with Apple');
  }
};

// Check if Apple Sign-In is available
export const isAppleSignInAvailable = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    return false;
  }
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
};
