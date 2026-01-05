/**
 * RecordingGuideCard Component
 * Card shown after lesson completion to guide user through recording session
 * Based on Figma Frame 481517
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, COLORS } from '../constants/assets';
import { useAuthService } from '../contexts/AppContext';

interface RecordingGuideCardProps {}

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

export const RecordingGuideCard: React.FC<RecordingGuideCardProps> = () => {
  const authService = useAuthService();
  const [childName, setChildName] = useState<string>('your child');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user.childName) {
        setChildName(user.childName);
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
      // Keep default fallback value
    }
  };

  return (
    <View style={styles.container}>
      {/* DO Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DO</Text>

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
    </View>
  );
};

const styles = StyleSheet.create({
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
  },
  itemTitle: {
    //fontFamily: FONTS.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  itemDescription: {
    //fontFamily: FONTS.regular,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
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
});
