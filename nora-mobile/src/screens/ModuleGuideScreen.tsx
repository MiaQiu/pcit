/**
 * ModuleGuideScreen
 * A Learn module's help guide ("How to record?", "Why record?"), opened from
 * the help links on LearnModuleScreen's practice card. One scrolling page in
 * the Play Guide's format: title, subtitle and a markdown body rendered by
 * GetReadySectionBody (same as GetReadySectionScreen). Copy lives in i18n
 * under `learnV2.modules.<moduleKey>.guides.<guide>`.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/assets';
import { GetReadySectionBody } from '../components/GetReadySectionBody';
import type { RootStackParamList } from '../navigation/types';
import { TrackedTouchable } from '../components/TrackedTouchable';

export const ModuleGuideScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ModuleGuide'>>();
  const { t } = useTranslation();
  const { moduleKey, guide } = route.params;
  const base = `learnV2.modules.${moduleKey}.guides.${guide}`;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.navRow}>
        <TrackedTouchable analyticsId="Back"
          onPress={() => navigation.goBack()}
          style={styles.backCircle}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={18} color={COLORS.textDark} />
        </TrackedTouchable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t(`${base}.title`)}</Text>
        <Text style={styles.subtitle}>{t(`${base}.subtitle`)}</Text>
        <View style={styles.bodyWrap}>
          <GetReadySectionBody body={t(`${base}.body`)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Same look as GetReadySectionScreen.
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
