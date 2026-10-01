import React from 'react';
import { GestureResponderEvent, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import amplitudeService from '../services/amplitudeService';
import { useCurrentScreenName } from '../hooks/useCurrentScreenName';

interface TrackedTouchableProps extends TouchableOpacityProps {
  /**
   * Identifies this button in analytics (e.g. "Login Submit", "Close").
   * Optional only so this component can be used as the dynamic-component
   * branch of a `condition ? TrackedTouchable : View` pattern; always pass
   * one explicitly in normal usage.
   */
  analyticsId?: string;
  analyticsProperties?: Record<string, any>;
}

/**
 * Drop-in replacement for TouchableOpacity that fires a "Button Clicked"
 * analytics event (tagged with the current screen name) on every press.
 */
export const TrackedTouchable: React.FC<TrackedTouchableProps> = ({
  analyticsId,
  analyticsProperties,
  onPress,
  ...rest
}) => {
  const screen = useCurrentScreenName();

  const handlePress = (event: GestureResponderEvent) => {
    amplitudeService.trackButtonClicked(analyticsId ?? 'Unnamed Button', screen, analyticsProperties);
    onPress?.(event);
  };

  return <TouchableOpacity onPress={onPress ? handlePress : undefined} {...rest} />;
};
