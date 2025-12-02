/**
 * ProfileCircle Component
 * Circular profile image or placeholder
 */

import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

interface ProfileCircleProps {
  imageUrl?: string;
  size?: number;
}

export const ProfileCircle: React.FC<ProfileCircleProps> = ({
  imageUrl,
  size = 80,
}) => {
  const dynamicStyles = {
    container: {
      width: size,
      height: size,
      borderRadius: size / 2,
    },
  };

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E5E5E5',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#D1D1D1', // Gray placeholder
  },
});
