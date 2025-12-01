/**
 * Ellipse Component
 * Renders the decorative ellipse SVG from local assets
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Ellipse as SvgEllipse } from 'react-native-svg';

interface EllipseProps {
  color?: string;
  style?: ViewStyle;
}

export const Ellipse: React.FC<EllipseProps> = ({
  color = '#9BD4DF',
  style
}) => {
  return (
    <View style={[styles.container, style]}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 473 175"
        preserveAspectRatio="none"
      >
        <SvgEllipse
          cx="236.5"
          cy="87.5"
          rx="236.5"
          ry="87.5"
          fill={color}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
});
