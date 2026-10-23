/**
 * ModuleSpecialPlayScreen
 * "Routines failing? Build the skill behind the rule." — the Special Playtime
 * intro, opened from the "Build the skills behind the tantrum" goal on the
 * "My plan" roadmap. Three numbered cards (the brain behind meltdowns, the
 * research, how Nora coaches) that expand to their full text, and a sticky
 * "Start 5-Min Special Playtime" that returns to the module's Today and starts
 * a play recording there (startPlayRecordingAt).
 * Copy: learnV2.modules.<moduleKey>.specialPlay.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, LayoutAnimation } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FONTS } from '../constants/assets';
import type { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import { returnToModule } from '../navigation/moduleNavigation';
import { TrackedTouchable } from '../components/TrackedTouchable';
import amplitudeService from '../services/amplitudeService';
import { useModulePlan } from './LearnModulePlanView';

const TITLE = '#0D221E';
const BODY = '#5B706B';
const CTA_GREEN = '#0D3B31';
const HEADER_ART = require('../../assets/images/firstGuide.png');
const HEADER_ART_WIDTH = 150;

const CARDS = [
  { key: 'brain', background: '#F0F8F4', badge: '#CDEBDB', badgeText: '#0D3B31' },
  { key: 'research', background: '#EFF6FF', badge: '#CFE2FB', badgeText: '#1E3A8A' },
  { key: 'coaching', background: '#FFF2EF', badge: '#FAD4D8', badgeText: '#9F1239' },
] as const;

// The PEN skills, listed when the coaching card is open.
const PEN_SKILLS = [
  { icon: '👏', key: 'praise' },
  { icon: '💬', key: 'echo' },
  { icon: '📖', key: 'narrate' },
  { icon: '🚫', key: 'avoid' },
];

// "Label: text" — the label (before the first colon, incl. full-width ：) in bold.
const withBoldLabel = (text: string) => {
  const match = text.match(/^([^:：]+[:：])\s*([\s\S]*)$/);
  if (!match) return text;
  return [<Text key="label" style={styles.penLabel}>{match[1]}</Text>, ' ', match[2]];
};

export const ModuleSpecialPlayScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'ModuleSpecialPlay'>>();
  const { t } = useTranslation();
  const { moduleKey } = route.params;
  const base = `learnV2.modules.${moduleKey}.specialPlay`;
  const { childName } = useModulePlan(moduleKey);
  const name = childName || t('learnV2.moduleScreen.yourChild');
  const [openCard, setOpenCard] = useState<string | null>(null);

  const toggleCard = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenCard(prev => (prev === key ? null : key));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.navRow}>
        <TrackedTouchable analyticsId="Back"
          onPress={() => navigation.goBack()}
          style={styles.backCircle}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={20} color={TITLE} />
        </TrackedTouchable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t(`${base}.title`)}</Text>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>{t(`${base}.subtitle`)}</Text>
          <Image source={HEADER_ART} style={styles.headerArt} resizeMode="contain" />
        </View>

        {CARDS.map((card, i) => {
          const open = openCard === card.key;
          return (
            <TrackedTouchable key={card.key} analyticsId={`Module Special Play card: ${card.key}`}
              style={[styles.card, { backgroundColor: card.background }]}
              onPress={() => toggleCard(card.key)}
              activeOpacity={0.85}
            >
              <View style={styles.cardRow}>
                <View style={[styles.badge, { backgroundColor: card.badge }]}>
                  <Text style={[styles.badgeText, { color: card.badgeText }]}>{i + 1}</Text>
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{t(`${base}.${card.key}.title`)}</Text>
                  <Text style={styles.cardLead}>{t(`${base}.${card.key}.lead`)}</Text>
                </View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={TITLE} />
              </View>
              {open && (
                <View style={styles.cardBody}>
                  <Text style={styles.cardBodyText}>{t(`${base}.${card.key}.body`, { name })}</Text>
                  {card.key === 'coaching' && (
                    <>
                      <Text style={styles.penTitle}>{t(`${base}.coaching.penTitle`)}</Text>
                      {PEN_SKILLS.map(skill => (
                        <View key={skill.key} style={styles.penRow}>
                          <Text style={styles.penIcon}>{skill.icon}</Text>
                          <Text style={styles.cardBodyText}>
                            {withBoldLabel(t(`${base}.coaching.${skill.key}`, { name }))}
                          </Text>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}
            </TrackedTouchable>
          );
        })}
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.footer}>
        <TrackedTouchable analyticsId={`Module Special Play: start (${moduleKey})`}
          style={styles.cta}
          onPress={() => {
            amplitudeService.trackEvent('Learn Module Special Play Start Tapped', { moduleKey });
            returnToModule(navigation, moduleKey, { startPlayRecordingAt: Date.now() });
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>{t(`${base}.cta`)}</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TrackedTouchable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FBF9' },
  navRow: { paddingHorizontal: 16, paddingVertical: 8 },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E6F2EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: 20, paddingBottom: 24 },

  // ── Header ──
  title: { fontFamily: FONTS.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.5, color: TITLE, marginTop: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  subtitle: { flex: 1, fontFamily: FONTS.regular, fontSize: 16, lineHeight: 23, color: BODY, marginTop: 10, marginBottom: 8 },
  headerArt: { width: HEADER_ART_WIDTH, height: HEADER_ART_WIDTH * (966 / 1024), marginRight: -8 },

  // ── Cards ──
  card: { borderRadius: 20, padding: 16, marginTop: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: FONTS.bold, fontSize: 18 },
  cardText: { flex: 1 },
  cardTitle: { fontFamily: FONTS.bold, fontSize: 17, lineHeight: 22, color: TITLE },
  cardLead: { fontFamily: FONTS.semiBold, fontSize: 14, lineHeight: 20, color: TITLE, marginTop: 6 },
  cardBody: { marginLeft: 54, marginTop: 10 },
  cardBodyText: { flex: 1, fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, color: BODY },
  penTitle: { fontFamily: FONTS.bold, fontSize: 14, color: TITLE, marginTop: 12 },
  penRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  penIcon: { fontSize: 15, lineHeight: 21 },
  penLabel: { fontFamily: FONTS.bold, color: TITLE },

  // ── Sticky CTA ──
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, backgroundColor: '#F7FBF9' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: CTA_GREEN,
    borderRadius: 28,
    paddingVertical: 17,
  },
  ctaText: { fontFamily: FONTS.bold, fontSize: 17, color: '#FFFFFF' },
});
