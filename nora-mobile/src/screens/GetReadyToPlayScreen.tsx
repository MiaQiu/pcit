/**
 * GetReadyToPlayScreen
 * Pre-first-session checklist shown from HomeScreen_v2's Main Action Card for
 * first-time users, before they've recorded their first session. Each row
 * pushes GetReadySectionScreen with the full content for that topic.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/assets';
import type { RootStackNavigationProp } from '../navigation/types';

const SECTION_KEYS = [
  'toysToUse',
  'howToStart',
  'howToEnd',
  'howToPlay',
  'whatToExpect',
  'siblings',
  'findingTime',
  'dataPrivacy',
] as const;

const HERO_IMAGE = require('../../assets/images/firstGuide.png');

const SectionRow: React.FC<{
  title: string;
  subtitle: string;
  onPress: () => void;
}> = ({ title, subtitle, onPress }) => (
  <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.rowHeader}>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.mainPurple} />
    </View>
  </TouchableOpacity>
);

export const GetReadyToPlayScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
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
        <View style={styles.headerWrap}>
          <Image source={HERO_IMAGE} style={styles.headerImage} resizeMode="contain" />
          <View style={styles.headerTextOverlay}>
            <View style={styles.titleLine}>
              <Text style={styles.title}>{t('getReadyToPlay.title1')}</Text>
              <View style={styles.sparkleWrap}>
                <View style={[styles.sparkleLine, styles.sparkleLine1]} />
                <View style={[styles.sparkleLine, styles.sparkleLine2]} />
              </View>
            </View>
            <Text style={[styles.title, styles.titleAccent]}>{t('getReadyToPlay.title2')}</Text>
            <Text style={styles.subtitle}>{t('getReadyToPlay.subtitle')}</Text>

            <View style={styles.pill}>
              <View style={styles.pillTextWrap}>
                <Text style={styles.pillTitle}>{t('getReadyToPlay.pillTitle')}</Text>
                <Text style={styles.pillSubtitle}>{t('getReadyToPlay.pillSubtitle')}</Text>
              </View>
            </View>
          </View>
        </View>

        {SECTION_KEYS.map((key) => (
          <SectionRow
            key={key}
            title={t(`getReadyToPlay.sections.${key}.title`)}
            subtitle={t(`getReadyToPlay.sections.${key}.subtitle`)}
            onPress={() => navigation.push('GetReadySection', { sectionKey: key })}
          />
        ))}
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
  headerWrap: {
    position: 'relative',
    minHeight: 250,
    marginBottom: 24,
  },
  headerImage: {
    position: 'absolute',
    top: 0,
    right: -20,
    width: 250,
    height: 250,
  },
  headerTextOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 100,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sparkleWrap: {
    width: 20,
    height: 20,
    marginLeft: 2,
    marginTop: 2,
  },
  sparkleLine: {
    position: 'absolute',
    width: 3,
    height: 12,
    borderRadius: 2,
    backgroundColor: COLORS.mainPurple,
  },
  sparkleLine1: {
    left: 2,
    top: 0,
    transform: [{ rotate: '-25deg' }],
  },
  sparkleLine2: {
    left: 9,
    top: 4,
    transform: [{ rotate: '20deg' }],
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    lineHeight: 38,
    color: COLORS.textDark,
    marginTop: 8,
  },
  titleAccent: {
    color: COLORS.mainPurple,
    marginTop: 0,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 17,
    lineHeight: 24,
    color: '#6B7280',
    marginTop: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: 150,
    backgroundColor: '#F5EEFC',
    marginLeft: -20,
    marginTop: 20,
    paddingLeft: 20,
    paddingRight: 16,
    paddingVertical: 14,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  pillTextWrap: {
    flex: 1,
  },
  pillTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.mainPurple,
  },
  pillSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#6B7280',
    marginTop: 2,
  },
  row: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: COLORS.textDark,
  },
  rowSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#6B7280',
    marginTop: 3,
  },
});
