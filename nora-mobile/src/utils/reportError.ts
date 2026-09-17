import amplitudeService from '../services/amplitudeService';

/**
 * Log an error that was (or is about to be) shown to the user, tagged with
 * where it happened (e.g. 'LoginScreen.handleLogin').
 */
export function reportError(error: unknown, context: string) {
  const err = error instanceof Error ? error : new Error(String(error));
  amplitudeService.trackError(err, context);
}
