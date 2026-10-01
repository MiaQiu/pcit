import { useCallback, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import amplitudeService from '../services/amplitudeService';

const MILESTONES = [25, 50, 75, 100];

/**
 * Tracks how far down a screen's main ScrollView the user scrolled, firing
 * one "Screen Scrolled" event per depth milestone (25/50/75/100%) reached
 * during a visit. Milestones reset each time the screen regains focus.
 *
 * Usage: <ScrollView {...useScrollDepthTracking('Home')} ...>
 */
export function useScrollDepthTracking(screenName: string, properties?: Record<string, any>) {
  const reachedRef = useRef<Set<number>>(new Set());

  useFocusEffect(
    useCallback(() => {
      reachedRef.current = new Set();
    }, [])
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const scrollableHeight = contentSize.height - layoutMeasurement.height;
      if (scrollableHeight <= 0) return;

      const depthPercent = Math.min(100, Math.round((contentOffset.y / scrollableHeight) * 100));

      for (const milestone of MILESTONES) {
        if (depthPercent >= milestone && !reachedRef.current.has(milestone)) {
          reachedRef.current.add(milestone);
          amplitudeService.trackScreenScrolled(screenName, milestone, properties);
        }
      }
    },
    [screenName, properties]
  );

  return { onScroll, scrollEventThrottle: 200 };
}
