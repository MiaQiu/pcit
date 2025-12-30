# Error Handling Implementation Plan

**Status:** DRAFT - Awaiting Review
**Created:** 2025-12-29
**Estimated Total Effort:** 3-4 days

---

## Overview

This plan improves error handling across the Nora app by:
1. Standardizing backend error responses
2. Adding global error handling middleware
3. Improving user-facing error messages
4. Adding network connectivity detection
5. Implementing error monitoring

---

## Phase 1: Foundation (High Priority)

**Goal:** Standardize error handling infrastructure
**Estimated Effort:** 1.5 days
**Risk:** Medium (touches many critical files)

### 1.1 Create Custom Error Classes

**File:** `server/utils/errors.cjs` (NEW)

**Implementation:**
```javascript
/**
 * Custom error classes for consistent error handling
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', userMessage = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.userMessage = userMessage || message;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', message);
    this.details = details;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', userMessage = 'Please log in to continue') {
    super(message, 401, 'UNAUTHORIZED', userMessage);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access denied', userMessage = 'You don\'t have permission to access this resource') {
    super(message, 403, 'FORBIDDEN', userMessage);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource', userMessage = null) {
    super(
      `${resource} not found`,
      404,
      'NOT_FOUND',
      userMessage || `${resource} not found`
    );
  }
}

class ConflictError extends AppError {
  constructor(message, userMessage = null) {
    super(message, 409, 'CONFLICT', userMessage || message);
  }
}

class ServiceUnavailableError extends AppError {
  constructor(service, userMessage = 'This service is temporarily unavailable') {
    super(`${service} service not available`, 503, 'SERVICE_UNAVAILABLE', userMessage);
  }
}

class UploadError extends AppError {
  constructor(message, userMessage = 'Failed to upload file. Please try again.') {
    super(message, 400, 'UPLOAD_ERROR', userMessage);
  }
}

class ProcessingError extends AppError {
  constructor(message, userMessage = 'Processing failed. Please try again.') {
    super(message, 500, 'PROCESSING_ERROR', userMessage);
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ServiceUnavailableError,
  UploadError,
  ProcessingError
};
```

**Testing:**
- Unit tests for each error class
- Verify inheritance chain
- Check serialization for logging

---

### 1.2 Add Global Error Handler

**File:** `server/server.cjs`

**Location:** After all routes (around line 382, before `server.listen`)

**Implementation:**
```javascript
// ============================================
// GLOBAL ERROR HANDLING MIDDLEWARE
// ============================================

// 404 handler - must come before error handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.path
  });
});

// Global error handler - must be last
app.use((err, req, res, next) => {
  // Log error with full context
  console.error('[ERROR]', {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    error: err.message,
    code: err.code || 'INTERNAL_ERROR',
    statusCode: err.statusCode || 500,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  // TODO Phase 3: Send to error monitoring service (Sentry)
  // if (process.env.SENTRY_DSN) {
  //   Sentry.captureException(err);
  // }

  // Determine status code
  const statusCode = err.statusCode || 500;

  // Build error response
  const errorResponse = {
    error: err.userMessage || 'An unexpected error occurred',
    code: err.code || 'INTERNAL_ERROR'
  };

  // Add details in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = err.message;
    errorResponse.stack = err.stack;
  }

  // Add validation details if present
  if (err.details) {
    errorResponse.validationErrors = err.details;
  }

  res.status(statusCode).json(errorResponse);
});
```

**Changes Required:**
1. Import error classes at top of file
2. Add middleware after all routes
3. Remove or update any existing error handlers

**Testing:**
- Test 404 responses
- Test various error types (400, 401, 403, 404, 500)
- Verify error logging format
- Check development vs production responses

---

### 1.3 Update Authentication Middleware

**File:** `server/middleware/auth.cjs`

**Changes:**
```javascript
// Add import at top
const { UnauthorizedError, AppError } = require('../utils/errors.cjs');

// Line 10-11: Replace
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return res.status(401).json({ error: 'No token provided' });
}
// With:
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  throw new UnauthorizedError('No token provided', 'Please log in to continue');
}

// Line 18-19: Replace
if (!payload) {
  return res.status(401).json({ error: 'Invalid or expired token' });
}
// With:
if (!payload) {
  throw new UnauthorizedError('Invalid or expired token', 'Your session has expired. Please log in again.');
}

// Line 28-30: Replace
return res.status(500).json({ error: 'Authentication error' });
// With:
throw new AppError('Authentication middleware error', 500, 'AUTH_ERROR', 'Authentication failed. Please try again.');
```

**Testing:**
- Test with missing token
- Test with invalid token
- Test with expired token
- Verify error response format

---

### 1.4 Update Auth Routes

**File:** `server/routes/auth.cjs`

**Import at top:**
```javascript
const {
  ValidationError,
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  AppError
} = require('../utils/errors.cjs');
```

**Changes:**

**Signup Route (line 68-70):**
```javascript
// Replace:
if (error) {
  return res.status(400).json({ error: error.details[0].message });
}
// With:
if (error) {
  const errors = error.details.map(d => d.message);
  throw new ValidationError(errors[0], errors);
}
```

**Email exists check (line 82-84):**
```javascript
// Replace:
if (existingUser) {
  return res.status(409).json({ error: 'Email already registered' });
}
// With:
if (existingUser) {
  throw new ConflictError(
    'Email already exists in database',
    'This email is already registered. Please log in or use a different email.'
  );
}
```

**Signup error handler (line 163-165):**
```javascript
// Replace:
res.status(500).json({ error: 'Failed to create account' });
// With:
throw new AppError(
  `Signup error: ${error.message}`,
  500,
  'SIGNUP_ERROR',
  'Failed to create account. Please try again or contact support.'
);
```

**Login validation (line 197-199):**
```javascript
// Replace:
if (error) {
  return res.status(400).json({ error: error.details[0].message });
}
// With:
if (error) {
  throw new ValidationError(error.details[0].message);
}
```

**Login - user not found (line 211-213):**
```javascript
// Replace:
if (!user) {
  return res.status(401).json({ error: 'Invalid credentials' });
}
// With:
if (!user) {
  throw new UnauthorizedError(
    'User not found',
    'Incorrect email or password. Please try again.'
  );
}
```

**Login - password mismatch (line 220-222):**
```javascript
// Replace:
if (!isPasswordValid) {
  return res.status(401).json({ error: 'Invalid credentials' });
}
// With:
if (!isPasswordValid) {
  throw new UnauthorizedError(
    'Invalid password',
    'Incorrect email or password. Please try again.'
  );
}
```

**Login error handler (line 243-245):**
```javascript
// Replace:
res.status(500).json({ error: 'Login failed' });
// With:
throw new AppError(
  `Login error: ${error.message}`,
  500,
  'LOGIN_ERROR',
  'Login failed. Please try again.'
);
```

**Password reset - user not found (line 291-294):**
```javascript
// Keep as-is for security (don't reveal if email exists)
if (!user) {
  return res.json({
    message: 'If an account exists with this email, a password reset link has been sent.'
  });
}
```

**Password reset error (line 361-363):**
```javascript
// Replace:
res.status(500).json({ error: 'Failed to process password reset request' });
// With:
throw new AppError(
  `Password reset error: ${error.message}`,
  500,
  'PASSWORD_RESET_ERROR',
  'Failed to process password reset request. Please try again.'
);
```

**Reset password - invalid token (line 388-390):**
```javascript
// Replace:
if (!user || !user.resetToken || !user.resetTokenExpiry) {
  return res.status(400).json({ error: 'Invalid or expired reset token' });
}
// With:
if (!user || !user.resetToken || !user.resetTokenExpiry) {
  throw new ValidationError(
    'Invalid reset token',
    'This password reset link is invalid or has expired. Please request a new one.'
  );
}
```

**Similar changes for:**
- Refresh token endpoint
- Logout endpoint
- All other validation and error scenarios

**Testing:**
- Test all validation scenarios
- Test duplicate email signup
- Test invalid login credentials
- Test password reset flow
- Verify error response format matches new standard

---

### 1.5 Update Recording Routes

**File:** `server/routes/recordings.cjs`

**Import at top:**
```javascript
const {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  UploadError,
  ProcessingError,
  AppError
} = require('../utils/errors.cjs');
```

**Changes:**

**No file provided (line 1258-1262):**
```javascript
// Replace:
if (!req.file) {
  return res.status(400).json({
    error: 'No audio file provided',
    details: 'Please include an audio file in the "audio" field'
  });
}
// With:
if (!req.file) {
  throw new UploadError(
    'No audio file in request',
    'No audio file provided. Please select a recording to upload.'
  );
}
```

**File size limit (line 1356-1361):**
```javascript
// Replace:
if (error.code === 'LIMIT_FILE_SIZE') {
  return res.status(400).json({
    error: 'File too large',
    details: 'Audio file must be less than 50MB'
  });
}
// With:
if (error.code === 'LIMIT_FILE_SIZE') {
  throw new UploadError(
    'File exceeds size limit',
    'Audio file must be less than 50MB. Please try a shorter recording.'
  );
}
```

**Recording not found (line ~1400):**
```javascript
// Replace:
if (!session) {
  return res.status(404).json({ error: 'Recording not found' });
}
// With:
if (!session) {
  throw new NotFoundError('Recording');
}
```

**Access denied (line ~1410):**
```javascript
// Replace:
if (session.userId !== req.user.id) {
  return res.status(403).json({ error: 'Access denied' });
}
// With:
if (session.userId !== req.user.id) {
  throw new ForbiddenError(
    'User does not own this recording',
    'You don\'t have permission to access this recording.'
  );
}
```

**S3 upload error (line ~1320):**
```javascript
// Replace:
throw new Error('Failed to upload audio file');
// With:
throw new UploadError(
  `S3 upload failed: ${error.message}`,
  'Failed to upload audio file. Please check your connection and try again.'
);
```

**Transcription error (line 256-259):**
```javascript
// Replace:
catch (transcriptionError) {
  console.error(`❌ [TRANSCRIBE-ERROR] Session ${sessionId.substring(0, 8)} - Transcription error:`, transcriptionError);
  throw new Error(`Transcription failed: ${transcriptionError.message}`);
}
// With:
catch (transcriptionError) {
  console.error(`❌ [TRANSCRIBE-ERROR] Session ${sessionId.substring(0, 8)} - Transcription error:`, transcriptionError);
  throw new ProcessingError(
    `Transcription failed: ${transcriptionError.message}`,
    'Failed to transcribe audio. Please try recording again with clearer audio.'
  );
}
```

**Analysis failed status (line 1449-1457):**
```javascript
// Keep as-is (already returns good user message)
// But standardize format:
if (session.analysisStatus === 'FAILED') {
  throw new ProcessingError(
    session.analysisError || 'Analysis failed',
    session.analysisError || 'An error occurred while analyzing your recording. Please try recording again.'
  );
}
```

**Similar changes for:**
- All other validation checks
- Database errors
- External API errors

**Testing:**
- Test upload with no file
- Test file size limit
- Test upload flow end-to-end
- Test accessing another user's recording
- Test analysis failure scenarios

---

### 1.6 Update Transcription Proxy Routes

**File:** `server/routes/transcription-proxy.cjs`

**Import at top:**
```javascript
const { ServiceUnavailableError, ProcessingError } = require('../utils/errors.cjs');
```

**Changes:**

**API key not configured (line 38-40):**
```javascript
// Replace:
if (!API_KEYS.elevenLabs) {
  return res.status(503).json({ error: 'ElevenLabs service not configured' });
}
// With:
if (!API_KEYS.elevenLabs) {
  throw new ServiceUnavailableError(
    'ElevenLabs',
    'Transcription service is temporarily unavailable. Please try again later.'
  );
}
```

**ElevenLabs error (line 84-87):**
```javascript
// Replace:
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  return res.status(response.status).json({
    error: errorData.detail?.message || 'Transcription failed'
  });
}
// With:
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  throw new ProcessingError(
    `ElevenLabs API error: ${errorData.detail?.message || response.statusText}`,
    'Transcription failed. Please try again or contact support.'
  );
}
```

**Testing:**
- Test with missing API key
- Test ElevenLabs API errors
- Test successful transcription

---

### 1.7 Create Network Monitor (Mobile)

**File:** `nora-mobile/src/utils/NetworkMonitor.ts` (NEW)

**Implementation:**
```typescript
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

  // Check for specific error codes
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
      default:
        return error.message || 'Something went wrong. Please try again.';
    }
  }

  // Fallback to generic error message
  return error.message || 'Something went wrong. Please try again.';
}
```

**Dependencies:**
```bash
npm install @react-native-community/netinfo
```

**Testing:**
- Test online/offline detection
- Test listener callbacks
- Test error message generation
- Test various error scenarios

---

### 1.8 Create Centralized Error Messages (Mobile)

**File:** `nora-mobile/src/utils/errorMessages.ts` (NEW)

**Implementation:**
```typescript
/**
 * Centralized user-facing error messages
 * Provides consistent, helpful error messages throughout the app
 */

export const ErrorMessages = {
  // Authentication
  AUTH: {
    LOGIN_FAILED: 'Incorrect email or password. Please try again.',
    SIGNUP_FAILED: 'Failed to create account. Please try again.',
    EMAIL_EXISTS: 'This email is already registered. Please log in or use a different email.',
    INVALID_EMAIL: 'Please enter a valid email address.',
    WEAK_PASSWORD: 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number.',
    PASSWORDS_DONT_MATCH: 'Passwords do not match. Please try again.',
    SESSION_EXPIRED: 'Your session has expired. Please log in again.',
    UNAUTHORIZED: 'Please log in to continue.',
  },

  // Network
  NETWORK: {
    NO_CONNECTION: 'No internet connection. Please check your network and try again.',
    TIMEOUT: 'Request timed out. Please check your connection and try again.',
    GENERIC: 'Network error. Please check your connection and try again.',
  },

  // Recording & Upload
  RECORDING: {
    START_FAILED: 'Failed to start recording. Please check microphone permissions and try again.',
    STOP_FAILED: 'Failed to stop recording. Please try again.',
    UPLOAD_FAILED: 'Upload failed. Please check your connection and try again.',
    FILE_TOO_LARGE: 'Recording is too large. Please try a shorter recording (max 50MB).',
    NO_PERMISSION: 'Microphone permission is required to record. Please enable it in Settings.',
  },

  // Processing
  PROCESSING: {
    FAILED: 'We encountered an error while analyzing your recording. Please try recording again.',
    TIMEOUT: 'Processing is taking longer than usual. Your recording will appear on the home screen when ready.',
    TRANSCRIPTION_FAILED: 'Failed to transcribe audio. Please try recording again with clearer audio.',
    ANALYSIS_FAILED: 'Failed to analyze your recording. Please try again.',
  },

  // Generic
  GENERIC: {
    UNKNOWN: 'Something went wrong. Please try again.',
    SERVER_ERROR: 'We\'re experiencing technical difficulties. Please try again in a few moments.',
    NOT_FOUND: 'The requested resource was not found.',
    FORBIDDEN: 'You don\'t have permission to access this resource.',
  },

  // Lessons
  LESSONS: {
    LOAD_FAILED: 'Failed to load lessons. Please try again.',
    NOT_FOUND: 'This lesson is not available. It may have been updated.',
  },
};

/**
 * Get user-friendly error message from API error
 */
export function getErrorMessage(error: any, fallback?: string): string {
  // Check for network errors first
  if (!error) {
    return fallback || ErrorMessages.GENERIC.UNKNOWN;
  }

  // Use userMessage if available (from backend)
  if (error.userMessage) {
    return error.userMessage;
  }

  // Map error codes to messages
  if (error.code) {
    switch (error.code) {
      case 'UNAUTHORIZED':
        return ErrorMessages.AUTH.UNAUTHORIZED;
      case 'FORBIDDEN':
        return ErrorMessages.GENERIC.FORBIDDEN;
      case 'NOT_FOUND':
        return error.message || ErrorMessages.GENERIC.NOT_FOUND;
      case 'VALIDATION_ERROR':
        return error.message || 'Please check your input and try again.';
      case 'UPLOAD_ERROR':
        return error.message || ErrorMessages.RECORDING.UPLOAD_FAILED;
      case 'PROCESSING_ERROR':
        return error.message || ErrorMessages.PROCESSING.FAILED;
      default:
        break;
    }
  }

  // Fallback to error message or default
  return error.message || fallback || ErrorMessages.GENERIC.UNKNOWN;
}
```

**Testing:**
- Test all message mappings
- Test with various error objects
- Verify message clarity and helpfulness

---

## Phase 2: User Experience (Medium Priority)

**Goal:** Improve user-facing error messages and handling
**Estimated Effort:** 1 day
**Risk:** Low

### 2.1 Create Toast Component

**File:** `nora-mobile/src/components/Toast.tsx` (NEW)

**Implementation:**
```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type: ToastType;
  duration?: number;
  onHide: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type,
  duration = 3000,
  onHide
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    // Slide in and fade in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Wait then slide out and fade out
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => onHide());
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return '#10B981'; // green
      case 'error':
        return '#EF4444'; // red
      case 'warning':
        return '#F59E0B'; // amber
      case 'info':
        return '#3B82F6'; // blue
      default:
        return '#6B7280'; // gray
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: getBackgroundColor(),
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 9999,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
```

**File:** `nora-mobile/src/components/ToastManager.tsx` (NEW)

```typescript
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Toast, ToastType } from './Toast';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

interface ToastData {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [nextId, setNextId] = useState(0);

  const showToast = (message: string, type: ToastType = 'info', duration: number = 3000) => {
    const id = nextId;
    setNextId(id + 1);
    setToasts(prev => [...prev, { id, message, type, duration }]);
  };

  const hideToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onHide={() => hideToast(toast.id)}
        />
      ))}
    </ToastContext.Provider>
  );
};
```

**Usage:**
```typescript
// In App.tsx or root component:
<ToastProvider>
  <YourApp />
</ToastProvider>

// In any component:
const { showToast } = useToast();
showToast('Recording saved!', 'success');
showToast('Failed to load data', 'error');
```

**Testing:**
- Test all toast types
- Test multiple toasts
- Test auto-dismiss timing
- Test animation smoothness

---

### 2.2 Update UploadProcessingContext

**File:** `nora-mobile/src/contexts/UploadProcessingContext.tsx`

**Changes:**

**Import error utilities:**
```typescript
import { handleApiError } from '../utils/NetworkMonitor';
import { ErrorMessages } from '../utils/errorMessages';
```

**Add exponential backoff (line 258):**
```typescript
// Replace fixed 3-second delay:
await new Promise(resolve => setTimeout(resolve, 3000));

// With exponential backoff:
const getBackoffDelay = (attempt: number): number => {
  // Start at 1s, increase by 1.5x each attempt, max 10s
  return Math.min(1000 * Math.pow(1.5, attempt), 10000);
};

const delay = getBackoffDelay(attempt);
console.log(`[UploadProcessing] Waiting ${delay}ms before next poll (attempt ${attempt + 1}/${maxAttempts})`);
await new Promise(resolve => setTimeout(resolve, delay));
```

**Improve timeout message (line 260-274):**
```typescript
// Replace:
Alert.alert(
  'Report Generation Failed',
  'Analysis is taking longer than expected. Please try recording again or contact support if the issue persists.',
  [{ text: 'OK', onPress: () => onNavigateToHome?.() }]
);

// With:
Alert.alert(
  'Still Processing',
  ErrorMessages.PROCESSING.TIMEOUT,
  [
    { text: 'Wait on Home Screen', onPress: () => onNavigateToHome?.() },
    { text: 'Cancel', style: 'cancel', onPress: async () => {
      // TODO: Optionally cancel the recording
      await reset();
      onNavigateToHome?.();
    }}
  ]
);
```

**Improve upload error handling (line 236-250):**
```typescript
// Replace generic error message with network-aware one:
const errorMessage = handleApiError(error);

Alert.alert(
  'Upload Failed',
  errorMessage,
  [
    { text: 'Cancel', onPress: async () => {
      await reset();
      onNavigateToHome?.();
    }, style: 'cancel' },
    { text: 'Retry', onPress: () => uploadRecording(uri, durationSeconds, true) }
  ]
);
```

**Improve analysis error (line 326-341):**
```typescript
// Use centralized error messages:
Alert.alert(
  'Report Generation Failed',
  error.userMessage || ErrorMessages.PROCESSING.FAILED,
  [{ text: 'OK', onPress: () => onNavigateToHome?.() }]
);
```

**Testing:**
- Test exponential backoff timing
- Test timeout scenario
- Test network error scenarios
- Test analysis failure
- Verify all error messages

---

### 2.3 Update RecordScreen

**File:** `nora-mobile/src/screens/RecordScreen.tsx`

**Changes:**

**Import error utilities:**
```typescript
import { ErrorMessages } from '../utils/errorMessages';
import { useToast } from '../components/ToastManager';
```

**Add toast for non-critical errors:**
```typescript
const { showToast } = useToast();
```

**Update start recording error (line 288-290):**
```typescript
// Replace:
Alert.alert('Error', 'Failed to start recording. Please try again.');

// With:
Alert.alert('Recording Error', ErrorMessages.RECORDING.START_FAILED);
```

**Update upload error (line 336-350):**
```typescript
// Use handleApiError:
import { handleApiError } from '../utils/NetworkMonitor';

const errorMessage = handleApiError(error);
Alert.alert(
  'Upload Failed',
  errorMessage,
  [
    { text: 'Cancel', onPress: resetRecording, style: 'cancel' },
    { text: 'Retry', onPress: () => uploadProcessing.startUpload(uri, durationSeconds) }
  ]
);
```

**Testing:**
- Test recording start failures
- Test upload failures
- Test retry functionality

---

### 2.4 Update Login/Signup Screens

**File:** `nora-mobile/src/screens/onboarding/LoginScreen.tsx`

**Changes:**

**Import error utilities:**
```typescript
import { ErrorMessages, getErrorMessage } from '../../utils/errorMessages';
```

**Update validation (line 34-37):**
```typescript
// Better validation feedback:
if (!email.trim()) {
  Alert.alert('Error', 'Please enter your email address');
  return;
}
if (!password.trim()) {
  Alert.alert('Error', 'Please enter your password');
  return;
}
```

**Update login error (line 50-55):**
```typescript
// Replace:
Alert.alert(
  'Login Failed',
  error.message || 'Invalid email or password. Please try again.'
);

// With:
const errorMessage = getErrorMessage(error, ErrorMessages.AUTH.LOGIN_FAILED);
Alert.alert('Login Failed', errorMessage);
```

---

**File:** `nora-mobile/src/screens/onboarding/CreateAccountScreen.tsx`

**Changes:**

**Update signup error (line 96-99):**
```typescript
const errorMessage = getErrorMessage(error, ErrorMessages.AUTH.SIGNUP_FAILED);
Alert.alert('Signup Failed', errorMessage);
```

**Keep inline validation as-is** (already good UX)

**Testing:**
- Test all validation scenarios
- Test login/signup errors
- Test error message clarity

---

### 2.5 Add Network Status Indicator

**File:** `nora-mobile/src/components/NetworkStatusBar.tsx` (NEW)

**Implementation:**
```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { networkMonitor } from '../utils/NetworkMonitor';

export const NetworkStatusBar: React.FC = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [slideAnim] = useState(new Animated.Value(-50));

  useEffect(() => {
    const unsubscribe = networkMonitor.addListener((connected) => {
      setIsConnected(connected);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isConnected) {
      // Slide down when offline
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Slide up when back online
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isConnected]);

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text style={styles.text}>No Internet Connection</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#EF4444',
    paddingTop: 50, // Account for status bar
    paddingBottom: 8,
    alignItems: 'center',
    zIndex: 9998,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
```

**Add to App root:**
```typescript
// In App.tsx or navigation root
<>
  <NavigationContainer>
    {/* Your app navigation */}
  </NavigationContainer>
  <NetworkStatusBar />
</>
```

**Testing:**
- Test offline detection
- Test online transition
- Test animation smoothness

---

## Phase 3: Monitoring (Low Priority)

**Goal:** Add error monitoring and analytics
**Estimated Effort:** 0.5 days
**Risk:** Low

### 3.1 Add Sentry (Backend)

**Installation:**
```bash
npm install @sentry/node
```

**File:** `server/server.cjs`

**Add at top (after imports):**
```javascript
const Sentry = require('@sentry/node');

// Initialize Sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });

  console.log('[Sentry] Initialized for backend error monitoring');
}
```

**Update global error handler:**
```javascript
app.use((err, req, res, next) => {
  // Log error
  console.error('[ERROR]', {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    error: err.message,
    code: err.code || 'INTERNAL_ERROR',
    statusCode: err.statusCode || 500
  });

  // Send to Sentry (only for 500 errors)
  if (process.env.SENTRY_DSN && (!err.statusCode || err.statusCode >= 500)) {
    Sentry.captureException(err, {
      user: req.user ? { id: req.user.id, email: req.user.email } : undefined,
      tags: {
        path: req.path,
        method: req.method,
        errorCode: err.code
      }
    });
  }

  // Send response...
});
```

**Environment variable:**
```bash
# .env
SENTRY_DSN=your_sentry_dsn_here
```

**Testing:**
- Test error capture in Sentry dashboard
- Test user context
- Test tags and metadata

---

### 3.2 Enhanced Logging

**File:** `server/utils/logger.cjs` (NEW)

**Implementation:**
```javascript
/**
 * Structured logging utility
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

function formatLog(level, message, context = {}) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context
  });
}

function error(message, context = {}) {
  console.error(formatLog(LOG_LEVELS.ERROR, message, context));
}

function warn(message, context = {}) {
  console.warn(formatLog(LOG_LEVELS.WARN, message, context));
}

function info(message, context = {}) {
  console.log(formatLog(LOG_LEVELS.INFO, message, context));
}

function debug(message, context = {}) {
  if (process.env.NODE_ENV === 'development') {
    console.log(formatLog(LOG_LEVELS.DEBUG, message, context));
  }
}

module.exports = { error, warn, info, debug };
```

**Usage:**
```javascript
const logger = require('./utils/logger.cjs');

logger.error('Upload failed', {
  userId: user.id,
  sessionId: session.id,
  error: error.message
});
```

**Testing:**
- Test log formatting
- Test different log levels
- Verify structured output

---

### 3.3 Error Analytics Queries

**File:** `docs/ERROR_ANALYTICS.md` (NEW)

**Document common error queries:**
```markdown
# Error Analytics

## Useful Database Queries

### Failed Sessions
```sql
SELECT
  id,
  userId,
  createdAt,
  analysisError,
  analysisFailedAt
FROM Session
WHERE analysisStatus = 'FAILED'
ORDER BY analysisFailedAt DESC
LIMIT 100;
```

### Error Frequency by Type
```sql
SELECT
  analysisError,
  COUNT(*) as count
FROM Session
WHERE analysisStatus = 'FAILED'
GROUP BY analysisError
ORDER BY count DESC;
```

### User Error Rate
```sql
SELECT
  u.email,
  COUNT(*) as total_sessions,
  SUM(CASE WHEN s.analysisStatus = 'FAILED' THEN 1 ELSE 0 END) as failed_sessions,
  (SUM(CASE WHEN s.analysisStatus = 'FAILED' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as error_rate
FROM User u
LEFT JOIN Session s ON s.userId = u.id
GROUP BY u.id, u.email
HAVING COUNT(*) > 0
ORDER BY error_rate DESC;
```
```

---

## Testing Strategy

### Unit Tests
- Test all custom error classes
- Test error utility functions
- Test network monitor
- Test toast components

### Integration Tests
- Test error flow end-to-end
- Test API error responses
- Test mobile error handling
- Test token refresh on 401

### Manual Testing Checklist
- [ ] Test all error scenarios in auth flow
- [ ] Test upload errors (no network, file too large, etc.)
- [ ] Test recording errors
- [ ] Test analysis timeout
- [ ] Test network connectivity changes
- [ ] Verify all error messages are user-friendly
- [ ] Check error logging format
- [ ] Verify Sentry integration (if enabled)

---

## Rollback Strategy

### If Phase 1 Issues
1. Keep global error handler but disable throwing errors
2. Revert to inline res.status().json() in routes
3. Remove error class imports

### If Phase 2 Issues
1. Disable toast notifications (use Alert only)
2. Revert to fixed polling delay
3. Remove network monitor integration

### If Phase 3 Issues
1. Disable Sentry without removing code
2. Revert to simple console.log logging

---

## Dependencies

### Backend
- None (uses existing Express)

### Mobile
- `@react-native-community/netinfo` - Network detection

### Monitoring (Optional)
- `@sentry/node` - Backend error monitoring

---

## Deployment Checklist

### Before Deployment
- [ ] Review all error messages for clarity
- [ ] Test error scenarios in staging
- [ ] Verify Sentry DSN configured (if using)
- [ ] Check all imports are correct
- [ ] Run full test suite
- [ ] Review error logs format

### After Deployment
- [ ] Monitor error logs for new issues
- [ ] Check Sentry for captured errors
- [ ] Verify user error messages are showing correctly
- [ ] Monitor API response times
- [ ] Check for any regression in error handling

### Monitoring
- [ ] Set up Sentry alerts for high error rates
- [ ] Monitor database for failed sessions
- [ ] Track error rates over time
- [ ] Review user feedback about errors

---

## Success Metrics

### Phase 1
- ✅ All API errors use standardized format
- ✅ Global error handler catches all unhandled errors
- ✅ Error logs include full context
- ✅ Zero unhandled promise rejections

### Phase 2
- ✅ Users see helpful, actionable error messages
- ✅ Network errors are clearly identified
- ✅ Toast notifications reduce Alert fatigue
- ✅ User can recover from most errors

### Phase 3
- ✅ Sentry captures production errors
- ✅ Error trends are visible in analytics
- ✅ Structured logs enable debugging
- ✅ Error rates decrease over time

---

## Estimated Timeline

| Phase | Tasks | Duration | Risk |
|-------|-------|----------|------|
| Phase 1 | Foundation | 1.5 days | Medium |
| Phase 2 | UX Improvements | 1 day | Low |
| Phase 3 | Monitoring | 0.5 days | Low |
| **Total** | | **3 days** | |

**Note:** Timeline assumes one developer working full-time. Parallel work possible between backend and mobile changes.

---

## Questions for Review

1. Should we implement all phases at once or incrementally?
2. Which error monitoring service to use? (Sentry, Rollbar, LogRocket, etc.)
3. Should we add error retry policies with exponential backoff globally?
4. Do we want to track error metrics in the database?
5. Should we add user feedback mechanism for errors?
6. Do we need different error messages for different user types?
7. Should failed recordings be automatically retryable from the UI?

---

**Next Steps:**
1. Review this plan
2. Answer questions above
3. Approve or request changes
4. Begin implementation phase by phase
