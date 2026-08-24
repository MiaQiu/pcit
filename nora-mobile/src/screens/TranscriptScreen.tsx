/**
 * TranscriptScreen
 * Full-screen wrapper (header + back button) around TranscriptPanel, the
 * shared component that actually renders the filter chips, speaker legend,
 * and utterance list. See components/TranscriptPanel.tsx — the same panel
 * is embedded directly inside SkillUtterancesScreen, so this screen and
 * that in-page view never drift apart.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import { TranscriptPanel } from '../components/TranscriptPanel';
import { useTranslation } from 'react-i18next';
import amplitudeService from '../services/amplitudeService';

type TranscriptScreenRouteProp = RouteProp<RootStackParamList, 'Transcript'>;

export const TranscriptScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<TranscriptScreenRouteProp>();
  const { t } = useTranslation();
  const { recordingId, initialCategory } = route.params;

  useEffect(() => {
    amplitudeService.trackScreenView('Transcript', { recordingId });
  }, [recordingId]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('transcript.headerTitle')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <TranscriptPanel recordingId={recordingId} initialCategory={initialCategory} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
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
});
