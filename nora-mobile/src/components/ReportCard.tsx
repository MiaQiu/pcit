/**
 * ReportCard
 * Shared card chrome for ReportDetailScreen's "Warm Elevation" visual
 * language (Option B): shadowed white card, warm-brown title, optional
 * icon badge, optional subtitle, optional tip banner, optional
 * expand/collapse, customizable background. Every section on the screen
 * except the hero and the "Unlock My Child's Plan" upsell (both bespoke)
 * is one of these.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS } from '../constants/assets';

export const REPORT_CARD_COLORS = {
  title: '#3D2A1E',
  subtitle: '#7A6252',
  iconBackground: '#F5EAFB',
  iconColor: '#8C49D5',
  tipBackground: '#FDF2E9',
  tipText: '#9A5A34',
};

interface ReportCardProps {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBackgroundColor?: string;
  eyebrow?: React.ReactNode;
  title?: string;
  titleColor?: string;
  subtitle?: string;
  backgroundColor?: string;
  tip?: string;
  expandable?: boolean;
  defaultExpanded?: boolean;
  headerRight?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  children?: React.ReactNode;
}

export const ReportCard: React.FC<ReportCardProps> = ({
  icon,
  iconColor = REPORT_CARD_COLORS.iconColor,
  iconBackgroundColor = REPORT_CARD_COLORS.iconBackground,
  eyebrow,
  title,
  titleColor = REPORT_CARD_COLORS.title,
  subtitle,
  backgroundColor = '#FFFFFF',
  tip,
  expandable = false,
  defaultExpanded = true,
  headerRight,
  onPress,
  style,
  children,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const showContent = !expandable || expanded;

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  };

  const header = (title || icon || eyebrow) && (
    <View style={styles.headerRow}>
      <View style={styles.headerTitleRow}>
        {icon && (
          <View style={[styles.iconBadge, { backgroundColor: iconBackgroundColor }]}>
            <Ionicons name={icon} size={16} color={iconColor} />
          </View>
        )}
        <View style={styles.headerTextCol}>
          {eyebrow && <View style={styles.eyebrow}>{eyebrow}</View>}
          {title && <Text style={[styles.title, { color: titleColor }]}>{title}</Text>}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.headerActions}>
        {headerRight}
        {expandable && (
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#9CA3AF" />
        )}
      </View>
    </View>
  );

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[styles.card, { backgroundColor }, style]}
      {...(onPress ? { onPress, activeOpacity: 0.85 } : {})}
    >
      {expandable ? (
        <TouchableOpacity activeOpacity={0.7} onPress={toggleExpanded}>
          {header}
        </TouchableOpacity>
      ) : header}

      {showContent && children}
      {showContent && tip && (
        <View style={styles.tipBanner}>
          <Text style={styles.tipText}>{tip}</Text>
        </View>
      )}
    </Container>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
    shadowColor: '#8C49D5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  headerTextCol: { flexShrink: 1 },
  eyebrow: { alignSelf: 'flex-start', marginBottom: 6 },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 18,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: REPORT_CARD_COLORS.subtitle,
    marginTop: 2,
  },
  tipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: REPORT_CARD_COLORS.tipBackground,
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
  },
  tipText: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: REPORT_CARD_COLORS.tipText,
    lineHeight: 19,
  },
});
