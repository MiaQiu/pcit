/**
 * KeyStrategyList
 * The key screen-time strategies a Day 1 report recommends: one tinted row
 * per strategy (icon, name, arrow) that opens its KeyStrategyScreen.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '../navigation/types';
import { FONTS } from '../constants/assets';
import { REPORT_CARD_COLORS } from './ReportCard';
import type { KeyStrategyId } from '../constants/learnModules';

// Icon and colors per strategy: row background, icon bubble, accent (icon + arrow).
const STRATEGY_STYLES: Record<KeyStrategyId, { icon: keyof typeof Ionicons.glyphMap; bg: string; bubble: string; accent: string }> = {
  countdown: { icon: 'hourglass-outline',     bg: '#EDF5FD', bubble: '#D8E9F9', accent: '#3E77A8' },
  timer:     { icon: 'alarm-outline',         bg: '#F4ECFC', bubble: '#E6D6F8', accent: '#8C49D5' },
  bridging:  { icon: 'color-palette-outline', bg: '#FFF1E6', bubble: '#FCDDC6', accent: '#D9703A' },
};

interface KeyStrategyListProps {
  strategies: KeyStrategyId[];
  childName?: string;
  onOpen?: (id: KeyStrategyId) => void;
}

export const KeyStrategyList: React.FC<KeyStrategyListProps> = ({ strategies, childName, onOpen }) => {
  const { t } = useTranslation();
  const navigation = useNavigation<RootStackNavigationProp>();

  return (
    <View style={styles.list}>
      {strategies.map((id) => {
        const style = STRATEGY_STYLES[id];
        return (
          <TouchableOpacity key={id} activeOpacity={0.85} accessibilityRole="button"
            style={[styles.row, { backgroundColor: style.bg }]}
            onPress={() => {
              onOpen?.(id);
              navigation.navigate('KeyStrategy', { strategy: id, childName });
            }}
          >
            <View style={[styles.iconBubble, { backgroundColor: style.bubble }]}>
              <Ionicons name={style.icon} size={22} color={style.accent} />
            </View>
            <Text style={styles.name}>{t(`moduleReport.keyStrategies.${id}.name`)}</Text>
            <Ionicons name="chevron-forward" size={20} color={style.accent} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  list: { marginTop: 4, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  iconBubble: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontFamily: FONTS.bold, fontSize: 17, lineHeight: 23, color: REPORT_CARD_COLORS.title },
});
