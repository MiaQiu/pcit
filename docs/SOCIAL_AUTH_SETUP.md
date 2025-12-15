# Social Authentication Setup Guide

This guide explains how to configure Google, Facebook, and Apple Sign-In for the Nora mobile app.

## Overview

The app now supports three social login providers:
- **Google Sign-In**
- **Facebook Login**
- **Apple Sign-In** (iOS only)

## Configuration Required

### 1. Google Sign-In Setup

#### Get Google OAuth Credentials:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Create credentials for:
   - **iOS** (bundle identifier: `com.nora.app`)
   - **Android** (package name and SHA-1 fingerprint)
   - **Web** (for Expo Go development)

#### Add to `.env`:
```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
```

#### Add to `nora-mobile/.env`:
```bash
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-expo-client-id
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

### 2. Facebook Login Setup

#### Create Facebook App:
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app
3. Add "Facebook Login" product
4. Configure OAuth redirect URIs for your app
5. Get your App ID

#### Add to `nora-mobile/.env`:
```bash
EXPO_PUBLIC_FACEBOOK_APP_ID=your-facebook-app-id
```

#### Update `app.json`:
```json
{
  "expo": {
    "facebookScheme": "fb{YOUR_FACEBOOK_APP_ID}",
    "facebookAppId": "YOUR_FACEBOOK_APP_ID",
    "facebookDisplayName": "Nora"
  }
}
```

### 3. Apple Sign-In Setup

#### Configure Apple Developer Account:
1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Create an App ID with "Sign in with Apple" capability
3. Create a Service ID for web authentication (optional)
4. No additional configuration needed for native iOS app

#### Requirements:
- Only works on iOS 13+ devices
- Requires paid Apple Developer account
- Automatically configured when building with EAS

## Implementation Details

### Frontend (Mobile)

The SignupOptionsScreen (`nora-mobile/src/screens/onboarding/SignupOptionsScreen.tsx`) handles all social auth flows:

```typescript
// Google
const { signIn: signInWithGoogle } = useGoogleAuth();
await signInWithGoogle();

// Facebook
const { signIn: signInWithFacebook } = useFacebookAuth();
await signInWithFacebook();

// Apple
await signInWithApple();
```

### Backend (API)

The social auth endpoint (`server/routes/social-auth.cjs`) handles token verification and user creation:

```
POST /api/auth/social
{
  "name": "google" | "facebook" | "apple",
  "idToken": "token-from-provider",
  "email": "user@example.com" (for Facebook/Apple),
  "userName": "User Name" (optional)
}
```

### User Flow

1. User taps social login button
2. OAuth flow opens in browser/native modal
3. User authorizes app
4. App receives ID token
5. App sends token to backend
6. Backend verifies token with provider
7. Backend creates/finds user account
8. Backend returns JWT tokens
9. App stores tokens and navigates to home

### New User Creation

When a user signs in with a social provider for the first time:
- Email is encrypted and stored
- A unique user account is created
- Placeholder values are set for child info
- User is prompted to complete onboarding

## Testing

### Development Mode:
- Use Expo Go app for quick testing
- Google/Facebook work in Expo Go
- Apple Sign-In requires native build (won't work in Expo Go)

### Production Mode:
```bash
# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## Security Notes

1. **Token Verification**: Google tokens are verified server-side. Facebook and Apple tokens should also be verified in production.
2. **HTTPS Required**: Social auth requires HTTPS in production
3. **Redirect URIs**: Must match exactly in provider configuration
4. **Secrets**: Never commit OAuth secrets to git

## Troubleshooting

### Google Sign-In Issues:
- Verify client IDs match platform (iOS/Android/Web)
- Check bundle identifier / package name
- Ensure Google+ API is enabled

### Facebook Login Issues:
- Verify App ID in app.json
- Check OAuth redirect URIs
- Ensure app is not in development mode

### Apple Sign-In Issues:
- Only works on physical iOS devices (iOS 13+)
- Requires native build (not Expo Go)
- Check App ID capabilities in Apple Developer Portal

## Next Steps

1. Set up OAuth credentials for each provider
2. Add environment variables
3. Test each flow in development
4. Build native app for production testing
5. Verify token verification in production
