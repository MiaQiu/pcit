/**
 * Amplitude Analytics Service Interface
 *
 * NOTE: This is a platform-agnostic interface. Actual implementation differs by platform:
 * - Web: Uses @amplitude/analytics-browser
 * - Mobile: Uses @amplitude/analytics-react-native
 *
 * Each platform should implement this interface with their respective SDK.
 */

export interface AmplitudeConfig {
  apiKey: string;
  serverZone?: 'US' | 'EU';
}

export interface UserProperties {
  [key: string]: any;
}

export interface EventProperties {
  [key: string]: any;
}

/**
 * AmplitudeService Interface
 * Platform-specific implementations should implement this interface
 */
export interface IAmplitudeService {
  /**
   * Initialize Amplitude
   */
  init(config: AmplitudeConfig): void;

  /**
   * Identify user with Amplitude
   */
  identifyUser(userId: string, userProperties?: UserProperties): void;

  /**
   * Track custom event
   */
  trackEvent(eventName: string, eventProperties?: EventProperties): void;

  /**
   * Track page/screen view
   */
  trackPageView(pageName: string): void;

  /**
   * Track user login
   */
  trackLogin(method?: string): void;

  /**
   * Track user signup
   */
  trackSignup(): void;

  /**
   * Track session recording start
   */
  trackRecordingStart(mode: 'CDI' | 'PDI'): void;

  /**
   * Track session recording complete
   */
  trackRecordingComplete(mode: 'CDI' | 'PDI', duration: number): void;

  /**
   * Track survey submission
   */
  trackSurveySubmission(totalScore: number, changesNeeded: number): void;

  /**
   * Track learning deck completion
   */
  trackDeckComplete(deckNumber: number): void;

  /**
   * Track mastery achievement
   */
  trackMasteryAchieved(type: 'CDI' | 'PDI'): void;

  /**
   * Reset Amplitude (for logout)
   */
  reset(): void;
}

/**
 * Base AmplitudeService class
 * Web and mobile platforms should extend this and implement platform-specific logic
 */
export abstract class AmplitudeService implements IAmplitudeService {
  protected initialized: boolean = false;
  protected config: AmplitudeConfig | null = null;

  abstract init(config: AmplitudeConfig): void;
  abstract identifyUser(userId: string, userProperties?: UserProperties): void;
  abstract trackEvent(eventName: string, eventProperties?: EventProperties): void;
  abstract reset(): void;

  trackPageView(pageName: string): void {
    this.trackEvent('Page Viewed', { page: pageName });
  }

  trackLogin(method: string = 'email'): void {
    this.trackEvent('User Logged In', { method });
  }

  trackSignup(): void {
    this.trackEvent('User Signed Up');
  }

  trackRecordingStart(mode: 'CDI' | 'PDI'): void {
    this.trackEvent('Recording Started', { mode });
  }

  trackRecordingComplete(mode: 'CDI' | 'PDI', duration: number): void {
    this.trackEvent('Recording Completed', { mode, duration });
  }

  trackSurveySubmission(totalScore: number, changesNeeded: number): void {
    this.trackEvent('WACB Survey Submitted', {
      totalScore,
      changesNeeded,
      averageScore: totalScore / 9,
    });
  }

  trackDeckComplete(deckNumber: number): void {
    this.trackEvent('Deck Completed', { deckNumber });
  }

  trackMasteryAchieved(type: 'CDI' | 'PDI'): void {
    this.trackEvent('Mastery Achieved', { type });
  }
}

export default AmplitudeService;
