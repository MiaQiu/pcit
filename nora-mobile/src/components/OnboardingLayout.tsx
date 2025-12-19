/**
 * OnboardingLayout
 * Shared layout wrapper for onboarding screens
 */

import React from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

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
  if (useScrollView) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.wrapper}>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.content}>{children}</View>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  if (useKeyboardAvoid) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.content}>{children}</View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
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
    //paddingBottom: 32,
    justifyContent: 'space-between',
  },
});
