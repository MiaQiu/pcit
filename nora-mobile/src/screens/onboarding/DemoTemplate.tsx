import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DemoTemplateProps {
  children: React.ReactNode;
  text: string;
  onNext: () => void;
  onBack: () => void;
}

export const DemoTemplate: React.FC<DemoTemplateProps> = ({
  children,
  text,
  onNext,
  onBack,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Space from screen top to where text starts (text bottom = insets.bottom + 180, text height ≈ 52px)
  const contentHeight = SCREEN_HEIGHT - insets.top - insets.bottom - 240;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Content — centered in the space above the text */}
      <View style={[styles.contentArea, { height: contentHeight }]}>
        {children}
      </View>

      {/* Text — fixed 100px above button */}
      <View style={[styles.textContainer, { bottom: insets.bottom + 180 }]}>
        <Text style={styles.body}>{text}</Text>
      </View>

      {/* Buttons — fixed at bottom */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={22} color="#1F2937" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={onNext} activeOpacity={0.85}>
          <Text style={styles.buttonText}>{t('onboarding.next')}</Text>
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
  contentArea: {
    justifyContent: 'center',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  textContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  body: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 18,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 26,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
