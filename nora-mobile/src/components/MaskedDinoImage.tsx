/**
 * Masked Dino Image Component
 * Renders the dino image with a curved mask at the bottom
 */

import React from 'react';
import { View, StyleSheet, Image, ViewStyle, ImageSourcePropType } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface MaskedDinoImageProps {
  style?: ViewStyle;
  imageSource?: ImageSourcePropType;
  maskColor?: string;
}

export const MaskedDinoImage: React.FC<MaskedDinoImageProps> = ({
  style,
  imageSource = require('../../assets/images/dino_new.webp'),
  maskColor = 'white'
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Image layer */}
      <Image
        source={imageSource}
        style={styles.image}
        resizeMode="cover"
      />

      {/* Curve overlay to mask bottom */}
      <View style={styles.whiteOverlay}>
        <Svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
          <Path
            d="M 0 60 Q 200 120, 400 60 L 400 200 L 0 200 Z"
            fill={maskColor}
          />
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  whiteOverlay: {
    position: 'absolute',
    bottom: -100,
    left: 0,
    width: '100%',
    height: '60%',
  },
});
