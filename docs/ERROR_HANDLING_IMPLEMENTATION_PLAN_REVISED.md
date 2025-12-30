# Error Handling Implementation Plan (REVISED)

**Status:** READY FOR IMPLEMENTATION
**Created:** 2025-12-29
**Revised:** 2025-12-29 (removed manual retry, removed report problem feature)
**Estimated Total Effort:** 3 days

---

## Overview

This plan improves error handling across the Nora app by:
1. Standardizing backend error responses
2. Adding global error handling middleware
3. Improving user-facing error messages
4. Adding network connectivity detection
5. **Auto-retry processing failures (3 attempts)**
6. **Auto-report permanent failures to team**
7. Implementing error monitoring

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

  // Send to Sentry (Phase 3)
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

---

### 1.3 Update Authentication Middleware

**File:** `server/middleware/auth.cjs`

**Changes:**
```javascript
// Add import at top
const { UnauthorizedError, AppError } = require('../utils/errors.cjs');

// Replace inline error responses with:
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  throw new UnauthorizedError('No token provided', 'Please log in to continue');
}

if (!payload) {
  throw new UnauthorizedError('Invalid or expired token', 'Your session has expired. Please log in again.');
}

// In catch block:
throw new AppError('Authentication middleware error', 500, 'AUTH_ERROR', 'Authentication failed. Please try again.');
```

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

**Key changes:**

```javascript
// Validation errors
if (error) {
  const errors = error.details.map(d => d.message);
  throw new ValidationError(errors[0], errors);
}

// Email exists
if (existingUser) {
  throw new ConflictError(
    'Email already exists in database',
    'This email is already registered. Please log in or use a different email.'
  );
}

// Invalid credentials
if (!user || !isPasswordValid) {
  throw new UnauthorizedError(
    'Invalid credentials',
    'Incorrect email or password. Please try again.'
  );
}

// Generic signup/login errors
catch (error) {
  throw new AppError(
    `Signup error: ${error.message}`,
    500,
    'SIGNUP_ERROR',
    'Failed to create account. Please try again or contact support.'
  );
}
```

---

### 1.5 Update Recording Routes with Auto-Retry Logic

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

**Key changes:**

```javascript
// Upload validation
if (!req.file) {
  throw new UploadError(
    'No audio file in request',
    'No audio file provided. Please select a recording to upload.'
  );
}

if (error.code === 'LIMIT_FILE_SIZE') {
  throw new UploadError(
    'File exceeds size limit',
    'Audio file must be less than 50MB. Please try a shorter recording.'
  );
}

// Access control
if (!session) {
  throw new NotFoundError('Recording');
}

if (session.userId !== req.user.id) {
  throw new ForbiddenError(
    'User does not own this recording',
    'You don\'t have permission to access this recording.'
  );
}
```

**CRITICAL: Add Auto-Retry Logic for Processing**

**Current background processing (around line 1280):**
```javascript
// Background processing - transcription and analysis
processRecordingInBackground(session.id)
  .catch(async (err) => {
    console.error(`❌ [PROCESSING-FAILED] Session ${session.id.substring(0, 8)} failed:`, err);
    await prisma.session.update({
      where: { id: session.id },
      data: {
        analysisStatus: 'FAILED',
        analysisError: err.message || 'Unknown error occurred during processing',
        analysisFailedAt: new Date()
      }
    });
  });
```

**Replace with auto-retry logic:**
```javascript
// Background processing with automatic retry
processRecordingWithRetry(session.id, 0)
  .catch(async (err) => {
    console.error(`❌ [PROCESSING-FAILED-PERMANENTLY] Session ${session.id.substring(0, 8)} failed after all retries:`, err);

    // Update session with permanent failure
    await prisma.session.update({
      where: { id: session.id },
      data: {
        analysisStatus: 'FAILED',
        analysisError: err.message || 'Unknown error occurred during processing',
        analysisFailedAt: new Date(),
        permanentFailure: true
      }
    });

    // Auto-report to team
    await reportPermanentFailureToTeam(session.id, err);
  });
```

**New function: processRecordingWithRetry**
```javascript
/**
 * Process recording with automatic retry logic
 * Retries up to 3 times before giving up
 */
async function processRecordingWithRetry(sessionId, attemptNumber = 0) {
  const maxAttempts = 3;
  const retryDelays = [0, 5000, 15000]; // 0s, 5s, 15s

  try {
    console.log(`🔄 [PROCESSING] Session ${sessionId.substring(0, 8)} - Attempt ${attemptNumber + 1}/${maxAttempts}`);

    // Update retry tracking
    if (attemptNumber > 0) {
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          retryCount: attemptNumber,
          lastRetriedAt: new Date()
        }
      });
    }

    // Run the actual processing
    await processRecordingInBackground(sessionId);

    // Success! Log it
    console.log(`✅ [PROCESSING-SUCCESS] Session ${sessionId.substring(0, 8)} completed on attempt ${attemptNumber + 1}`);

  } catch (error) {
    console.error(`❌ [PROCESSING-ERROR] Session ${sessionId.substring(0, 8)} - Attempt ${attemptNumber + 1} failed:`, error.message);

    // Check if we should retry
    if (attemptNumber < maxAttempts - 1) {
      const delay = retryDelays[attemptNumber + 1];
      console.log(`⏳ [RETRY] Session ${sessionId.substring(0, 8)} - Retrying in ${delay}ms (attempt ${attemptNumber + 2}/${maxAttempts})`);

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));

      // Retry recursively
      return processRecordingWithRetry(sessionId, attemptNumber + 1);
    }

    // All retries exhausted
    throw error;
  }
}
```

**New function: reportPermanentFailureToTeam**
```javascript
/**
 * Automatically report permanent processing failure to team
 */
async function reportPermanentFailureToTeam(sessionId, error) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });

    if (!session) return;

    const errorReport = {
      type: 'PERMANENT_PROCESSING_FAILURE',
      sessionId: session.id,
      userId: session.userId,
      userEmail: session.user.email,
      error: error.message,
      stack: error.stack,
      retryCount: session.retryCount,
      audioUrl: session.audioUrl,
      durationSeconds: session.durationSeconds,
      timestamp: new Date().toISOString()
    };

    // Send to Slack webhook
    if (process.env.SLACK_ERROR_WEBHOOK_URL) {
      await fetch(process.env.SLACK_ERROR_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 *Permanent Processing Failure* - Session ${sessionId.substring(0, 8)}`,
          blocks: [
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*User:*\n${session.user.email}` },
                { type: 'mrkdwn', text: `*Session:*\n${sessionId}` }
              ]
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Error:*\n${error.message}` },
                { type: 'mrkdwn', text: `*Retry Attempts:*\n${session.retryCount + 1}/3` }
              ]
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Audio:* <${session.audioUrl}|Download>`
              }
            },
            {
              type: 'context',
              elements: [
                { type: 'mrkdwn', text: `Duration: ${session.durationSeconds}s | Failed at: ${new Date().toLocaleString()}` }
              ]
            }
          ]
        })
      });

      console.log(`📧 [AUTO-REPORT] Sent failure report to team for session ${sessionId.substring(0, 8)}`);
    }

    // Also log to ErrorLog table
    await prisma.errorLog.create({
      data: {
        userId: session.userId,
        sessionId: session.id,
        errorType: 'PERMANENT_PROCESSING_FAILURE',
        errorCode: 'MAX_RETRIES_EXCEEDED',
        errorMessage: error.message,
        stackTrace: error.stack,
        metadata: {
          retryCount: session.retryCount,
          audioUrl: session.audioUrl,
          durationSeconds: session.durationSeconds,
          autoReported: true
        },
        occurredAt: new Date()
      }
    });

  } catch (reportError) {
    console.error('❌ [AUTO-REPORT-FAILED] Failed to report error to team:', reportError);
  }
}
```

---

### 1.6 Update Transcription Proxy Routes

**File:** `server/routes/transcription-proxy.cjs`

**Import and changes:**
```javascript
const { ServiceUnavailableError, ProcessingError } = require('../utils/errors.cjs');

// API key check
if (!API_KEYS.elevenLabs) {
  throw new ServiceUnavailableError(
    'ElevenLabs',
    'Transcription service is temporarily unavailable. Please try again later.'
  );
}

// API error
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  throw new ProcessingError(
    `ElevenLabs API error: ${errorData.detail?.message || response.statusText}`,
    'Transcription failed. Please try again or contact support.'
  );
}
```

---

### 1.7 Create Network Monitor (Mobile)

**File:** `nora-mobile/src/utils/NetworkMonitor.ts` (NEW)

**Implementation:**
```typescript
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

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

      if (wasConnected !== this.isConnected) {
        console.log(`[NetworkMonitor] Connection state changed: ${this.isConnected ? 'ONLINE' : 'OFFLINE'}`);
        this.listeners.forEach(listener => listener(this.isConnected));
      }
    });
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  addListener(callback: (connected: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async getNetworkState(): Promise<NetInfoState> {
    return await NetInfo.fetch();
  }

  destroy() {
    this.unsubscribe?.();
    this.listeners.clear();
  }
}

export const networkMonitor = new NetworkMonitor();

export function handleApiError(error: any): string {
  if (!networkMonitor.getIsConnected()) {
    return 'No internet connection. Please check your network and try again.';
  }

  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return 'Request timed out. Please check your connection and try again.';
  }

  if (error.code === 'NETWORK_ERROR' || error.message?.toLowerCase().includes('network')) {
    return 'Network error. Please check your connection and try again.';
  }

  if (error.userMessage) {
    return error.userMessage;
  }

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

  return error.message || 'Something went wrong. Please try again.';
}
```

**Dependencies:**
```bash
npm install @react-native-community/netinfo
```

---

### 1.8 Create Centralized Error Messages (Mobile)

**File:** `nora-mobile/src/utils/errorMessages.ts` (NEW)

**Implementation:**
```typescript
export const ErrorMessages = {
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

  NETWORK: {
    NO_CONNECTION: 'No internet connection. Please check your network and try again.',
    TIMEOUT: 'Request timed out. Please check your connection and try again.',
    GENERIC: 'Network error. Please check your connection and try again.',
  },

  RECORDING: {
    START_FAILED: 'Failed to start recording. Please check microphone permissions and try again.',
    STOP_FAILED: 'Failed to stop recording. Please try again.',
    UPLOAD_FAILED: 'Upload failed. Please check your connection and try again.',
    FILE_TOO_LARGE: 'Recording is too large. Please try a shorter recording (max 50MB).',
    NO_PERMISSION: 'Microphone permission is required to record. Please enable it in Settings.',
  },

  PROCESSING: {
    FAILED: 'We\'re sorry, but we encountered an error while analyzing your recording. Our team has been notified and will investigate.',
    IN_PROGRESS: 'Your recording is being processed. This usually takes 1-2 minutes.',
    RETRY_IN_PROGRESS: 'We encountered a temporary issue. Automatically retrying...',
  },

  GENERIC: {
    UNKNOWN: 'Something went wrong. Please try again.',
    SERVER_ERROR: 'We\'re experiencing technical difficulties. Please try again in a few moments.',
    NOT_FOUND: 'The requested resource was not found.',
    FORBIDDEN: 'You don\'t have permission to access this resource.',
  },

  LESSONS: {
    LOAD_FAILED: 'Failed to load lessons. Please try again.',
    NOT_FOUND: 'This lesson is not available. It may have been updated.',
  },
};

export function getErrorMessage(error: any, fallback?: string): string {
  if (!error) {
    return fallback || ErrorMessages.GENERIC.UNKNOWN;
  }

  if (error.userMessage) {
    return error.userMessage;
  }

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

  return error.message || fallback || ErrorMessages.GENERIC.UNKNOWN;
}
```

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
import { View, Text, StyleSheet, Animated } from 'react-native';

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
        return '#10B981';
      case 'error':
        return '#EF4444';
      case 'warning':
        return '#F59E0B';
      case 'info':
        return '#3B82F6';
      default:
        return '#6B7280';
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

const ToastContext = createContext<ToastContextType | undefined>(undefined);

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
const getBackoffDelay = (attempt: number): number => {
  return Math.min(1000 * Math.pow(1.5, attempt), 10000);
};

const delay = getBackoffDelay(attempt);
console.log(`[UploadProcessing] Waiting ${delay}ms before next poll (attempt ${attempt + 1}/${maxAttempts})`);
await new Promise(resolve => setTimeout(resolve, delay));
```

**Remove manual retry logic - system handles it automatically**

**Update failed analysis detection (line 326-341):**
```typescript
const isFailed = error.status === 'failed' ||
                 error.message?.toLowerCase().includes('report generation failed') ||
                 error.message?.toLowerCase().includes('analysis failed');

if (isFailed) {
  console.error('[UploadProcessing] Analysis failed permanently after auto-retries:', error.message);
  await reset();

  // Show apology - no action needed from user
  Alert.alert(
    'We Apologize',
    ErrorMessages.PROCESSING.FAILED,
    [{ text: 'OK', onPress: () => onNavigateToHome?.() }]
  );
  return;
}
```

**Update timeout message:**
```typescript
if (attempt >= maxAttempts) {
  console.log('[UploadProcessing] Polling timeout - still processing');
  await reset();
  Alert.alert(
    'Still Processing',
    'Your recording is taking longer than usual to process. It will appear on your home screen when ready.',
    [{ text: 'OK', onPress: () => onNavigateToHome?.() }]
  );
  return;
}
```

---

### 2.3 Update RecordScreen

**File:** `nora-mobile/src/screens/RecordScreen.tsx`

**Changes:**

**Import error utilities:**
```typescript
import { ErrorMessages } from '../utils/errorMessages';
import { handleApiError } from '../utils/NetworkMonitor';
import { useToast } from '../components/ToastManager';
```

**Update error messages:**
```typescript
const { showToast } = useToast();

// Start recording error
catch (error) {
  console.error('Failed to start recording:', error);
  Alert.alert('Recording Error', ErrorMessages.RECORDING.START_FAILED);
}

// Upload error
catch (error) {
  console.error('Upload failed:', error);
  const errorMessage = handleApiError(error);
  Alert.alert(
    'Upload Failed',
    errorMessage,
    [
      { text: 'Cancel', onPress: resetRecording, style: 'cancel' },
      { text: 'Retry', onPress: () => uploadProcessing.startUpload(uri, durationSeconds) }
    ]
  );
}
```

---

### 2.4 Update Login/Signup Screens

**File:** `nora-mobile/src/screens/onboarding/LoginScreen.tsx`

```typescript
import { ErrorMessages, getErrorMessage } from '../../utils/errorMessages';

// Update error handling
catch (error: any) {
  const errorMessage = getErrorMessage(error, ErrorMessages.AUTH.LOGIN_FAILED);
  Alert.alert('Login Failed', errorMessage);
}
```

**File:** `nora-mobile/src/screens/onboarding/CreateAccountScreen.tsx`

```typescript
catch (error: any) {
  const errorMessage = getErrorMessage(error, ErrorMessages.AUTH.SIGNUP_FAILED);
  Alert.alert('Signup Failed', errorMessage);
}
```

---

### 2.5 Add Network Status Indicator

**File:** `nora-mobile/src/components/NetworkStatusBar.tsx` (NEW)

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
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
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
    paddingTop: 50,
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

---

### 2.6 Update HomeScreen for Failed Recordings Display

**File:** `nora-mobile/src/screens/HomeScreen.tsx`

**Show failed recordings with apology (no retry button):**

```typescript
// For failed recordings
{recording.analysisStatus === 'FAILED' && (
  <View style={styles.failedCard}>
    <View style={styles.failedHeader}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <Text style={styles.failedTitle}>Processing Failed</Text>
    </View>

    <Text style={styles.failedDate}>
      {formatDate(recording.createdAt)}
    </Text>

    <Text style={styles.apologyText}>
      We apologize for the inconvenience. Our team has been automatically
      notified and will investigate this issue.
    </Text>

    {recording.retryCount > 0 && (
      <Text style={styles.retryInfo}>
        Attempted {recording.retryCount + 1} time(s)
      </Text>
    )}

    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => handleDeleteRecording(recording.id)}
    >
      <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
    </TouchableOpacity>
  </View>
)}
```

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

**Add at top:**
```javascript
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    release: process.env.GIT_COMMIT_SHA || 'unknown',

    beforeSend(event, hint) {
      // Don't send validation errors to Sentry
      if (event.exception?.values?.[0]?.value?.includes('VALIDATION_ERROR')) {
        return null;
      }
      return event;
    },
  });

  console.log('[Sentry] Initialized for backend error monitoring');
}
```

**Environment variable:**
```bash
# .env.production
SENTRY_DSN=your_sentry_dsn_here
SLACK_ERROR_WEBHOOK_URL=your_slack_webhook_url_here
```

---

### 3.2 Enhanced Logging

**File:** `server/utils/logger.cjs` (NEW)

```javascript
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

---

### 3.3 Database Schema for Error Tracking

**File:** `prisma/schema.prisma`

**Add to Session model:**
```prisma
model Session {
  // ... existing fields

  // Enhanced error tracking
  retryCount          Int       @default(0)
  lastRetriedAt       DateTime?
  permanentFailure    Boolean   @default(false)

  // Performance tracking
  transcriptionDurationMs Int?
  analysisDurationMs      Int?

  // Relation to error logs
  errorLogs           ErrorLog[]

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

// Detailed error log table
model ErrorLog {
  id            String   @id @default(cuid())

  // Context
  userId        String?
  sessionId     String?
  session       Session? @relation(fields: [sessionId], references: [id])

  // Error details
  errorType     String
  errorCode     String
  errorMessage  String   @db.Text
  stackTrace    String?  @db.Text

  // Request context
  endpoint      String?
  httpMethod    String?
  httpStatus    Int?

  // Additional metadata
  metadata      Json?

  // Auto-reported flag
  autoReported  Boolean  @default(false)

  occurredAt    DateTime @default(now())

  @@index([userId])
  @@index([sessionId])
  @@index([errorType])
  @@index([errorCode])
  @@index([occurredAt])
  @@index([autoReported])
}
```

**Migration:**
```bash
npx prisma migrate dev --name add-error-tracking
```

---

## Testing Strategy

### Unit Tests
- [ ] Test all custom error classes
- [ ] Test error utility functions
- [ ] Test network monitor
- [ ] Test toast components
- [ ] Test auto-retry logic (3 attempts with delays)

### Integration Tests
- [ ] Test error flow end-to-end
- [ ] Test API error responses match new format
- [ ] Test mobile error handling
- [ ] Test token refresh on 401
- [ ] Test auto-retry with mock failures

### Manual Testing Checklist

**Phase 1:**
- [ ] Signup with existing email → See conflict message
- [ ] Login with wrong password → See clear error
- [ ] Upload file too large → See size error
- [ ] Trigger server error → See apology message
- [ ] Check logs show structured format
- [ ] Verify 404 handler works

**Phase 2:**
- [ ] Turn off wifi → See network status bar
- [ ] Upload recording offline → See network error
- [ ] Toast notifications display correctly
- [ ] Exponential backoff timing is correct
- [ ] Failed recording shows apology (no retry button)

**Phase 3:**
- [ ] Trigger error → Check Sentry dashboard
- [ ] Permanent failure → Check Slack notification
- [ ] Verify error logs in database
- [ ] Check auto-report includes all context

**Auto-Retry Testing:**
- [ ] Mock processing failure → Verify 3 retry attempts
- [ ] Check retry delays (0s, 5s, 15s)
- [ ] After 3 failures → User sees apology
- [ ] After 3 failures → Team receives Slack notification
- [ ] Verify retryCount increments correctly
- [ ] Test successful retry on attempt 2 → No further retries

---

## Deployment Checklist

### Before Deployment
- [ ] Review all error messages for clarity
- [ ] Test auto-retry logic thoroughly
- [ ] Configure Sentry DSN
- [ ] Configure Slack webhook URL
- [ ] Run full test suite
- [ ] Check all imports are correct

### After Deployment
- [ ] Monitor error logs for new issues
- [ ] Check Sentry for captured errors
- [ ] Verify Slack notifications working
- [ ] Monitor API response times
- [ ] Check auto-retry success rate
- [ ] Review user feedback

### Monitoring
- [ ] Set up Sentry alerts for high error rates
- [ ] Monitor database for failed sessions
- [ ] Track auto-retry success rates
- [ ] Review Slack notifications daily

---

## Success Metrics

### Phase 1
- ✅ All API errors use standardized format
- ✅ Global error handler catches all unhandled errors
- ✅ Error logs include full context
- ✅ Zero unhandled promise rejections

### Phase 2
- ✅ Users see helpful, apologetic error messages
- ✅ Network errors clearly identified
- ✅ Toast notifications work smoothly
- ✅ Polling uses exponential backoff

### Phase 3
- ✅ Sentry captures production errors
- ✅ Auto-reports sent to team via Slack
- ✅ Structured logs enable debugging
- ✅ Error trends visible in database

### Auto-Retry
- ✅ Processing failures automatically retry 3 times
- ✅ Retry delays: 0s, 5s, 15s
- ✅ Permanent failures auto-reported to team
- ✅ Users see apology, no action needed
- ✅ Retry success rate > 70%

---

## Timeline

| Phase | Tasks | Duration |
|-------|-------|----------|
| Phase 1 | Foundation + Auto-retry | 1.5 days |
| Phase 2 | UX Improvements | 1 day |
| Phase 3 | Monitoring | 0.5 days |
| **Total** | | **3 days** |

---

## Files Summary

### **Files to Create (9)**
1. `server/utils/errors.cjs` - Custom error classes
2. `server/utils/logger.cjs` - Structured logging
3. `nora-mobile/src/utils/NetworkMonitor.ts` - Network detection
4. `nora-mobile/src/utils/errorMessages.ts` - Centralized messages
5. `nora-mobile/src/components/Toast.tsx` - Toast component
6. `nora-mobile/src/components/ToastManager.tsx` - Toast provider
7. `nora-mobile/src/components/NetworkStatusBar.tsx` - Network indicator

### **Files to Modify (9)**
1. `server/server.cjs` - Global error handler + Sentry
2. `server/middleware/auth.cjs` - Use custom errors
3. `server/routes/auth.cjs` - Replace inline errors
4. `server/routes/recordings.cjs` - Replace inline errors + **AUTO-RETRY LOGIC**
5. `server/routes/transcription-proxy.cjs` - Replace inline errors
6. `nora-mobile/src/contexts/UploadProcessingContext.tsx` - Better messages, backoff, remove manual retry
7. `nora-mobile/src/screens/RecordScreen.tsx` - Better error handling
8. `nora-mobile/src/screens/onboarding/LoginScreen.tsx` - Better messages
9. `nora-mobile/src/screens/onboarding/CreateAccountScreen.tsx` - Better messages
10. `nora-mobile/src/screens/HomeScreen.tsx` - Show failed recordings with apology
11. `prisma/schema.prisma` - Add error tracking schema

---

## Key Changes from Original Plan

### **Removed:**
- ❌ Manual retry button for failed recordings
- ❌ "Report Problem" button feature
- ❌ `UserErrorReport` table
- ❌ `/api/error-reports` endpoint
- ❌ `ReportProblemButton` component
- ❌ `reportingService`

### **Added:**
- ✅ **Auto-retry logic** for processing failures (3 attempts)
- ✅ **Automatic error reporting** to team (Slack)
- ✅ **Retry delays:** 0s, 5s, 15s
- ✅ **Apology messages** for permanent failures
- ✅ **permanentFailure** flag in Session model
- ✅ **autoReported** flag in ErrorLog model
- ✅ `processRecordingWithRetry()` function
- ✅ `reportPermanentFailureToTeam()` function

---

**Ready for implementation!** 🚀
