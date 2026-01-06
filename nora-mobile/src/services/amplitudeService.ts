/**
 * Amplitude Analytics Service for React Native
 * Handles all analytics tracking for the Nora mobile app
 */

import * as amplitude from '@amplitude/analytics-react-native';

// API keys for different environments
const AMPLITUDE_DEV_KEY = '6afe0ca3eac4c17cfad1a6cff1ce7d28'; // Using production key for dev (same project, filtered by environment tag)
const AMPLITUDE_PROD_KEY = '6afe0ca3eac4c17cfad1a6cff1ce7d28'; // Production API key

// Select API key based on environment
const AMPLITUDE_API_KEY = __DEV__ ? AMPLITUDE_DEV_KEY : AMPLITUDE_PROD_KEY;

class AmplitudeService {
  private initialized = false;

  /**
   * Initialize Amplitude with autocapture and default tracking
   */
  async init() {
    if (this.initialized) {
      console.log('[Amplitude] Already initialized');
      return;
    }

    if (!AMPLITUDE_API_KEY) {
      console.warn('[Amplitude] API key not configured. Analytics tracking is disabled.');
      return;
    }

    try {
      const environment = __DEV__ ? 'development' : 'production';
      console.log(`[Amplitude] Initializing in ${environment} mode`);

      // Initialize Amplitude with default tracking
      await amplitude.init(AMPLITUDE_API_KEY, undefined, {
        trackingOptions: {
          appSetId: true,
          carrier: true,
          deviceManufacturer: true,
          deviceModel: true,
          ipAddress: false, // Privacy: don't track IP
          language: true,
          osName: true,
          osVersion: true,
          platform: true,
        },
        defaultTracking: {
          sessions: true,
          appLifecycles: true,
          screenViews: true,
        },
        // React Native specific configuration
        instanceName: 'nora-mobile',
        disableCookies: true, // Disable cookies in React Native (not supported)
        optOut: false,
      });

      this.initialized = true;
      console.log('[Amplitude] Initialized successfully');
    } catch (error) {
      console.error('[Amplitude] Failed to initialize:', error);
    }
  }

  /**
   * Identify user with Amplitude
   */
  identifyUser(userId: string, userProperties: Record<string, any> = {}) {
    if (!this.initialized) {
      return;
    }

    try {
      // Set user ID
      amplitude.setUserId(userId);

      // Set user properties with environment tag
      const identify = new amplitude.Identify();
      const enrichedProperties = {
        ...userProperties,
        environment: __DEV__ ? 'development' : 'production',
      };

      Object.entries(enrichedProperties).forEach(([key, value]) => {
        identify.set(key, value);
      });
      amplitude.identify(identify);

      console.log('[Amplitude] User identified:', userId);
    } catch (error) {
      console.error('[Amplitude] Failed to identify user:', error);
    }
  }

  /**
   * Track custom event
   */
  trackEvent(eventName: string, eventProperties: Record<string, any> = {}) {
    if (!this.initialized) {
      return;
    }

    try {
      // Add environment tag to all events
      const enrichedProperties = {
        ...eventProperties,
        environment: __DEV__ ? 'development' : 'production',
      };

      amplitude.track(eventName, enrichedProperties);
      console.log('[Amplitude] Event tracked:', eventName, enrichedProperties);
    } catch (error) {
      console.error('[Amplitude] Failed to track event:', error);
    }
  }

  /**
   * Track screen view
   */
  trackScreenView(screenName: string, properties: Record<string, any> = {}) {
    this.trackEvent('Screen Viewed', { screen: screenName, ...properties });
  }

  /**
   * Track user login
   */
  trackLogin(method: string = 'email') {
    this.trackEvent('User Logged In', { method });
  }

  /**
   * Track user signup
   */
  trackSignup(method: string = 'email') {
    this.trackEvent('User Signed Up', { method });
  }

  /**
   * Track lesson started
   */
  trackLessonStarted(lessonId: string, lessonTitle: string, properties: Record<string, any> = {}) {
    this.trackEvent('Lesson Started', { lessonId, lessonTitle, ...properties });
  }

  /**
   * Track lesson completed
   */
  trackLessonCompleted(lessonId: string, lessonTitle: string, duration?: number, properties: Record<string, any> = {}) {
    this.trackEvent('Lesson Completed', { lessonId, lessonTitle, duration, ...properties });
  }

  /**
   * Track lesson segment viewed
   */
  trackLessonSegmentViewed(lessonId: string, segmentNumber: number, properties: Record<string, any> = {}) {
    this.trackEvent('Lesson Segment Viewed', { lessonId, segmentNumber, ...properties });
  }

  /**
   * Track quiz answered
   */
  trackQuizAnswered(lessonId: string, quizId: string, isCorrect: boolean, attemptNumber: number, properties: Record<string, any> = {}) {
    this.trackEvent('Quiz Answered', { lessonId, quizId, isCorrect, attemptNumber, ...properties });
  }

  /**
   * Track recording started
   */
  trackRecordingStarted(properties: Record<string, any> = {}) {
    this.trackEvent('Recording Started', properties);
  }

  /**
   * Track recording completed
   */
  trackRecordingCompleted(duration: number, fileSize?: number, properties: Record<string, any> = {}) {
    this.trackEvent('Recording Completed', { duration, fileSize, ...properties });
  }

  /**
   * Track recording uploaded
   */
  trackRecordingUploaded(recordingId: string, duration: number, properties: Record<string, any> = {}) {
    this.trackEvent('Recording Uploaded', { recordingId, duration, ...properties });
  }

  /**
   * Track report viewed
   */
  trackReportViewed(recordingId: string, score?: number, properties: Record<string, any> = {}) {
    this.trackEvent('Report Viewed', { recordingId, score, ...properties });
  }

  /**
   * Track notification permission
   */
  trackNotificationPermission(granted: boolean) {
    this.trackEvent('Notification Permission', { granted });
  }

  /**
   * Track notification received
   */
  trackNotificationReceived(type: string) {
    this.trackEvent('Notification Received', { type });
  }

  /**
   * Track notification opened
   */
  trackNotificationOpened(type: string) {
    this.trackEvent('Notification Opened', { type });
  }

  /**
   * Track app error
   */
  trackError(error: Error, context?: string) {
    this.trackEvent('App Error', {
      error: error.message,
      stack: error.stack,
      context,
    });
  }

  /**
   * Reset Amplitude (for logout)
   */
  reset() {
    if (!this.initialized) return;

    try {
      amplitude.reset();
      console.log('[Amplitude] Reset');
    } catch (error) {
      console.error('[Amplitude] Failed to reset:', error);
    }
  }
}

// Export singleton instance
const amplitudeService = new AmplitudeService();
export default amplitudeService;
