/**
 * NextActionCard Component
 * Card shown on HomeScreen with next action
 * Includes optional Yesterday's PEN Skills section at the top
 * Supports 4 different card types: lesson, record, readReport, recordAgain
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, COLORS, DRAGON_PURPLE } from '../constants/assets';
import { Badge } from './Badge';

export type CardType = 'lesson' | 'record' | 'readReport' | 'recordAgain';

export interface NextActionCardProps {
  // Card type determines the content
  type?: CardType;
  // For 'lesson' type - custom content
  phase?: string;
  phaseName?: string;
  title?: string;
  description?: string;
  buttonText?: string;
  onPress?: () => void;
  // Optional yesterday's report section
  yesterdayScore?: {
    score: number;
    maxScore: number;
  };
  encouragementMessage?: string;
  onReadReport?: () => void;
  // Network status
  isOnline?: boolean;
}

// Content definitions for each card type
const CARD_CONTENT = {
  record: {
    title: 'Record your play session',
    subtitle: 'Up next',
    description: 'Learning is 2x faster when put into practice. Practice your new skills by recording the session.',
    buttonText: 'Continue',
    encouragementMessage: 'Good job completing today\'s lesson! Let\'s record your play session now.',

  },
  readReport: {
    title: 'Read your report and insights',
    subtitle: 'Up next',
    description: 'Check out the analysis of your session.',
    buttonText: 'Continue',
    encouragementMessage: 'Awesome! Your report is ready!',

  },
  recordAgain: {
    title: 'Beat your score',
    subtitle: 'Up next',
    description: 'Repetition builds confidence. Record another play session to practice the feedback you just received.',
    buttonText: 'Continue',
    encouragementMessage: 'Great work! Want to practice one more time?',
  },
};

export const NextActionCard: React.FC<NextActionCardProps> = ({
  type = 'lesson',
  phase = 'PHASE',
  phaseName = '',
  title: customTitle,
  description: customDescription,
  buttonText: customButtonText,
  onPress,
  yesterdayScore,
  encouragementMessage,
  onReadReport,
  isOnline = true,
}) => {
  const showYesterdaySection = yesterdayScore !== undefined;
  const percentage = yesterdayScore
    ? Math.min((yesterdayScore.score / yesterdayScore.maxScore) * 100, 100)
    : 0;

  // Calculate hours until midnight Singapore time (UTC+8)
  const getHoursUntilMidnightSGT = () => {
    const now = new Date();
    // Get current hour and minute in Singapore time (UTC+8)
    const sgtHour = (now.getUTCHours() + 8) % 24;
    const sgtMinute = now.getUTCMinutes();

    // Total minutes until midnight
    const minutesUntilMidnight = (24 - sgtHour) * 60 - sgtMinute;

    // Convert to hours and round up
    return Math.ceil(minutesUntilMidnight / 60);
  };

  const hoursUntilMidnight = getHoursUntilMidnightSGT();

  // Determine content based on type
  const isLesson = type === 'lesson';
  const content = isLesson ? null : CARD_CONTENT[type as keyof typeof CARD_CONTENT];

  const title = isLesson ? customTitle : content?.title;
  const description = isLesson ? customDescription : content?.description;
  const buttonText = isLesson ? (customButtonText || 'Continue') : content?.buttonText;
  const subtitle = isLesson ? 'Up next' : content?.subtitle;

  // Use card-specific encouragement message for non-lesson types, fall back to prop
  const displayEncouragementMessage = isLesson ? encouragementMessage : (content?.encouragementMessage || encouragementMessage);

  return (
    <View style={styles.container}>
      {/* Teal Background Section for Yesterday's PEN Skills */}
      {showYesterdaySection && (
        <View style={styles.tealSection}>
          {/* Yesterday's PEN Skills Card */}
          <View style={styles.yesterdayCard}>
            <View style={styles.yesterdayHeader}>
              <Text style={styles.yesterdayTitle}>Last Session Deposits</Text>
              <Text style={styles.yesterdayScore}>+
                {yesterdayScore.score}/{100}
              </Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${percentage}%` }
                ]}
              />
            </View>

            {/* Read Report Link */}
            {onReadReport && (
              <TouchableOpacity
                onPress={onReadReport}
                style={styles.linkContainer}
                disabled={!isOnline}
              >
                <Text style={[styles.linkText, !isOnline && styles.linkTextDisabled]}>Read report</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Dragon Encouragement */}
          {displayEncouragementMessage && (
            <View style={styles.dragonSection}>
              {/* Dragon Icon */}
              <View style={styles.dragonContainer}>
                <Image
                  source={DRAGON_PURPLE}
                  style={styles.dragonIcon}
                  resizeMode="contain"
                />
              </View>

              {/* Speech Bubble */}
              <View style={styles.speechBubble}>
                <Text style={styles.messageText}>{displayEncouragementMessage}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Decorative Background with Ellipse Images */}
      <View style={styles.decorativeBackground}>
        <Image
          source={require('../../assets/images/ellipse-78.png')}
          style={styles.ellipse78}
          resizeMode="cover"
        />
      </View>

      {/* Content - Up Next Section */}
      <View style={[styles.content, showYesterdaySection && styles.contentWithYesterday]}>
        {/* Phase Badge */}
        <View style={styles.badgeContainer}>
          <Badge label={phase} subtitle={phaseName} />
        </View>

        {/* Up next label or Extra Practice badge */}
        {type === 'recordAgain' ? (
          <View style={styles.extraPracticeBadge}>
            <Text style={styles.extraPracticeText}>EXTRA PRACTICE</Text>
          </View>
        ) : (
          <Text style={styles.upNextLabel}>{subtitle}</Text>
        )}

        {/* Title */}
        <Text style={styles.title}>{title}</Text>

        {/* Description */}
        <Text style={styles.description}>{description}</Text>

        {/* CTA Button - Only show if onPress is provided */}
        {onPress && buttonText && (
          <>
            <TouchableOpacity
              style={[styles.button, !isOnline && styles.buttonDisabled]}
              onPress={onPress}
              activeOpacity={0.8}
              disabled={!isOnline}
            >
              <Text style={[styles.buttonText, !isOnline && styles.buttonTextDisabled]}>{buttonText}</Text>
              <Ionicons name="chevron-forward" size={20} color={!isOnline ? "#999999" : "#FFFFFF"} />
            </TouchableOpacity>

            {/* Next Lesson unlock message - Only for recordAgain */}
            {type === 'recordAgain' && (
              <View style={styles.unlockMessageContainer}>
                <Ionicons name="lock-closed" size={14} color="#1E2939" />
                <Text style={styles.unlockMessageText}>Next Lesson unlocks in {hoursUntilMidnight} hrs</Text>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '90%',
    alignSelf: 'center',
    backgroundColor: '#E4E4FF',
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  // Teal section at top for Yesterday's PEN Skills
  tealSection: {
    //backgroundColor: '#7BD5C3',
    paddingHorizontal: 20,
    paddingBottom: 8,
    zIndex: 20,
  },
  yesterdayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  yesterdayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  yesterdayTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textDark,
    lineHeight: 24,
  },
  yesterdayScore: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.mainPurple,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.mainPurple,
    borderRadius: 4,
  },
  linkContainer: {
    alignSelf: 'flex-end',
  },
  linkText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#0059DB',
  },
  linkTextDisabled: {
    color: '#CCCCCC',
  },
  // Dragon encouragement section
  dragonSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dragonContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#F5F0FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragonIcon: {
    width: 90,
    height: 90,
    marginLeft: 25,
  },
  speechBubble: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 24,
    minHeight: 56,
  },
  messageText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#364153',
    lineHeight: 24,
  },
  decorativeBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    alignItems: 'stretch',
  },
  ellipse78: {
    top: -10,
    width: '100%',
    height: 300,
  },
  content: {
    position: 'relative',
    zIndex: 10,
    paddingHorizontal: 24,
    paddingTop: 200,
    paddingBottom: 24,
  },
  contentWithYesterday: {
    paddingTop: 20,
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: 26,
    marginTop: 10,
  },
  upNextLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#1E2939',
    lineHeight: 24,
    textAlign: 'left',
    marginBottom: 8,
  },
  extraPracticeBadge: {
    backgroundColor: '#8C49D5',
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  extraPracticeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 32,
    color: '#1E2939',
    lineHeight: 38,
    letterSpacing: -0.2,
    textAlign: 'left',
    marginBottom: 16,
  },
  description: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#1E2939',
    lineHeight: 22,
    letterSpacing: -0.31,
    textAlign: 'left',
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C3E50',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 100,
    gap: 8,
    marginTop: 0,
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  buttonTextDisabled: {
    color: '#999999',
  },
  unlockMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  unlockMessageText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#1E2939',
  },
});
