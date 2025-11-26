/**
 * Amplitude Analytics Service
 * Handles all analytics tracking for the PCIT app
 */

import * as amplitude from '@amplitude/analytics-browser';
import { sessionReplayPlugin } from '@amplitude/plugin-session-replay-browser';

const AMPLITUDE_API_KEY = '2d00252b4409bf740cf0b657745ea50b';

class AmplitudeService {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize Amplitude with EU server zone, autocapture, and session replay
   */
  init() {
    if (this.initialized) {
      console.log('Amplitude already initialized');
      return;
    }

    try {
      // Add session replay plugin
      amplitude.add(sessionReplayPlugin({ sampleRate: 1 }));

      // Initialize Amplitude with US server zone and autocapture
      amplitude.init(AMPLITUDE_API_KEY, undefined, {
        fetchRemoteConfig: true,
        serverZone: 'US',
        autocapture: {
          elementInteractions: true,
          pageViews: true,
          sessions: true,
          formInteractions: true,
          fileDownloads: true,
        },
        defaultTracking: {
          sessions: true,
          pageViews: true,
          formInteractions: true,
          fileDownloads: true,
        }
      });

      this.initialized = true;
      console.log('Amplitude initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Amplitude:', error);
    }
  }

  /**
   * Identify user with Amplitude
   * @param {string} userId - User ID
   * @param {object} userProperties - Additional user properties
   */
  identifyUser(userId, userProperties = {}) {
    if (!this.initialized) {
      console.warn('Amplitude not initialized');
      return;
    }

    try {
      // Set user ID
      amplitude.setUserId(userId);

      // Set user properties
      const identify = new amplitude.Identify();
      Object.entries(userProperties).forEach(([key, value]) => {
        identify.set(key, value);
      });
      amplitude.identify(identify);

      console.log('User identified:', userId);
    } catch (error) {
      console.error('Failed to identify user:', error);
    }
  }

  /**
   * Track custom event
   * @param {string} eventName - Name of the event
   * @param {object} eventProperties - Event properties
   */
  trackEvent(eventName, eventProperties = {}) {
    if (!this.initialized) {
      console.warn('Amplitude not initialized');
      return;
    }

    try {
      amplitude.track(eventName, eventProperties);
      console.log('Event tracked:', eventName, eventProperties);
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }

  /**
   * Track page view
   * @param {string} pageName - Name of the page
   */
  trackPageView(pageName) {
    this.trackEvent('Page Viewed', { page: pageName });
  }

  /**
   * Track user login
   * @param {string} method - Login method (e.g., 'email', 'google')
   */
  trackLogin(method = 'email') {
    this.trackEvent('User Logged In', { method });
  }

  /**
   * Track user signup
   */
  trackSignup() {
    this.trackEvent('User Signed Up');
  }

  /**
   * Track session recording start
   * @param {string} mode - Session mode (CDI or PDI)
   */
  trackRecordingStart(mode) {
    this.trackEvent('Recording Started', { mode });
  }

  /**
   * Track session recording complete
   * @param {string} mode - Session mode
   * @param {number} duration - Duration in seconds
   */
  trackRecordingComplete(mode, duration) {
    this.trackEvent('Recording Completed', { mode, duration });
  }

  /**
   * Track survey submission
   * @param {number} totalScore - Total behavior score
   * @param {number} changesNeeded - Number of behaviors needing change
   */
  trackSurveySubmission(totalScore, changesNeeded) {
    this.trackEvent('WACB Survey Submitted', {
      totalScore,
      changesNeeded,
      averageScore: totalScore / 9
    });
  }

  /**
   * Track learning deck completion
   * @param {number} deckNumber - Deck number (1-15)
   */
  trackDeckComplete(deckNumber) {
    this.trackEvent('Deck Completed', { deckNumber });
  }

  /**
   * Track mastery achievement
   * @param {string} type - Type of mastery ('CDI' or 'PDI')
   */
  trackMasteryAchieved(type) {
    this.trackEvent('Mastery Achieved', { type });
  }

  /**
   * Reset Amplitude (for logout)
   */
  reset() {
    if (!this.initialized) return;

    try {
      amplitude.reset();
      console.log('Amplitude reset');
    } catch (error) {
      console.error('Failed to reset Amplitude:', error);
    }
  }
}

// Export singleton instance
const amplitudeService = new AmplitudeService();
export default amplitudeService;
