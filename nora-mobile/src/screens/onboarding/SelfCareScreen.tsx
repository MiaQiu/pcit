/**
 * Self-Care Screen
 * Shown when parent scores 3-6 on PHQ-2 survey
 * Encourages parents to prioritize their own wellbeing
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../constants/assets';

export const SelfCareScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  const handleFindSupport = () => {
    // Open mental health resources
    Linking.openURL('https://988lifeline.org/');
  };

  const handleContinue = () => {
    navigation.navigate('Intro1');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="heart" size={56} color={COLORS.mainPurple} />
          </View>
        </View>

        {/* Header */}
        <Text style={styles.title}>Let's pause and{'\n'}focus on you first.</Text>

        {/* Message */}
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>
            It looks like things have been heavy for you lately. We want you to know that this is common, and you are not alone.
          </Text>
        </View>

        <View style={styles.messageBox}>
          <Text style={styles.messageText}>
            This program requires high energy and consistency. Trying to push through when you are feeling down can lead to burnout.
          </Text>
        </View>

        {/* Oxygen Mask Metaphor */}
        <View style={styles.metaphorBox}>
          <View style={styles.metaphorIcon}>
            <Text style={styles.metaphorEmoji}>✈️</Text>
          </View>
          <Text style={styles.metaphorText}>
            Just like on an airplane, you need to put on your own oxygen mask before you can assist your child.
          </Text>
        </View>

        {/* Recommendation */}
        <View style={styles.recommendationBox}>
          <Text style={styles.recommendationText}>
            We strongly recommend speaking to a healthcare provider or a counselor to get some support for yourself.
          </Text>
          <Text style={styles.recommendationSubtext}>
            Your mental health is the best gift you can give your child.
          </Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleFindSupport}
          activeOpacity={0.8}
        >
          <Ionicons name="open-outline" size={20} color={COLORS.white} style={{ marginRight: 8 }} />
          <Text style={styles.primaryButtonText}>Find Support Resources</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Continue Anyway</Text>
        </TouchableOpacity>

        {/* Crisis Hotline */}
        <View style={styles.crisisBox}>
          <Text style={styles.crisisText}>
            🆘 If you're in crisis: Call or text <Text style={styles.crisisNumber}>988</Text> (Suicide & Crisis Lifeline)
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.cardPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 40,
  },
  messageBox: {
    marginBottom: 20,
  },
  messageText: {
    fontFamily: FONTS.regular,
    fontSize: 17,
    color: COLORS.textDark,
    lineHeight: 26,
    textAlign: 'center',
  },
  metaphorBox: {
    backgroundColor: '#FFF7ED',
    borderRadius: 20,
    padding: 24,
    marginTop: 28,
    marginBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  metaphorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaphorEmoji: {
    fontSize: 32,
  },
  metaphorText: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#92400E',
    lineHeight: 24,
  },
  recommendationBox: {
    backgroundColor: COLORS.cardPurple,
    borderRadius: 20,
    padding: 24,
    marginBottom: 36,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.mainPurple,
  },
  recommendationText: {
    fontFamily: FONTS.semiBold,
    fontSize: 17,
    color: COLORS.textDark,
    lineHeight: 26,
    marginBottom: 12,
  },
  recommendationSubtext: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textDark,
    lineHeight: 22,
    opacity: 0.8,
    fontStyle: 'italic',
  },
  primaryButton: {
    height: 56,
    backgroundColor: COLORS.mainPurple,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: COLORS.white,
  },
  secondaryButton: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  secondaryButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 17,
    color: '#6B7280',
    textDecorationLine: 'underline',
  },
  crisisBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    marginTop: 8,
  },
  crisisText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#7F1D1D',
    lineHeight: 22,
    textAlign: 'center',
  },
  crisisNumber: {
    fontFamily: FONTS.bold,
    fontSize: 17,
  },
});
