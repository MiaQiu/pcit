/**
 * Social Authentication Utilities
 * Handles Google, Facebook, and Apple Sign-In for React Native
 */

import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import type { SocialAuthProvider } from '@nora/core';

// Google Sign-In
export const useGoogleAuth = () => {
  const redirectUri = 'https://auth.expo.io/@anonymous/nora-mobile';

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
    redirectUri: redirectUri,
  });

  const signIn = async (): Promise<SocialAuthProvider | null> => {
    try {
      const result = await promptAsync();

      if (result.type === 'success' && result.authentication) {
        return {
          name: 'google',
          idToken: result.authentication.idToken || '',
          accessToken: result.authentication.accessToken,
        };
      }
      return null;
    } catch (error) {
      console.error('Google sign in error:', error);
      throw new Error('Failed to sign in with Google');
    }
  };

  return { signIn, request };
};

// Facebook Sign-In
export const useFacebookAuth = () => {
  const [request, response, promptAsync] = Facebook.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || '',
  });

  const signIn = async (): Promise<SocialAuthProvider | null> => {
    try {
      const result = await promptAsync();

      if (result.type === 'success' && result.authentication) {
        return {
          name: 'facebook',
          idToken: result.authentication.accessToken || '',
          accessToken: result.authentication.accessToken,
        };
      }
      return null;
    } catch (error) {
      console.error('Facebook sign in error:', error);
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
