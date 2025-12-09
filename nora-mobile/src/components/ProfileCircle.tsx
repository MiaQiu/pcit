/**
 * ProfileCircle Component
 * Circular profile image or placeholder with default dino images
 */

import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity } from 'react-native';
import type { RelationshipToChild } from '@nora/core';

interface ProfileCircleProps {
  imageUrl?: string;
  relationshipToChild?: RelationshipToChild;
  size?: number;
  onPress?: () => void;
}

export const ProfileCircle: React.FC<ProfileCircleProps> = ({
  imageUrl,
  relationshipToChild,
  size = 80,
  onPress,
}) => {
  const dynamicStyles = {
    container: {
      width: size,
      height: size,
      borderRadius: size / 2,
    },
  };

  // Get default image based on relationship
  const getDefaultImage = () => {
    switch (relationshipToChild) {
      case 'FATHER':
        return require('../../assets/images/dino_papa.png');
      case 'MOTHER':
        return require('../../assets/images/dino_mama.png');
      case 'GRANDMOTHER':
        return require('../../assets/images/dino_grandma.png');
      case 'GRANDFATHER':
        return require('../../assets/images/dino_grandpa.png');
      case 'GUARDIAN':
      case 'OTHER':
        return require('../../assets/images/dino_other_guardian.png');
      default:
        // Default to mother for undefined
        return require('../../assets/images/dino_mama.png');
    }
  };

  const content = (
    <View style={[styles.container, dynamicStyles.container]}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <Image
          source={getDefaultImage()}
          style={styles.image}
          resizeMode="cover"
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
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
