import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import amplitudeService from '../services/amplitudeService';

/**
 * Logs how long a screen stayed focused for one visit (focus -> blur/unmount),
 * via amplitudeService.trackScreenViewDuration. Pass extra properties (e.g.
 * { recordingId }) to tie the duration to what was being viewed.
 */
export function useScreenViewDuration(screenName: string, properties?: Record<string, any>) {
  useFocusEffect(
    useCallback(() => {
      const startedAt = Date.now();
      return () => {
        amplitudeService.trackScreenViewDuration(screenName, Date.now() - startedAt, properties);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screenName])
  );
}
