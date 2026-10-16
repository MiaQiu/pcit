/**
 * ModulePlanDetailScreen
 * The detailed current plan for a Learn module (active strategy, why it
 * works, today's protocol, crisis tool, mastered strategies — the
 * LearnModulePlanView content), opened from a goal on the "My plan" roadmap
 * (LearnModulePlanOverview).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/assets';
import type { RootStackParamList } from '../navigation/types';
import { TrackedTouchable } from '../components/TrackedTouchable';
import { LearnModulePlanView } from './LearnModulePlanView';

export const ModulePlanDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ModulePlanDetail'>>();
  const { t } = useTranslation();
  const { moduleKey } = route.params;

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
        <Text style={styles.navTitle}>{t('learnV2.moduleScreenV2.planOverview.detailTitle')}</Text>
        <View style={styles.navSpacer} />
      </View>
      <LearnModulePlanView moduleKey={moduleKey} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F5FC' },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: { fontFamily: FONTS.semiBold, fontSize: 16, color: COLORS.textDark },
  navSpacer: { width: 36 },
});
