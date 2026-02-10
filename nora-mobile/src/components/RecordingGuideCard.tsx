/**
 * RecordingGuideCard Component
 * Card shown after lesson completion to guide user through recording session
 * Supports Special Time and Discipline modes with built-in tab toggle
 * Based on Figma Frame 481517
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, COLORS } from '../constants/assets';
import { useAuthService } from '../contexts/AppContext';

export type GuideMode = 'specialTime' | 'discipline';

interface RecordingGuideCardProps {
  onModeChange?: (mode: GuideMode, locked: boolean) => void;
  onRecordPress?: () => void;
}

const DO_ITEMS = [
  {
    title: 'Praise',
    description: 'Be a Cheerleader. Tell your child exactly what you like about their behavior.',
  },
  {
    title: 'Echo',
    description: 'Repeat What They Say. Show you\'re listening by repeating their words.',
  },
  {
    title: 'Narrate',
    description: 'Describe their actions like a sportscaster, without judgment.',
  },
];

const DONT_ITEMS = ['Command', 'Question', 'Criticize'];

const DISCIPLINE_DO_ITEMS = [
  {
    title: 'The Effective Command:',
    description: 'Direct, Positive, Single, Specific',
  },
  {
    title: 'Always Follow Through:',
    description: '5-Second \u2192 Offer a Choice \u2192 5-Second \u2192 Act on the Choice',
  },
  {
    title: 'Key Mindsets:',
    description: 'Consistency, Stay calm',
  },
];

export const RecordingGuideCard: React.FC<RecordingGuideCardProps> = ({ onModeChange }) => {
  const authService = useAuthService();
  const [childName, setChildName] = useState<string>('your child');
  const [mode, setMode] = useState<GuideMode>('specialTime');
  const [isDisciplineUnlocked, setIsDisciplineUnlocked] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user.childName) {
        setChildName(user.childName);
      }
      const unlocked = user.currentPhase === 'DISCIPLINE';
      setIsDisciplineUnlocked(unlocked);
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  };

  const handleModeChange = (newMode: GuideMode) => {
    setMode(newMode);
    const locked = newMode === 'discipline' && !isDisciplineUnlocked;
    onModeChange?.(newMode, locked);
  };

  const renderSpecialTimeContent = () => (
    <>
      {/* DO Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DO - PEN Skills</Text>

        {DO_ITEMS.map((item, index) => (
          <View key={index} style={styles.doItem}>
            <View style={styles.itemIconContainer}>
              <Image
                source={require('../../assets/images/dragon_image.png')}
                style={styles.itemIcon}
                resizeMode="contain"
              />
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemDescription}>{item.description}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* DON'T Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DON'T</Text>

        <View style={styles.dontChipsContainer}>
          {DONT_ITEMS.map((item, index) => (
            <View key={index} style={styles.dontChip}>
              <Text style={styles.dontChipText}>{item}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.reminderText}>
          Remember, this is Child-Led Play. Just follow {childName}'s lead.
        </Text>
      </View>
    </>
  );

  const renderDisciplineContent = () => (
    <>
      {/* Connection First - PEN Skills */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection First {'\u2013'} PEN Skills</Text>

        <View style={styles.doItem}>
          <View style={styles.itemIconContainer}>
            <Image
              source={require('../../assets/images/dragon_image.png')}
              style={styles.itemIcon}
              resizeMode="contain"
            />
          </View>
          <View style={styles.itemContent}>
            <Text style={styles.itemTitle}>
              <Text style={styles.penLetter}>P</Text>
              <Text style={styles.penSubscript}>raise, </Text>
              <Text style={styles.penLetter}>E</Text>
              <Text style={styles.penSubscript}>cho, </Text>
              <Text style={styles.penLetter}>N</Text>
              <Text style={styles.penSubscript}>arrate</Text>
            </Text>
          </View>
        </View>
      </View>

      {/* During Discipline - Do */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>During Discipline {'\u2013'} Do</Text>

        {DISCIPLINE_DO_ITEMS.map((item, index) => (
          <View key={index} style={styles.doItem}>
            <View style={styles.itemIconContainer}>
              <Image
                source={require('../../assets/images/dragon_image.png')}
                style={styles.itemIcon}
                resizeMode="contain"
              />
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemDescription}>{item.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.reminderText}>
        Remember, For every command, aim for about 10 P.E.N. moments to rebuild connection.
      </Text>
    </>
  );

  return (
    <View>
      {/* Tab Toggle */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, mode === 'specialTime' && styles.tabActive]}
          onPress={() => handleModeChange('specialTime')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, mode === 'specialTime' && styles.tabTextActive]}>
            Special Time (5m)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === 'discipline' && styles.tabActive]}
          onPress={() => handleModeChange('discipline')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, mode === 'discipline' && styles.tabTextActive]}>
            Discipline (10m)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Card Content */}
      <View style={{ position: 'relative' }}>
        <View style={styles.container}>
          {mode === 'specialTime' ? renderSpecialTimeContent() : renderDisciplineContent()}
        </View>

        {/* Lock overlay for discipline when user is still in CONNECT phase */}
        {mode === 'discipline' && !isDisciplineUnlocked && (
          <View style={styles.lockOverlay}>
            <View style={styles.lockMessageContainer}>
              <Ionicons name="lock-closed" size={24} color="#8C49D5" style={{ marginBottom: 8 }} />
              <Text style={styles.lockMessageText}>
                Effective discipline is built on a foundation of a strong bond. Without that connection, instructions can feel like demands; with it, they feel like guidance.
              </Text>
              <Text style={styles.lockGoalText}>
                Goal: Reach 80 deposits in a single Special Time session to unlock Discipline coaching module
              </Text>
              <Text style={styles.lockMessageText}>
                This ensures your "relationship bank account" is overfilled before you begin the PDI phase.
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F5',
    borderRadius: 100,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 100,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#999999',
  },
  tabTextActive: {
    color: COLORS.textDark,
  },
  container: {
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.textDark,
    marginBottom: 10,
    marginTop: 0,
    letterSpacing: 0.5,
  },
  doItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
    backgroundColor: '#F0F9F4',
    padding: 12,
    borderRadius: 12,
  },
  itemIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#F5F0FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemIcon: {
    width: 90,
    height: 90,
    marginLeft: 25,
  },
  itemContent: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  itemDescription: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  penLetter: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    color: COLORS.textDark,
  },
  penSubscript: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: COLORS.textDark,
  },
  dontChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  dontChip: {
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
  },
  dontChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textDark,
  },
  reminderText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  lockMessageContainer: {
    backgroundColor: '#F5F0FF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  lockMessageText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#666666',
    lineHeight: 22,
    textAlign: 'center',
  },
  lockGoalText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#8C49D5',
    lineHeight: 22,
    textAlign: 'center',
    marginVertical: 12,
  },
});
