/**
 * DemoScreenTemplate
 * Layout: large rounded image filling top, body text below, single Next button.
 * Used by Demo3–Demo6 onboarding screens.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ImageSourcePropType,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DemoScreenTemplateProps {
  title: string;
  image: ImageSourcePropType;
  onNext: () => void;
  onBack?: () => void;
  resizeMode?: 'cover' | 'contain';
  imageContainerStyle?: ViewStyle;
  textContainerStyle?: ViewStyle;
}

export const DemoScreenTemplate: React.FC<DemoScreenTemplateProps> = ({
  title,
  image,
  onNext,
  onBack,
  resizeMode = 'cover',
  imageContainerStyle,
  textContainerStyle,
}) => {
  const insets = useSafeAreaInsets();
  const isCover = resizeMode === 'cover';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Image */}
      <View style={[styles.imageContainer, isCover && styles.imageContainerCover, imageContainerStyle]}>
        <Image source={image} style={styles.image} resizeMode={resizeMode} />
      </View>

      {/* Body text */}
      <View style={[styles.textContainer, textContainerStyle]}>
        <Text style={styles.body}>{title}</Text>
      </View>

      {/* Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.button} onPress={onNext} activeOpacity={0.85}>
          <Text style={styles.buttonText}>Next  →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  imageContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginTop: 24,
  },
  imageContainerCover: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    paddingHorizontal: 32,
    paddingTop: 28,
    paddingBottom: 8,
    alignItems: 'center',
  },
  body: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 18,
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 28,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  backButton: {
    width: 56,
    height: 56,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 22,
    color: '#1F2937',
  },
  button: {
    flex: 1,
    height: 56,
    backgroundColor: '#8C49D5',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
  },
});
