/**
 * GetReadySectionScreen
 * Full-content detail page for one GetReadyToPlayScreen row (e.g. "Toys to
 * Use", "How to Start"). Pushed from the row's onPress instead of expanding
 * in place, so long sections (with images) get a full page rather than a
 * cramped inline accordion.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/assets';
import { GetReadySectionBody } from '../components/GetReadySectionBody';
import type { RootStackParamList } from '../navigation/types';

interface GetReadySectionScreenProps {
  route: {
    params: RootStackParamList['GetReadySection'];
  };
}

export const GetReadySectionScreen: React.FC<GetReadySectionScreenProps> = ({ route }) => {
  const { sectionKey } = route.params;
  const navigation = useNavigation();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.navRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backCircle}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={18} color={COLORS.textDark} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t(`getReadyToPlay.sections.${sectionKey}.title`)}</Text>
        <Text style={styles.subtitle}>{t(`getReadyToPlay.sections.${sectionKey}.subtitle`)}</Text>
        <View style={styles.bodyWrap}>
          <GetReadySectionBody body={t(`getReadyToPlay.sections.${sectionKey}.body`)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    lineHeight: 34,
    color: COLORS.textDark,
    marginTop: 8,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 17,
    lineHeight: 24,
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 20,
  },
  bodyWrap: {
    marginTop: 4,
  },
});
