/**
 * OnboardingLayout
 * Shared layout wrapper for onboarding screens
 */

import React from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface OnboardingLayoutProps {
  children: React.ReactNode;
  useKeyboardAvoid?: boolean;
  useScrollView?: boolean;
}

export const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
  children,
  useKeyboardAvoid = false,
  useScrollView = false,
}) => {
  const insets = useSafeAreaInsets();
  const containerStyle = [styles.container, { paddingTop: insets.top }];

  if (useScrollView) {
    return (
      <View style={containerStyle}>
        <View style={styles.wrapper}>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.content}>{children}</View>
          </ScrollView>
        </View>
      </View>
    );
  }

  if (useKeyboardAvoid) {
    return (
      <View style={containerStyle}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.content}>{children}</View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  wrapper: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    justifyContent: 'space-between',
  },
});
