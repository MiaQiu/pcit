/**
 * ReportScreen
 * Displays daily performance report with skills, tips, and goals
 * Based on Figma design
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SkillProgressBar } from '../components/SkillProgressBar';
import { AudioWaveform } from '../components/AudioWaveform';
import { Button } from '../components/Button';
import { COLORS, FONTS, DRAGON_PURPLE } from '../constants/assets';
import { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import { useRecordingService } from '../contexts/AppContext';
import type { RecordingAnalysis } from '@nora/core';

type ReportScreenRouteProp = RouteProp<RootStackParamList, 'Report'>;

export const ReportScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<ReportScreenRouteProp>();
  const recordingService = useRecordingService();
  const { recordingId } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<RecordingAnalysis | null>(null);
  const [pollingCount, setPollingCount] = useState(0);

  useEffect(() => {
    loadReportData();
  }, [recordingId]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await recordingService.getAnalysis(recordingId);
      setReportData(data);
      setLoading(false);
    } catch (err: any) {
      console.log('Report error:', err.message);

      // If still processing, poll again after 3 seconds
      if (err.message.includes('processing') && pollingCount < 20) {
        setPollingCount(prev => prev + 1);
        setTimeout(() => {
          loadReportData();
        }, 3000);
      } else if (pollingCount >= 20) {
        setError('Analysis is taking longer than expected. Please try again later.');
        setLoading(false);
      } else {
        setError(err.message || 'Failed to load report');
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleBackToHome = () => {
    navigation.navigate('MainTabs', { screen: 'Home' });
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Report</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.mainPurple} />
          <Text style={styles.loadingText}>
            {pollingCount > 0 ? 'Analyzing your session...' : 'Loading report...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !reportData) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Report</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#E74C3C" />
          <Text style={styles.errorText}>{error || 'Failed to load report'}</Text>
          <Button onPress={loadReportData} variant="primary">
            Try Again
          </Button>
        </View>
      </SafeAreaView>
    );
  }

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
                maxValue={10}
              />
            ))}
          </View>
        </View>

        {/* Areas to Avoid */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Areas to avoid</Text>
            <Text style={styles.totalText}>Total &lt; 3</Text>
          </View>
          <View style={styles.avoidContainer}>
            {reportData.areasToAvoid.map((area, index) => {
              const areaData = typeof area === 'string' ? { label: area, count: 0 } : area;
              return (
                <View key={index} style={styles.avoidRow}>
                  <Text style={styles.avoidLabel}>{areaData.label}</Text>
                  <View style={styles.avoidRightContainer}>
                    <Text style={styles.countText}>{areaData.count}</Text>
                    <View style={styles.circlesContainer}>
                      {Array.from({ length: areaData.count }).map((_, i) => (
                        <View key={i} style={styles.circle} />
                      ))}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Top Moment */}
        <View>
          <Text style={styles.cardTitle}>Top Moment</Text>
          <View style={styles.card}>
            <Text style={styles.quoteText}>"{reportData.topMoment.quote}"</Text>

            {/* Audio Waveform */}
            {/* <View style={styles.waveformContainer}>
              <AudioWaveform isRecording={false} />
            </View> */}
          </View>
        </View>

        {/* Tips for Next Time */}
        <View>
          <Text style={styles.cardTitle}>Tips for next time</Text>
          <View style={styles.card}>
            <Text style={styles.tipsText}>{reportData.tips}</Text>

            {/* Divider Line */}
            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.learnMoreButton}
              onPress={() => navigation.navigate('Transcript', { recordingId })}
            >
              <Text style={styles.learnMoreText}>Read full transcript</Text>
            </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.textDark,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#E74C3C',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
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
  cardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.textDark,
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 16,
  },
  totalText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#666666',
  },
  skillsContainer: {
    gap: 4,
  },
  avoidContainer: {
    gap: 16,
  },
  avoidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avoidLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textDark,
  },
  avoidRightContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  countText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#666666',
  },
  circlesContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  circle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  quoteText: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textDark,
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: 12,
    textAlign: 'center',
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
