/**
 * ReportScreen
 * Displays daily performance report with skills, tips, and goals
 * Based on Figma design
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SkillProgressBar } from '../components/SkillProgressBar';
import { AudioWaveform } from '../components/AudioWaveform';
import { Button } from '../components/Button';
import { COLORS, FONTS, DRAGON_PURPLE } from '../constants/assets';
import { RootStackNavigationProp } from '../navigation/types';

export const ReportScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();

  // Mock data - will be replaced with real data from API
  const reportData = {
    encouragement: "Amazing job on your session! Here is how it went.",
    skills: [
      { label: 'Praise', progress: 85 },
      { label: 'Reflect', progress: 70 },
      { label: 'Narrate', progress: 60 },
      { label: 'Blub', progress: 45 },
    ],
    areasToAvoid: ['Poking', 'Teasing', 'Commands', 'Interrupting'],
    topMoment: {
      quote: "I love how carefully you practiced those chocolate bars!",
      audioUrl: '', // Audio URL when available
      duration: '0:12', // Duration of the audio clip
    },
    tips: "We are encouraging labeling. Next time, try asking open-ended or encouraging if you want to help start a two-way conversation.",
    tomorrowGoal: "Use 5 Praises",
    stats: {
      totalPlayTime: '8 min 32 sec',
      praisesUsed: 12,
      reflectionsUsed: 8,
      narrationsUsed: 15,
    },
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleBackToHome = () => {
    navigation.navigate('MainTabs', { screen: 'Home' });
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Report</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Dragon Icon and Encouragement Message */}
        <View style={styles.headerSection}>
          <View style={styles.dragonIconContainer}>
            <Image
              source={DRAGON_PURPLE}
              style={styles.dragonIcon}
              resizeMode="contain"
            />
          </View>
          <View style={styles.headerTextBox}>
            <Text style={styles.headerText}>{reportData.encouragement}</Text>
          </View>
        </View>

        {/* PRN Skills Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your PRN Skills</Text>
          <View style={styles.skillsContainer}>
            {reportData.skills.map((skill, index) => (
              <SkillProgressBar
                key={index}
                label={skill.label}
                progress={skill.progress}
              />
            ))}
          </View>
        </View>

        {/* Areas to Avoid */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Areas to avoid</Text>
          <View style={styles.chipsContainer}>
            {reportData.areasToAvoid.map((area, index) => (
              <View key={index} style={styles.chip}>
                <Text style={styles.chipText}>{area}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Top Moment */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Top Moment</Text>
          <Text style={styles.quoteText}>"{reportData.topMoment.quote}"</Text>

          {/* Audio Waveform */}
          <View style={styles.waveformContainer}>
            <AudioWaveform isRecording={false} />
          </View>
        </View>

        {/* Tips for Next Time */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tips for next time</Text>
          <Text style={styles.tipsText}>{reportData.tips}</Text>

          {/* Divider Line */}
          <View style={styles.divider} />

          <TouchableOpacity style={styles.learnMoreButton}>
            <Text style={styles.learnMoreText}>Read full transcript</Text>
          </TouchableOpacity>
        </View>

        {/* Tomorrow Goal */}
        <View style={styles.goalCard}>
          <Text style={styles.goalTitle}>Tomorrow Goal</Text>
          <Text style={styles.goalText}>{reportData.tomorrowGoal}</Text>

          {/* Dragon Image */}
          <View style={styles.dragonContainer}>
            <Image
              source={DRAGON_PURPLE}
              style={styles.dragonImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Back to Home Button */}
        <View style={styles.buttonContainer}>
          <Button onPress={handleBackToHome} variant="primary">
            Back to Home
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textDark,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  headerSection: {
    paddingTop: 4,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dragonIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#F5F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 26,
  },
  dragonIcon: {
    width: 90,
    height: 90,
    marginLeft: 25,
  },
  headerTextBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 24,
    minHeight: 80,
  },
  headerText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#364153',
    lineHeight: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 16,
  },
  skillsContainer: {
    gap: 4,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textDark,
  },
  quoteText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textDark,
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: 12,
  },
  waveformContainer: {
    marginTop: 8,
    marginBottom: -10,
  },
  tipsText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 16,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#E8E8E8',
    marginBottom: 16,
  },
  learnMoreButton: {
    alignSelf: 'center',
    marginTop: 0,
  },
  learnMoreText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.mainPurple,
    textAlign: 'center',
  },
  goalCard: {
    backgroundColor: COLORS.cardPurple,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  goalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 8,
  },
  goalText: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textDark,
    marginBottom: 16,
  },
  dragonContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragonImage: {
    width: '100%',
    height: '100%',
  },
  buttonContainer: {
    marginTop: 8,
  },
});
